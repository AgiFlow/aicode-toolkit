/**
 * CodexService
 *
 * DESIGN PATTERNS:
 * - Class-based service pattern for encapsulating business logic
 * - Interface implementation for dependency injection and testing
 * - Single Responsibility: Manages Codex CLI interactions
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
import * as readline from 'node:readline';
import type {
  LlmInvocationParams,
  LlmInvocationResponse,
  McpSettings,
  PromptConfig,
} from '../types';
import { appendUniqueToFile, appendUniqueWithMarkers, writeFileEnsureDir } from '../utils/file';
import { BaseCodingAgentService } from './BaseCodingAgentService';

/**
 * Internal message types for parsing JSONL output from Codex CLI
 */
interface CodexStreamEvent {
  type:
    | 'thread.started'
    | 'turn.started'
    | 'turn.completed'
    | 'item.started'
    | 'item.updated'
    | 'item.completed';
  /** Item data (for item.completed events) */
  item?: {
    id?: string;
    type?: 'agent_message' | 'reasoning' | 'command_execution';
    text?: string;
  };
  /** Usage data (for turn.completed events) */
  usage?: {
    input_tokens?: number;
    cached_input_tokens?: number;
    output_tokens?: number;
  };
}

interface CodexServiceOptions {
  workspaceRoot?: string;
  codexPath?: string;
  defaultTimeout?: number;
  defaultModel?: string;
  defaultEnv?: Record<string, string>;
  toolConfig?: Record<string, unknown>;
}

/**
 * Service for interacting with Codex CLI as a coding agent
 * Provides standard LLM interface using Codex's exec mode with JSON output
 */
export class CodexService extends BaseCodingAgentService {
  private mcpSettings: McpSettings = {};
  private promptConfig: PromptConfig = {};
  private readonly workspaceRoot: string;
  private readonly codexPath: string;
  private readonly defaultTimeout: number;
  private readonly defaultModel: string;
  private readonly defaultEnv: Record<string, string>;

  constructor(options?: CodexServiceOptions) {
    super({ toolConfig: options?.toolConfig });
    this.workspaceRoot = options?.workspaceRoot || process.cwd();
    this.codexPath = options?.codexPath || 'codex';
    this.defaultTimeout = options?.defaultTimeout || 60000; // 1 minute default
    this.defaultModel = options?.defaultModel || 'gpt-5-1-codex';
    this.defaultEnv = options?.defaultEnv || {
      CODEX_API_KEY: process.env.CODEX_API_KEY || '',
    };
  }

  /**
   * Check if the Codex service is enabled
   * Detects Codex by checking for .codex file in workspace root (project-level only)
   */
  async isEnabled(): Promise<boolean> {
    const codexWorkspaceFile = path.join(this.workspaceRoot, '.codex');
    return pathExists(codexWorkspaceFile);
  }

