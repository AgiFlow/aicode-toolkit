/**
 * ClaudeCodeService
 *
 * DESIGN PATTERNS:
 * - Class-based service pattern for encapsulating business logic
 * - Interface implementation for dependency injection and testing
 * - Single Responsibility: Manages Claude Code CLI interactions
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
import * as path from 'node:path';
import { pathExists } from '@agiflowai/aicode-utils';
import * as readline from 'node:readline';
import { v4 as uuidv4 } from 'uuid';
import type {
  LlmInvocationParams,
  LlmInvocationResponse,
  McpSettings,
  PromptConfig,
} from '../types';
import { appendUniqueToFile, appendUniqueWithMarkers, writeFileEnsureDir } from '../utils/file';
import { BaseCodingAgentService } from './BaseCodingAgentService';

/**
 * Internal message types for parsing stream-json output from Claude Code CLI
 */
interface ClaudeStreamMessage {
  type: 'system' | 'assistant' | 'user' | 'result';
  message?: {
    id?: string;
    model?: string;
    content?: Array<{
      type: 'text' | 'tool_use';
      text?: string;
      /** Tool use fields for structured output */
      name?: string;
      input?: Record<string, unknown>;
    }>;
    stop_reason?: string | null;
    usage?: {
      input_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
      output_tokens: number;
    };
  };
  model?: string;
  session_id?: string;
  duration_ms?: number;
  total_cost_usd?: number;
  usage?: any;
  /** Structured output from JSON schema (in result message) */
  structured_output?: Record<string, unknown>;
}

/**
 * Claude Code built-in tools that should be disallowed for LLM-only mode
 */
const CLAUDE_CODE_BUILTIN_TOOLS = [
  'Task',
  'Bash',
  'Glob',
  'Grep',
  'LS',
  'exit_plan_mode',
  'Read',
  'Edit',
  'MultiEdit',
  'Write',
  'NotebookRead',
  'NotebookEdit',
  'WebFetch',
  'TodoRead',
  'TodoWrite',
  'WebSearch',
].join(',');

interface ClaudeCodeServiceOptions {
  workspaceRoot?: string;
  claudePath?: string;
  defaultTimeout?: number;
  defaultModel?: string;
  defaultEnv?: Record<string, string>;
  toolConfig?: Record<string, unknown>;
}

/**
 * Service for interacting with Claude Code CLI as a coding agent
 * Provides standard LLM interface using Claude Code's stream-json output format
 */
export class ClaudeCodeService extends BaseCodingAgentService {
  private mcpSettings: McpSettings = {};
  private promptConfig: PromptConfig = {};
  private readonly workspaceRoot: string;
  private readonly claudePath: string;
  private readonly defaultTimeout: number;
  private readonly defaultModel: string;
  private readonly defaultEnv: Record<string, string>;

  constructor(options?: ClaudeCodeServiceOptions) {
    super({ toolConfig: options?.toolConfig });
    this.workspaceRoot = options?.workspaceRoot || process.cwd();
    this.claudePath = options?.claudePath || 'claude';
    this.defaultTimeout = options?.defaultTimeout || 60000; // 1 minute default
    this.defaultModel = options?.defaultModel || 'claude-sonnet-4-5';
    this.defaultEnv = options?.defaultEnv || {
      DISABLE_TELEMETRY: '1',
      DISABLE_AUTOUPDATER: '1',
      IS_SANDBOX: '1',
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    };
  }

  /**
   * Check if the Claude Code service is enabled
   * Detects Claude Code by checking for .claude folder or CLAUDE.md file in workspace root
   */
  async isEnabled(): Promise<boolean> {
    const claudeFolder = path.join(this.workspaceRoot, '.claude');
    const claudeMdFile = path.join(this.workspaceRoot, 'CLAUDE.md');

    const hasClaude = await pathExists(claudeFolder);
    const hasClaudeMd = await pathExists(claudeMdFile);

    return hasClaude || hasClaudeMd;
  }

