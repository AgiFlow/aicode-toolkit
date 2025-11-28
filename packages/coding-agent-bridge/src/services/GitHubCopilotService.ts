/**
 * GitHubCopilotService
 *
 * DESIGN PATTERNS:
 * - Class-based service pattern for encapsulating business logic
 * - Interface implementation for dependency injection and testing
 * - Single Responsibility: Manages GitHub Copilot coding agent interactions
 * - Method-based API: Public methods expose service capabilities
 *
 * CODING STANDARDS:
 * - Service class names use PascalCase with 'Service' suffix
 * - Method names use camelCase with descriptive verbs
 * - Return types should be explicit (never use implicit any)
 * - Use async/await for asynchronous operations
 * - Handle errors with try-catch and throw descriptive Error objects
 * - Document public methods with JSDoc comments
 *
 * AVOID:
 * - Side effects in constructors (keep them lightweight)
 * - Mixing concerns (keep services focused on single domain)
 * - Direct coupling to other services (use dependency injection)
 * - Exposing internal implementation details
 */

import { execa } from 'execa';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathExists, ensureDir } from '@agiflowai/aicode-utils';
import type {
  CodingAgentService,
  LlmInvocationParams,
  LlmInvocationResponse,
  McpSettings,
  PromptConfig,
} from '../types';
import { appendUniqueToFile, appendUniqueWithMarkers, writeFileEnsureDir } from '../utils/file';

/**
 * GitHub Copilot MCP server configuration format
 * Based on GitHub's repository settings: Settings → Copilot → Coding agent → MCP configuration
 * @see https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/extend-coding-agent-with-mcp
 */
interface GitHubCopilotMcpConfig {
  mcpServers: Record<string, GitHubCopilotMcpServerConfig>;
}

/**
 * GitHub Copilot MCP server configuration
 * Supports local (stdio), http, and sse server types
 */
interface GitHubCopilotMcpServerConfig {
  /** Server type: local (stdio), http, or sse */
  type: 'local' | 'http' | 'sse';
  /** Tools to enable from this server - use ["*"] for all tools */
  tools: string[];
  /** Command to run (for local/stdio servers) */
  command?: string;
  /** Command arguments (for local/stdio servers) */
  args?: string[];
  /** Environment variables (for local/stdio servers) - can reference secrets with COPILOT_MCP_ prefix */
  env?: Record<string, string>;
  /** Server URL (for http/sse servers) */
  url?: string;
  /** Headers for requests (for http/sse servers) - can reference secrets with $COPILOT_MCP_ prefix */
  headers?: Record<string, string>;
}

/**
 * Service for integrating with GitHub Copilot coding agent
 *
 * GitHub Copilot coding agent supports three types of custom instructions:
 *
 * 1. **Repository-wide instructions** (.github/copilot-instructions.md)
 *    - Apply to all requests in the repository
 *    - Automatically included in all Copilot interactions
 *
 * 2. **Path-specific instructions** (.github/instructions/NAME.instructions.md)
 *    - Apply to specific files/directories using glob patterns
 *    - Defined with frontmatter: applyTo: "pattern"
 *
 * 3. **Agent instructions** (AGENTS.md, CLAUDE.md, or GEMINI.md)
 *    - Used by AI agents
 *    - Nearest file in directory tree takes precedence
 *
 * MCP Configuration:
 * - Configured via repository settings on GitHub.com (for coding agent)
 * - Or via ~/.copilot/config.json (for CLI)
 * - Settings → Copilot → Coding agent → MCP configuration
 * - Secrets must be prefixed with COPILOT_MCP_ and added to 'copilot' environment
 * - GitHub MCP server is enabled by default with read-only access to current repository
 *
 * CLI Support:
 * - GitHub Copilot CLI (gh copilot) supports two modes:
 *   1. Interactive mode: copilot (chat session)
 *   2. Programmatic mode: copilot -p "prompt" --allow-all-tools
 * - Default model: Claude Sonnet 4 (can be changed with /model)
 * - Uses premium requests quota
 *
 * @see https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions
 * @see https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/extend-coding-agent-with-mcp
 * @see https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli
 */
