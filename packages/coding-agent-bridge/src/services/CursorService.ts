/**
 * CursorService
 *
 * DESIGN PATTERNS:
 * - Class-based service pattern for encapsulating business logic
 * - Interface implementation for dependency injection and testing
 * - Single Responsibility: Manages Cursor IDE interactions
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
import { appendUniqueToFile, appendUniqueWithMarkers } from '../utils/file';

/**
 * Cursor MCP server configuration format
 * Configured in ~/.cursor/mcp.json or workspace .cursor/mcp.json
 */
interface CursorMcpConfig {
  mcpServers: Record<string, CursorMcpServerConfig>;
}

/**
 * Cursor MCP server configuration
 * Supports stdio (local) servers
 */
interface CursorMcpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * Service for integrating with Cursor IDE
 *
 * Cursor is a fork of VS Code with AI-first features and supports:
 *
 * 1. **MCP Configuration** (~/.cursor/mcp.json or .cursor/mcp.json):
 *    - Stdio-based MCP servers only
 *    - JSON format: { "mcpServers": { "name": { "command": "...", "args": [...] } } }
 *    - Can be configured globally (~/.cursor/mcp.json) or per-workspace
 *
 * 2. **Cursor Rules** (.cursor/rules/<project-name>.md):
 *    - Custom instructions for AI behavior
 *    - Supports frontmatter with applyTo glob patterns
 *    - Applied to all AI interactions in the IDE
 *    - Multiple rule files can be placed in .cursor/rules/ directory
 *    - Format:
 *      ---
 *      applyTo: "**"
 *      ---
 *      Rule content here
 *
 * 3. **Direct link installation**:
 *    - cursor://anysphere.cursor-deeplink/mcp/install?name=X&config=BASE64
 *    - Allows one-click MCP server installation
 *
 * Note: Cursor does not provide a CLI for LLM invocation. It operates through:
 * - IDE interface (chat panel, inline editing, composer)
 * - No programmatic API for external invocation
 *
 * @see https://docs.snyk.io/integrations/developer-guardrails-for-agentic-workflows/quickstart-guides-for-mcp/cursor-guide
 * @see https://docs.cursor.com/en/context/rules (if available)
 */
export class CursorService implements CodingAgentService {
  private mcpSettings: McpSettings = {};
  private promptConfig: PromptConfig = {};
  private readonly workspaceRoot: string;

  constructor(options?: { workspaceRoot?: string }) {
    this.workspaceRoot = options?.workspaceRoot || process.cwd();
  }

  /**
   * Check if Cursor is enabled
   * Detects by checking for .cursor directory or .cursor/rules directory in workspace root
   */
  async isEnabled(): Promise<boolean> {
    try {
      const cursorDir = path.join(this.workspaceRoot, '.cursor');
      const cursorRulesDir = path.join(this.workspaceRoot, '.cursor', 'rules');

      const hasCursorDir = await pathExists(cursorDir);
      const hasCursorRulesDir = await pathExists(cursorRulesDir);

      return hasCursorDir || hasCursorRulesDir;
    } catch (error) {
      // Handle file system errors gracefully
      if (error instanceof Error) {
        // Log specific error types that might need attention
        if (error.message.includes('EACCES') || error.message.includes('EPERM')) {
          console.warn(
            `Cursor detection warning: Permission denied accessing workspace at ${this.workspaceRoot}`,
          );
        }
      }
      return false;
    }
  }