  /**
   * Update MCP (Model Context Protocol) settings for Codex
   * Writes MCP server configuration to ~/.codex/config.toml
   * Converts standardized McpServerConfig to Codex TOML format
   */
  async updateMcpSettings(settings: McpSettings): Promise<void> {
    this.mcpSettings = { ...this.mcpSettings, ...settings };

    // Codex uses config.toml in ~/.codex directory
    const configDir = path.join(os.homedir(), '.codex');
    const configPath = path.join(configDir, 'config.toml');

    // Ensure config directory exists
    await ensureDir(configDir);

    // Read existing config or create new
    let configContent = '';
    if (await pathExists(configPath)) {
      configContent = await fs.readFile(configPath, 'utf-8');
    }

    // Parse TOML (simple approach - append MCP servers section)
    // For production, consider using a TOML parser library like @iarna/toml
    if (settings.servers) {
      // Remove existing [mcp_servers] section if present
      configContent = configContent.replace(/\[mcp_servers\][\s\S]*?(?=\n\[|\n*$)/, '');

      // Build MCP servers TOML section
      let mcpSection = '\n[mcp_servers]\n';
      for (const [serverName, serverConfig] of Object.entries(settings.servers)) {
        mcpSection += `\n[mcp_servers.${serverName}]\n`;
        mcpSection += `disabled = ${serverConfig.disabled ?? false}\n`;

        if (serverConfig.type === 'stdio') {
          mcpSection += 'type = "stdio"\n';
          mcpSection += `command = "${serverConfig.command}"\n`;
          if (serverConfig.args && serverConfig.args.length > 0) {
            mcpSection += `args = [${serverConfig.args.map((arg) => `"${arg}"`).join(', ')}]\n`;
          }
          if (serverConfig.env) {
            mcpSection += `[mcp_servers.${serverName}.env]\n`;
            for (const [key, value] of Object.entries(serverConfig.env)) {
              mcpSection += `${key} = "${value}"\n`;
            }
          }
        } else if (serverConfig.type === 'http' || serverConfig.type === 'sse') {
          mcpSection += `type = "${serverConfig.type}"\n`;
          mcpSection += `url = "${serverConfig.url}"\n`;
        }
      }

      // Append MCP section to config
      configContent = configContent.trim() + mcpSection;
    }

    // Write config back
    await fs.writeFile(configPath, configContent);
  }

  /**
   * Update prompt configuration for Codex
   *
   * If customInstructionFile is provided, writes the prompt to that file and references it
   * using @file syntax in AGENTS.md (workspace) and instructions.md (global ~/.codex).
   *
   * If marker is true, wraps the content with AICODE tracking markers
   * (<!-- AICODE:START --> and <!-- AICODE:END -->).
   *
   * Otherwise, appends the prompt directly to AGENTS.md and instructions.md.
   */
  async updatePrompt(config: PromptConfig): Promise<void> {
    this.promptConfig = { ...this.promptConfig, ...config };

    if (!config.systemPrompt) {
      return;
    }

    // Codex uses AGENTS.md in workspace root (similar to Claude)
    const agentsMdPath = path.join(this.workspaceRoot, 'AGENTS.md');

    // Codex uses instructions.md in ~/.codex directory for global context
    const codexDir = path.join(os.homedir(), '.codex');
    const instructionsMdPath = path.join(codexDir, 'instructions.md');

    if (config.customInstructionFile) {
      // Write prompt to custom instruction file
      const customFilePath = path.join(this.workspaceRoot, config.customInstructionFile);
      await writeFileEnsureDir(customFilePath, config.systemPrompt);

      // Reference the file in AGENTS.md and instructions.md using @ syntax (without curly braces)
      const reference = `@${config.customInstructionFile}`;

      if (config.marker) {
        // Use AICODE markers to track the reference in AGENTS.md
        await appendUniqueWithMarkers(
          agentsMdPath,
          reference,
          reference,
          `# Codex Instructions\n\n<!-- AICODE:START -->\n${reference}\n<!-- AICODE:END -->\n`,
        );

        // Append reference to instructions.md (global)
        await appendUniqueWithMarkers(instructionsMdPath, reference, reference);
      } else {
        // Append reference without markers
        const referenceContent = `\n\n${reference}\n`;
        await appendUniqueToFile(
          agentsMdPath,
          referenceContent,
          reference,
          `# Codex Instructions\n${referenceContent}`,
        );

        await appendUniqueToFile(instructionsMdPath, referenceContent, reference);
      }
    } else {
      // Append prompt directly to AGENTS.md and instructions.md
      if (config.marker) {
        // Use AICODE markers to track the prompt content
        await appendUniqueWithMarkers(
          agentsMdPath,
          config.systemPrompt,
          config.systemPrompt,
          `# Codex Instructions\n\n<!-- AICODE:START -->\n${config.systemPrompt}\n<!-- AICODE:END -->\n`,
        );

        // Append to instructions.md (global)
        await appendUniqueWithMarkers(instructionsMdPath, config.systemPrompt, config.systemPrompt);
      } else {
        // Append prompt without markers
        const promptContent = `\n\n${config.systemPrompt}\n`;

        await appendUniqueToFile(
          agentsMdPath,
          promptContent,
          config.systemPrompt,
          `# Codex Instructions\n${promptContent}`,
        );

        await appendUniqueToFile(instructionsMdPath, promptContent, config.systemPrompt);
      }
    }
  }

  /**
   * Invoke Codex as an LLM
   * Executes Codex CLI with exec mode and JSON output format
   */
  async invokeAsLlm(params: LlmInvocationParams): Promise<LlmInvocationResponse> {
    // Check if CLI exists
    try {
      await execa(this.codexPath, ['--version'], { timeout: 5000 });
    } catch {
      throw new Error(
        `Codex CLI not found at path: ${this.codexPath}. Install it with: npm install -g @openai/codex`,
      );
    }

    // Build the prompt with optional system prompt
    let fullPrompt = params.prompt;
    const systemPrompt = this.promptConfig.systemPrompt;
    if (systemPrompt) {
      fullPrompt = `${systemPrompt}\n\n${params.prompt}`;
    }

    // Build command arguments for non-interactive LLM invocation
    const args = [
      'exec',
      '--json', // Enable JSON output
      '--skip-git-repo-check', // Allow running outside git repos
      fullPrompt,
    ];

    // Add toolConfig as CLI args (e.g., { model: "gpt-5.2-high" } -> ["--model", "gpt-5.2-high"])
    args.push(...this.buildToolConfigArgs());

    if (params.model) {
      args.push('--model', params.model);
    }

    // Write JSON schema to temp file if provided
    // Use fs.mkdtemp for secure temporary directory creation (atomic, random suffix)
    let schemaTempDir: string | null = null;
    let schemaFilePath: string | null = null;
    if (params.jsonSchema) {
      schemaTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-schema-'));
      schemaFilePath = path.join(schemaTempDir, 'schema.json');
      await fs.writeFile(schemaFilePath, JSON.stringify(params.jsonSchema, null, 2), {
        mode: 0o600,
      });
      args.push('--output-schema', schemaFilePath);
    }

    // Build environment with API key and custom env vars
    const env = {
      ...process.env,
      ...this.defaultEnv,
    };

    // Execute Codex CLI
    const child = execa(this.codexPath, args, {
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: params.maxTokens ? params.maxTokens * 100 : this.defaultTimeout,
      maxBuffer: 1024 * 1024 * 100, // 100MB buffer
      env,
      cwd: this.workspaceRoot,
    });

    // Create readline interface for streaming output
    const rl = readline.createInterface({
      input: child.stdout,
    });

    // Collect response data
    let responseContent = '';
    const model = params.model || this.defaultModel;
    const usage = {
      inputTokens: 0,
      outputTokens: 0,
    };
    let partialData = '';

    try {
      // Process streaming JSONL output
      for await (const line of rl) {
        if (!line.trim()) continue;

        let event: CodexStreamEvent;
        try {
          event = JSON.parse(line);
        } catch {
          // Handle partial JSON by accumulating
          partialData += line;
          try {
            event = JSON.parse(partialData);
            partialData = '';
          } catch {
            continue;
          }
        }

        // Process different event types
        if (event.type === 'item.completed' && event.item) {
          const item = event.item;

          // Extract text content from agent messages
          if (item.type === 'agent_message' && item.text) {
            responseContent += item.text;
          }
        } else if (event.type === 'turn.completed' && event.usage) {
          // Extract usage statistics
          usage.inputTokens = event.usage.input_tokens || 0;
          usage.outputTokens = event.usage.output_tokens || 0;
        }
      }

      // Wait for process to complete
      const { exitCode } = await child;
      if (exitCode !== 0) {
        throw new Error(`Codex process exited with code ${exitCode}`);
      }

      // If JSON schema was requested, extract and validate JSON from response
      let finalContent = responseContent.trim();
      if (params.jsonSchema && finalContent) {
        finalContent = this.extractJsonFromResponse(finalContent);
      }

      // Return standard LLM response
      return {
        content: finalContent,
        model,
        usage: {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        },
      };
    } catch (error) {
      // Clean up on error
      rl.close();
      if (!child.killed) {
        child.kill();
      }

      // Provide descriptive error messages based on error type
      if (error instanceof Error) {
        if (error.message.includes('ETIMEDOUT') || error.message.includes('timed out')) {
          throw new Error(
            `Codex invocation timed out after ${params.maxTokens ? params.maxTokens * 100 : this.defaultTimeout}ms. Consider increasing the timeout or reducing maxTokens.`,
          );
        }
        if (error.message.includes('ENOENT')) {
          throw new Error(
            `Codex CLI not found at path: ${this.codexPath}. Ensure Codex is installed and the path is correct.`,
          );
        }
        if (error.message.includes('exited with code')) {
          throw new Error(`Codex process failed: ${error.message}. Check Codex logs for details.`);
        }
        throw new Error(`Failed to invoke Codex: ${error.message}`);
      }
      throw new Error(`Failed to invoke Codex: ${String(error)}`);
    } finally {
      rl.close();
      // Clean up temp schema directory and file if created
      if (schemaTempDir) {
        try {
          await fs.rm(schemaTempDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
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