export class GitHubCopilotService implements CodingAgentService {
  private mcpSettings: McpSettings = {};
  private promptConfig: PromptConfig = {};
  private readonly workspaceRoot: string;
  private readonly copilotPath: string;
  private readonly defaultTimeout: number;

  constructor(options?: { workspaceRoot?: string; copilotPath?: string; defaultTimeout?: number }) {
    this.workspaceRoot = options?.workspaceRoot || process.cwd();
    this.copilotPath = options?.copilotPath || 'copilot';
    this.defaultTimeout = options?.defaultTimeout || 120000; // 2 minutes default
  }

  /**
   * Check if GitHub Copilot coding agent is enabled
   * Detects by checking for .github/copilot-instructions.md or AGENTS.md in workspace root
   */
  async isEnabled(): Promise<boolean> {
    try {
      const copilotInstructions = path.join(
        this.workspaceRoot,
        '.github',
        'copilot-instructions.md',
      );
      const agentsMd = path.join(this.workspaceRoot, 'AGENTS.md');

      const hasCopilotInstructions = await pathExists(copilotInstructions);
      const hasAgentsMd = await pathExists(agentsMd);

      return hasCopilotInstructions || hasAgentsMd;
    } catch (error) {
      // Handle file system errors gracefully
      // This is expected behavior when workspace is not configured for GitHub Copilot
      if (error instanceof Error) {
        // Log specific error types that might need attention
        if (error.message.includes('EACCES') || error.message.includes('EPERM')) {
          console.warn(
            `GitHub Copilot detection warning: Permission denied accessing workspace at ${this.workspaceRoot}`,
          );
        }
      }
      return false;
    }
  }