  /**
   * Update MCP (Model Context Protocol) settings for Claude Code
   * Writes MCP server configuration to .mcp.json in workspace root
   * Converts standardized McpServerConfig to Claude Code format
   */
  async updateMcpSettings(settings: McpSettings): Promise<void> {
    this.mcpSettings = { ...this.mcpSettings, ...settings };

    // Claude Code uses .mcp.json in workspace root
    const configPath = path.join(this.workspaceRoot, '.mcp.json');

    // Read or create config
    let config: any = {};
    if (await pathExists(configPath)) {
      const content = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(content);
    }

    // Ensure mcpServers key exists
    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    // Convert standardized MCP server configs to Claude Code format
    if (settings.servers) {
      for (const [serverName, serverConfig] of Object.entries(settings.servers)) {
        const claudeConfig: any = {
          type: serverConfig.type,
          disabled: serverConfig.disabled ?? false,
        };

        // Add type-specific fields
        if (serverConfig.type === 'stdio') {
          claudeConfig.command = serverConfig.command;
          claudeConfig.args = serverConfig.args;
          if (serverConfig.env) {
            claudeConfig.env = serverConfig.env;
          }
        } else if (serverConfig.type === 'http' || serverConfig.type === 'sse') {
          claudeConfig.url = serverConfig.url;
        }

        config.mcpServers[serverName] = claudeConfig;
      }
    }

    // Write config back with pretty formatting
    await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  }

  /**
   * Update prompt configuration
   *
   * If customInstructionFile is provided, writes the prompt to that file and references it
   * using @file syntax in CLAUDE.md and AGENTS.md.
   *
   * If marker is true, wraps the content with AICODE tracking markers
   * (<!-- AICODE:START --> and <!-- AICODE:END -->).
   *
   * Otherwise, appends the prompt directly to CLAUDE.md and AGENTS.md.
   */
  async updatePrompt(config: PromptConfig): Promise<void> {
    this.promptConfig = { ...this.promptConfig, ...config };

    if (!config.systemPrompt) {
      return;
    }

    const claudeMdPath = path.join(this.workspaceRoot, 'CLAUDE.md');
    const agentsMdPath = path.join(this.workspaceRoot, 'AGENTS.md');

    if (config.customInstructionFile) {
      // Write prompt to custom instruction file
      const customFilePath = path.join(this.workspaceRoot, config.customInstructionFile);
      await writeFileEnsureDir(customFilePath, config.systemPrompt);

      // Reference the file in CLAUDE.md and AGENTS.md using @ syntax (without curly braces)
      const reference = `@${config.customInstructionFile}`;

      if (config.marker) {
        // Use AICODE markers to track the reference
        await appendUniqueWithMarkers(
          claudeMdPath,
          reference,
          reference,
          `# Claude Code Instructions\n\n<!-- AICODE:START -->\n${reference}\n<!-- AICODE:END -->\n`,
        );

        // Append reference to AGENTS.md if it exists
        await appendUniqueWithMarkers(agentsMdPath, reference, reference);
      } else {
        // Append reference without markers
        const referenceContent = `\n\n${reference}\n`;
        await appendUniqueToFile(
          claudeMdPath,
          referenceContent,
          reference,
          `# Claude Code Instructions\n${referenceContent}`,
        );

        await appendUniqueToFile(agentsMdPath, referenceContent, reference);
      }
    } else {
      // Append prompt directly to CLAUDE.md and AGENTS.md
      if (config.marker) {
        // Use AICODE markers to track the prompt content
        await appendUniqueWithMarkers(
          claudeMdPath,
          config.systemPrompt,
          config.systemPrompt,
          `# Claude Code Instructions\n\n<!-- AICODE:START -->\n${config.systemPrompt}\n<!-- AICODE:END -->\n`,
        );

        // Append to AGENTS.md if it exists
        await appendUniqueWithMarkers(agentsMdPath, config.systemPrompt, config.systemPrompt);
      } else {
        // Append prompt without markers
        const promptContent = `\n\n${config.systemPrompt}\n`;

        await appendUniqueToFile(
          claudeMdPath,
          promptContent,
          config.systemPrompt,
          `# Claude Code Instructions\n${promptContent}`,
        );

        await appendUniqueToFile(agentsMdPath, promptContent, config.systemPrompt);
      }
    }
  }