  /**
   * Update MCP (Model Context Protocol) settings for Cursor
   *
   * Supports two configuration modes:
   *
   * 1. **Global Mode** (default): Writes to ~/.cursor/mcp.json
   *    - Applies to all Cursor workspaces
   *    - Survives workspace changes
   *
   * 2. **Workspace Mode**: Writes to {workspaceRoot}/.cursor/mcp.json
   *    - Applies only to current workspace
   *    - Can override global settings
   *
   * @param settings - MCP server configurations
   * @param options - Configuration options
   * @param options.useWorkspaceConfig - If true, writes to workspace .cursor/mcp.json instead of global config
   * @throws Error if configuration cannot be written
   */
  async updateMcpSettings(
    settings: McpSettings,
    options?: {
      useWorkspaceConfig?: boolean;
    },
  ): Promise<void> {
    this.mcpSettings = { ...this.mcpSettings, ...settings };

    try {
      const configDir = options?.useWorkspaceConfig
        ? path.join(this.workspaceRoot, '.cursor')
        : path.join(os.homedir(), '.cursor');

      const configPath = path.join(configDir, 'mcp.json');

      // Ensure config directory exists
      await ensureDir(configDir);

      // Read existing config or create new
      let config: CursorMcpConfig = { mcpServers: {} };
      if (await pathExists(configPath)) {
        const content = await fs.readFile(configPath, 'utf-8');
        config = JSON.parse(content);
      }

      // Ensure mcpServers key exists
      if (!config.mcpServers) {
        config.mcpServers = {};
      }

      // Convert standardized MCP server configs to Cursor format
      if (settings.servers) {
        for (const [serverName, serverConfig] of Object.entries(settings.servers)) {
          // Skip disabled servers
          if (serverConfig.disabled) {
            delete config.mcpServers[serverName];
            continue;
          }

          // Cursor only supports stdio servers
          if (serverConfig.type !== 'stdio') {
            console.warn(
              `Cursor MCP: Skipping server '${serverName}' - Cursor only supports stdio servers, got ${serverConfig.type}`,
            );
            continue;
          }

          const cursorConfig: CursorMcpServerConfig = {
            command: serverConfig.command || '',
          };

          if (serverConfig.args && serverConfig.args.length > 0) {
            cursorConfig.args = serverConfig.args;
          }

          if (serverConfig.env) {
            cursorConfig.env = serverConfig.env;
          }

          config.mcpServers[serverName] = cursorConfig;
        }
      }

      // Write config back with pretty formatting
      await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
    } catch (error) {
      throw new Error(
        `Failed to update Cursor MCP configuration: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Update prompt configuration for Cursor
   *
   * Writes system prompts to Cursor rules file at .cursor/rules/<project-name>.md
   *
   * Cursor rules support:
   * - Frontmatter with applyTo glob patterns
   * - Global rules (applyTo: "**")
   * - File-specific rules (applyTo: "*.ts")
   * - Multiple rule files in .cursor/rules/ directory
   *
   * If marker is true, wraps content with AICODE tracking markers.
   *
   * @param config - Prompt configuration with systemPrompt
   * @param options - Configuration options
   * @param options.applyTo - Glob pattern for rule application (default: "**" for all files)
   * @param options.filename - Custom filename for the rules file (default: derived from workspace name)
   * @throws Error if rules file cannot be written
   */
  async updatePrompt(
    config: PromptConfig,
    options?: {
      applyTo?: string;
      filename?: string;
    },
  ): Promise<void> {
    this.promptConfig = { ...this.promptConfig, ...config };

    if (!config.systemPrompt) {
      return;
    }

    try {
      const rulesDir = path.join(this.workspaceRoot, '.cursor', 'rules');

      // Derive filename from workspace name if not provided
      const workspaceName = path.basename(this.workspaceRoot);
      const filename = options?.filename || `${workspaceName}.md`;
      const rulesPath = path.join(rulesDir, filename);

      // Ensure .cursor/rules directory exists
      await ensureDir(rulesDir);

      // Build frontmatter
      const applyTo = options?.applyTo || '**';
      const frontmatter = `---\napplyTo: "${applyTo}"\n---\n\n`;

      // Build content with frontmatter
      const contentWithFrontmatter = `${frontmatter}${config.systemPrompt}`;

      if (config.marker) {
        // Use AICODE markers to track the prompt content
        await appendUniqueWithMarkers(
          rulesPath,
          contentWithFrontmatter,
          config.systemPrompt,
          `${frontmatter}# Cursor Rules\n\n<!-- AICODE:START -->\n${config.systemPrompt}\n<!-- AICODE:END -->\n`,
        );
      } else {
        // Append prompt without markers
        const promptContent = `\n\n${contentWithFrontmatter}\n`;

        await appendUniqueToFile(
          rulesPath,
          promptContent,
          config.systemPrompt,
          `${frontmatter}# Cursor Rules\n${config.systemPrompt}\n`,
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to update Cursor prompt configuration: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Invoke Cursor as an LLM
   *
   * NOTE: Cursor does not provide a CLI interface for LLM invocation.
   * This method is not implemented as Cursor operates through:
   *
   * 1. IDE interface (chat panel, Cmd+K, Cmd+L composer)
   * 2. Inline editing and code completion
   * 3. No programmatic API for external invocation
   *
   * For programmatic access, consider using:
   * - Claude API directly (Cursor uses Claude models)
   * - OpenAI API (Cursor supports GPT models)
   * - Other AI coding tools with CLI support (Claude Code, Codex CLI, etc.)
   *
   * @throws Error indicating this operation is not supported
   */
  async invokeAsLlm(_params: LlmInvocationParams): Promise<LlmInvocationResponse> {
    throw new Error(
      'Failed to invoke Cursor as LLM: Cursor does not support direct LLM invocation via CLI. ' +
        'Use Cursor through the IDE interface (chat panel, Cmd+K for inline edit, Cmd+L for composer) ' +
        'or consider using Claude API, OpenAI API, or other CLI-based coding agents.',
    );
  }
}