  /**
   * Update MCP (Model Context Protocol) settings for GitHub Copilot
   *
   * Supports two configuration modes:
   *
   * 1. **Coding Agent (via GitHub.com)**: Requires manual configuration
   *    - Navigate to repository Settings → Copilot → Coding agent
   *    - Add the JSON configuration in the "MCP configuration" section
   *    - Click "Save" to validate and apply
   *    - If servers require secrets:
   *      - Go to Settings → Environments
   *      - Create/select "copilot" environment
   *      - Add secrets with COPILOT_MCP_ prefix
   *    - This method generates .github/copilot-mcp-config.json for reference
   *
   * 2. **CLI Mode** (default): Writes to ~/.copilot/config.json
   *    - Automatically configures MCP servers for gh copilot CLI
   *    - Servers are immediately available in CLI sessions
   *
   * @param settings - MCP server configurations
   * @param options - Configuration options
   * @param options.useCodingAgentMode - If true, generates reference config for GitHub UI instead of updating CLI config
   * @throws Error if configuration cannot be written
   */
  async updateMcpSettings(
    settings: McpSettings,
    options?: {
      useCodingAgentMode?: boolean;
    },
  ): Promise<void> {
    this.mcpSettings = { ...this.mcpSettings, ...settings };

    try {
      if (options?.useCodingAgentMode) {
        // Coding Agent mode: Generate reference config for GitHub UI
        await this.updateCodingAgentConfig(settings);
      } else {
        // CLI mode: Write to ~/.copilot/config.json
        await this.updateCliConfig(settings);
      }
    } catch (error) {
      throw new Error(
        `Failed to update GitHub Copilot MCP configuration: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Update MCP configuration for GitHub Copilot coding agent (GitHub.com UI)
   * Generates a reference config file that must be manually copied to repository settings
   *
   * @private
   */
  private async updateCodingAgentConfig(settings: McpSettings): Promise<void> {
    const configPath = path.join(this.workspaceRoot, '.github', 'copilot-mcp-config.json');

    // Build GitHub Copilot MCP configuration
    const copilotConfig: GitHubCopilotMcpConfig = {
      mcpServers: {},
    };

    // Convert standardized MCP server configs to GitHub Copilot format
    if (settings.servers) {
      for (const [serverName, serverConfig] of Object.entries(settings.servers)) {
        // Skip disabled servers
        if (serverConfig.disabled) {
          continue;
        }

        const githubConfig: GitHubCopilotMcpServerConfig = {
          type: serverConfig.type === 'stdio' ? 'local' : serverConfig.type,
          tools: ['*'], // Enable all tools by default - should be customized for security
        };

        // Add type-specific fields
        if (serverConfig.type === 'stdio') {
          githubConfig.command = serverConfig.command;
          if (serverConfig.args && serverConfig.args.length > 0) {
            githubConfig.args = serverConfig.args;
          }
          if (serverConfig.env) {
            // Map environment variables
            // Note: Values can reference GitHub secrets with COPILOT_MCP_ prefix
            githubConfig.env = serverConfig.env;
          }
        } else if (serverConfig.type === 'http' || serverConfig.type === 'sse') {
          githubConfig.url = serverConfig.url;
          // Note: Headers are not part of the standardized McpServerConfig
          // They must be configured manually in the GitHub UI if needed
        }

        copilotConfig.mcpServers[serverName] = githubConfig;
      }
    }

    // Write config file with instructions
    const configWithInstructions = {
      _instructions: [
        'GitHub Copilot MCP Configuration',
        '',
        'MANUAL SETUP REQUIRED:',
        '1. Copy the "mcpServers" object below',
        '2. Navigate to: Repository Settings → Copilot → Coding agent',
        '3. Paste into the "MCP configuration" section',
        '4. Click "Save" to validate and apply',
        '',
        'SECRETS SETUP (if needed):',
        '1. Go to: Repository Settings → Environments',
        '2. Create or select the "copilot" environment',
        '3. Add secrets with names prefixed by "COPILOT_MCP_"',
        '4. Reference secrets in env using: "COPILOT_MCP_SECRET_NAME"',
        '   or in headers using: "$COPILOT_MCP_SECRET_NAME"',
        '',
        'SECURITY NOTE:',
        '- Review and customize the "tools" array for each server',
        '- Use specific read-only tools instead of ["*"] for production',
        '- Copilot will use tools autonomously without asking for approval',
        '',
        'See: https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/extend-coding-agent-with-mcp',
      ],
      ...copilotConfig,
    };

    await writeFileEnsureDir(configPath, `${JSON.stringify(configWithInstructions, null, 2)}\n`);
  }

  /**
   * Update MCP configuration for GitHub Copilot CLI
   * Writes to ~/.copilot/config.json
   *
   * @private
   */
  private async updateCliConfig(settings: McpSettings): Promise<void> {
    const configDir = path.join(os.homedir(), '.copilot');
    const configPath = path.join(configDir, 'config.json');

    // Ensure config directory exists
    await ensureDir(configDir);

    // Read existing config or create new
    let config: any = {};
    if (await pathExists(configPath)) {
      const content = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(content);
    }

    // Ensure mcpServers key exists
    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    // Convert standardized MCP server configs to GitHub Copilot CLI format
    if (settings.servers) {
      for (const [serverName, serverConfig] of Object.entries(settings.servers)) {
        // Skip disabled servers
        if (serverConfig.disabled) {
          delete config.mcpServers[serverName];
          continue;
        }

        const githubConfig: GitHubCopilotMcpServerConfig = {
          type: serverConfig.type === 'stdio' ? 'local' : serverConfig.type,
          tools: ['*'], // Enable all tools by default
        };

        // Add type-specific fields
        if (serverConfig.type === 'stdio') {
          githubConfig.command = serverConfig.command;
          if (serverConfig.args && serverConfig.args.length > 0) {
            githubConfig.args = serverConfig.args;
          }
          if (serverConfig.env) {
            githubConfig.env = serverConfig.env;
          }
        } else if (serverConfig.type === 'http' || serverConfig.type === 'sse') {
          githubConfig.url = serverConfig.url;
        }

        config.mcpServers[serverName] = githubConfig;
      }
    }

    // Write config back with pretty formatting
    await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  }

  /**
   * Update prompt configuration for GitHub Copilot
   *
   * Writes system prompts to GitHub Copilot custom instruction files:
   *
   * 1. If customInstructionFile is provided:
   *    - Writes prompt to .github/{customInstructionFile}
   *    - Creates reference in .github/copilot-instructions.md using @{file} syntax
   *
   * 2. Otherwise:
   *    - Writes directly to .github/copilot-instructions.md (repository-wide)
   *    - Also appends to AGENTS.md if it exists (for agent instructions)
   *
   * The marker option wraps content with AICODE tracking markers:
   * <!-- AICODE:START --> and <!-- AICODE:END -->
   *
   * @param config - Prompt configuration with systemPrompt and optional customInstructionFile
   * @throws Error if files cannot be written
   */
  async updatePrompt(config: PromptConfig): Promise<void> {
    this.promptConfig = { ...this.promptConfig, ...config };

    if (!config.systemPrompt) {
      return;
    }

    try {
      const copilotInstructionsPath = path.join(
        this.workspaceRoot,
        '.github',
        'copilot-instructions.md',
      );
      const agentsMdPath = path.join(this.workspaceRoot, 'AGENTS.md');

      if (config.customInstructionFile) {
        // Write prompt to custom instruction file in .github directory
        const customFilePath = path.join(
          this.workspaceRoot,
          '.github',
          config.customInstructionFile,
        );
        await writeFileEnsureDir(customFilePath, config.systemPrompt);

        // Reference the file in copilot-instructions.md using @{file} syntax
        const reference = `@{${config.customInstructionFile}}`;

        if (config.marker) {
          // Use AICODE markers to track the reference
          await appendUniqueWithMarkers(
            copilotInstructionsPath,
            reference,
            reference,
            `# GitHub Copilot Repository Instructions\n\n<!-- AICODE:START -->\n${reference}\n<!-- AICODE:END -->\n`,
          );

          // Append reference to AGENTS.md if it exists
          await appendUniqueWithMarkers(agentsMdPath, reference, reference);
        } else {
          // Append reference without markers
          const referenceContent = `\n\n${reference}\n`;
          await appendUniqueToFile(
            copilotInstructionsPath,
            referenceContent,
            reference,
            `# GitHub Copilot Repository Instructions\n${referenceContent}`,
          );

          await appendUniqueToFile(agentsMdPath, referenceContent, reference);
        }
      } else {
        // Append prompt directly to copilot-instructions.md and AGENTS.md
        if (config.marker) {
          // Use AICODE markers to track the prompt content
          await appendUniqueWithMarkers(
            copilotInstructionsPath,
            config.systemPrompt,
            config.systemPrompt,
            `# GitHub Copilot Repository Instructions\n\n<!-- AICODE:START -->\n${config.systemPrompt}\n<!-- AICODE:END -->\n`,
          );

          // Append to AGENTS.md if it exists
          await appendUniqueWithMarkers(agentsMdPath, config.systemPrompt, config.systemPrompt);
        } else {
          // Append prompt without markers
          const promptContent = `\n\n${config.systemPrompt}\n`;

          await appendUniqueToFile(
            copilotInstructionsPath,
            promptContent,
            config.systemPrompt,
            `# GitHub Copilot Repository Instructions\n${promptContent}`,
          );

          await appendUniqueToFile(agentsMdPath, promptContent, config.systemPrompt);
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to update GitHub Copilot prompt configuration: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Invoke GitHub Copilot as an LLM via the copilot CLI
   *
   * Uses programmatic mode: copilot -p "prompt" -s
   *
   * Note: This method uses the CLI's programmatic mode which:
   * - Counts against your monthly premium requests quota
   * - Uses Claude Sonnet 4 by default (can be changed with --model)
   * - No tools are enabled (LLM-only mode)
   * - Requires the 'copilot' CLI to be installed and authenticated
   *
   * @param params - LLM invocation parameters
   * @returns LLM response with content and usage information
   * @throws Error if CLI is not installed, not authenticated, or invocation fails
   */
  async invokeAsLlm(params: LlmInvocationParams): Promise<LlmInvocationResponse> {
    // Check if CLI exists
    try {
      await execa(this.copilotPath, ['--version'], { timeout: 5000 });
    } catch {
      throw new Error(
        `GitHub Copilot CLI not found at path: ${this.copilotPath}. Install it with: npm install -g @github/copilot`,
      );
    }

    try {
      // Build the full prompt with system prompt if available
      let fullPrompt = params.prompt;
      const systemPrompt = this.promptConfig.systemPrompt;
      if (systemPrompt) {
        fullPrompt = `${systemPrompt}\n\n${params.prompt}`;
      }

      // Add JSON schema instructions to prompt if provided
      // GitHub Copilot CLI doesn't have native JSON schema support
      if (params.jsonSchema) {
        const schemaInstructions = `

IMPORTANT: You MUST respond with valid JSON that exactly matches this schema:
${JSON.stringify(params.jsonSchema, null, 2)}

Do NOT include any text before or after the JSON. Do NOT wrap the JSON in markdown code blocks.
Respond with ONLY the raw JSON object.`;
        fullPrompt = `${fullPrompt}${schemaInstructions}`;
      }

      // Build command arguments for programmatic mode (LLM-only, no tools)
      // -s for silent output (response only, no stats)
      const args = ['-p', fullPrompt, '-s'];

      // Execute GitHub Copilot CLI
      const timeout = (params.timeout as number | undefined) || this.defaultTimeout;
      const { stdout, exitCode } = await execa(this.copilotPath, args, {
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe',
        timeout,
        maxBuffer: 1024 * 1024 * 100, // 100MB buffer
        env: process.env,
        cwd: this.workspaceRoot,
      });

      if (exitCode !== 0) {
        throw new Error(`GitHub Copilot CLI process exited with code ${exitCode}`);
      }

      // The CLI outputs the response directly to stdout in programmatic mode
      let responseContent = stdout.trim();

      // If JSON schema was requested, extract and validate JSON from response
      if (params.jsonSchema && responseContent) {
        responseContent = this.extractJsonFromResponse(responseContent);
      }

      // GitHub Copilot CLI doesn't provide token usage in programmatic mode
      // Return with estimated usage (not accurate, just for interface compatibility)
      return {
        content: responseContent,
        model: params.model || 'claude-sonnet-4.5', // Default model
        usage: {
          inputTokens: 0, // Not provided by CLI
          outputTokens: 0, // Not provided by CLI
        },
      };
    } catch (error) {
      // Provide descriptive error messages based on error type
      if (error instanceof Error) {
        if (error.message.includes('ETIMEDOUT') || error.message.includes('timed out')) {
          const timeoutValue = params.timeout as number | undefined;
          throw new Error(
            `GitHub Copilot CLI invocation timed out${timeoutValue ? ` after ${timeoutValue}ms` : ''}. Consider increasing the timeout parameter.`,
          );
        }
        if (error.message.includes('ENOENT')) {
          throw new Error(
            `GitHub Copilot CLI not found at path: ${this.copilotPath}. Ensure GitHub Copilot CLI is installed (gh extension install github/gh-copilot) and authenticated.`,
          );
        }
        if (error.message.includes('exited with code')) {
          throw new Error(
            `GitHub Copilot CLI process failed: ${error.message}. Check CLI authentication and quota limits.`,
          );
        }
        throw new Error(`Failed to invoke GitHub Copilot CLI: ${error.message}`);
      }
      throw new Error(`Failed to invoke GitHub Copilot CLI: ${String(error)}`);
    }
  }

  /**
   * Extract JSON from LLM response that may contain markdown code fences or extra text
   * @private
   */
  private extractJsonFromResponse(content: string): string {
    let cleanedContent = content.trim();

    // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    const codeBlockMatch = cleanedContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      cleanedContent = codeBlockMatch[1].trim();
    }

    // Try to extract JSON object from the response
    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        // Validate it's valid JSON
        JSON.parse(jsonMatch[0]);
        return jsonMatch[0];
      } catch {
        // If parsing fails, return the original content
        return content;
      }
    }

    return content;
  }
}