  /**
   * Invoke Claude Code as an LLM
   * Executes Claude Code CLI with stream-json output format
   */
  async invokeAsLlm(params: LlmInvocationParams): Promise<LlmInvocationResponse> {
    // Check if CLI exists
    try {
      await execa(this.claudePath, ['--version'], { timeout: 5000 });
    } catch {
      throw new Error(
        `Claude Code CLI not found at path: ${this.claudePath}. Install it with: npm install -g @anthropic-ai/claude-code`,
      );
    }

    const sessionId = uuidv4();

    // Build command arguments for single-turn LLM invocation
    const args = [
      '--max-turns',
      '0',
      '--output-format',
      'stream-json',
      '--verbose',
      '--session-id',
      sessionId,
      '--disallowedTools',
      CLAUDE_CODE_BUILTIN_TOOLS,
    ];

    // Add toolConfig as CLI args (e.g., { model: "claude-opus-4" } -> ["--model", "claude-opus-4"])
    args.push(...this.buildToolConfigArgs());

    if (params.model) {
      args.push('--model', params.model);
    }

    // Apply system prompt from params (priority) or promptConfig (fallback)
    const systemPrompt = params.systemPrompt ?? this.promptConfig.systemPrompt;
    if (systemPrompt) {
      args.push('--system-prompt', systemPrompt);
    }

    // Apply JSON schema for structured output validation
    if (params.jsonSchema) {
      args.push('--json-schema', JSON.stringify(params.jsonSchema));
    }

    // Execute Claude CLI
    const child = execa(this.claudePath, args, {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: params.maxTokens ? params.maxTokens * 100 : this.defaultTimeout,
      maxBuffer: 1024 * 1024 * 100, // 100MB buffer
      env: {
        ...process.env,
        ...this.defaultEnv,
        ...(params.maxTokens && {
          CLAUDE_CODE_MAX_OUTPUT_TOKENS: params.maxTokens.toString(),
        }),
      },
    });

    // Write prompt to stdin and close it
    child.stdin?.write(params.prompt);
    child.stdin?.end();

    // Create readline interface for streaming output
    const rl = readline.createInterface({
      input: child.stdout,
    });

    // Collect response data
    let responseContent = '';
    let structuredOutput: Record<string, unknown> | null = null;
    let model = params.model || this.defaultModel;
    const usage = {
      inputTokens: 0,
      outputTokens: 0,
    };
    let partialData = '';

    try {
      // Process streaming JSON output
      for await (const line of rl) {
        if (!line.trim()) continue;

        let message: ClaudeStreamMessage;
        try {
          message = JSON.parse(line);
        } catch {
          // Handle partial JSON by accumulating
          partialData += line;
          try {
            message = JSON.parse(partialData);
            partialData = '';
          } catch {
            continue;
          }
        }

        // Process different message types
        if (message.type === 'system' && message.model) {
          model = message.model;
        } else if (message.type === 'assistant' && message.message) {
          // Extract text content and structured output from assistant messages
          for (const content of message.message.content || []) {
            if (content.type === 'text' && content.text) {
              responseContent += content.text;
            } else if (
              content.type === 'tool_use' &&
              content.name === 'StructuredOutput' &&
              content.input
            ) {
              // Extract structured output from StructuredOutput tool use
              structuredOutput = content.input;
            }
          }

          // Update usage stats
          if (message.message.usage) {
            usage.inputTokens = message.message.usage.input_tokens || 0;
            usage.outputTokens = message.message.usage.output_tokens || 0;
          }
        } else if (message.type === 'result') {
          // Final result with usage info and structured output
          if (message.usage) {
            usage.inputTokens = message.usage.input_tokens || usage.inputTokens;
            usage.outputTokens = message.usage.output_tokens || usage.outputTokens;
          }
          // Extract structured output from result (most reliable source)
          if (message.structured_output) {
            structuredOutput = message.structured_output;
          }
        }
      }

      // Wait for process to complete
      const { exitCode } = await child;
      if (exitCode !== 0) {
        throw new Error(`Claude Code process exited with code ${exitCode}`);
      }

      // Return standard LLM response
      // If structured output was requested and received, return it as JSON string
      const content = structuredOutput ? JSON.stringify(structuredOutput) : responseContent.trim();

      return {
        content,
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
            `Claude Code invocation timed out after ${params.maxTokens ? params.maxTokens * 100 : this.defaultTimeout}ms. Consider increasing the timeout or reducing maxTokens.`,
          );
        }
        if (error.message.includes('ENOENT')) {
          throw new Error(
            `Claude Code CLI not found at path: ${this.claudePath}. Ensure Claude Code is installed and the path is correct.`,
          );
        }
        if (error.message.includes('exited with code')) {
          throw new Error(
            `Claude Code process failed: ${error.message}. Check Claude Code logs for details.`,
          );
        }
        throw new Error(`Failed to invoke Claude Code: ${error.message}`);
      }
      throw new Error(`Failed to invoke Claude Code: ${String(error)}`);
    } finally {
      rl.close();
    }
  }
}
