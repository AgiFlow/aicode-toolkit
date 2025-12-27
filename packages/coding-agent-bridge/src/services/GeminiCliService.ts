/**
 * GeminiCliService
 *
 * DESIGN PATTERNS:
 * - Class-based service pattern for encapsulating business logic
 * - Interface implementation for dependency injection and testing
 * - Single Responsibility: Manages Gemini CLI interactions
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
  LlmInvocationParams,
  LlmInvocationResponse,
  McpSettings,
  PromptConfig,
} from '../types';
import { BaseCodingAgentService } from './BaseCodingAgentService';

/**
 * Gemini CLI JSON response format (headless mode)
 * @see https://geminicli.com/docs/cli/headless/#json-output
 */
interface GeminiJsonResponse {
  response?: string;
  stats?: {
    models?: Record<
      string,
      {
        api?: {
          totalRequests?: number;
          totalErrors?: number;
          totalLatencyMs?: number;
        };
        tokens?: {
          prompt?: number;
          candidates?: number;
          total?: number;
          cached?: number;
          thoughts?: number;
          tool?: number;
        };
      }
    >;
    tools?: {
      totalCalls?: number;
      totalSuccess?: number;
      totalFail?: number;
      totalDurationMs?: number;
      totalDecisions?: {
        accept?: number;
        reject?: number;
        modify?: number;
        auto_accept?: number;
      };
      byName?: Record<
        string,
        {
          count?: number;
          success?: number;
          fail?: number;
          durationMs?: number;
          decisions?: {
            accept?: number;
            reject?: number;
            modify?: number;
            auto_accept?: number;
          };
        }
      >;
    };
    files?: {
      totalLinesAdded?: number;
      totalLinesRemoved?: number;
    };
  };
  error?: {
    type?: string;
    message?: string;
    code?: number;
  };
}

/**
 * Gemini CLI extension configuration format
 */
interface GeminiExtensionConfig {
  name: string;
  version: string;
  mcpServers: Record<string, GeminiMcpServerConfig>;
  contextFileName?: string;
  excludeTools?: string[];
}

/**
 * Gemini CLI MCP server configuration
 */
interface GeminiMcpServerConfig {
  disabled?: boolean;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  httpUrl?: string;
  sseUrl?: string;
}

/**
 * Gemini CLI settings.json format
 */
interface GeminiSettingsConfig {
  mcpServers?: Record<string, GeminiMcpServerConfig>;
  [key: string]: unknown;
}

interface GeminiCliServiceOptions {
  workspaceRoot?: string;
  geminiPath?: string;
  toolConfig?: Record<string, unknown>;
}

/**
 * Service for interacting with Gemini CLI as a coding agent
 * Provides standard LLM interface using Gemini's headless mode with JSON output
 */
export class GeminiCliService extends BaseCodingAgentService {
  private mcpSettings: McpSettings = {};
  private promptConfig: PromptConfig = {};
  private readonly workspaceRoot: string;
  private readonly geminiPath: string;

  constructor(options?: GeminiCliServiceOptions) {
    super({ toolConfig: options?.toolConfig });
    this.workspaceRoot = options?.workspaceRoot || process.cwd();
    this.geminiPath = options?.geminiPath || 'gemini';
  }

  /**
   * Check if the Gemini CLI service is enabled
   * Detects Gemini by checking for .gemini file in workspace root (project-level only)
   */
  async isEnabled(): Promise<boolean> {
    try {
      const geminiWorkspaceFile = path.join(this.workspaceRoot, '.gemini');
      return await pathExists(geminiWorkspaceFile);
    } catch (_error) {
      // Return false if unable to check file existence
      return false;
    }
  }

  /**
   * Update MCP (Model Context Protocol) settings for Gemini CLI
   * Supports two modes:
   * 1. Settings mode: Writes to ~/.gemini/settings.json (default)
   * 2. Extension mode: Creates extension in {workspaceRoot}/.gemini/extensions/{extensionName}/
   *
   * Extension mode is recommended for:
   * - Packaging MCP servers with metadata (project-level configuration)
   * - Including context files and custom commands
   * - Better distribution and sharing
   * - Variable substitution support (${extensionPath}, ${workspacePath}, ${/})
   *
   * Settings mode (user-level) takes precedence over extensions (project-level), allowing user overrides
   */
  async updateMcpSettings(
    settings: McpSettings,
    options?: {
      useExtension?: boolean;
      extensionName?: string;
      extensionVersion?: string;
      contextContent?: string;
      excludeTools?: string[];
    },
  ): Promise<void> {
    this.mcpSettings = { ...this.mcpSettings, ...settings };

    if (options?.useExtension) {
      // Extension mode: Create/update Gemini CLI extension
      await this.createOrUpdateExtension(settings, {
        extensionName: options.extensionName || 'aicode-toolkit-mcp',
        extensionVersion: options.extensionVersion || '1.0.0',
        contextContent: options.contextContent,
        excludeTools: options.excludeTools,
      });
    } else {
      // Settings mode: Write to ~/.gemini/settings.json
      await this.updateSettingsJson(settings);
    }
  }

  /**
   * Create or update a Gemini CLI extension with MCP server configuration
   * Extensions are created in workspace root: {workspaceRoot}/.gemini/extensions/{extensionName}/
   *
   * @private
   */
  private async createOrUpdateExtension(
    settings: McpSettings,
    options: {
      extensionName: string;
      extensionVersion: string;
      contextContent?: string;
      excludeTools?: string[];
    },
  ): Promise<void> {
    try {
      const extensionsDir = path.join(this.workspaceRoot, '.gemini', 'extensions');
      const extensionDir = path.join(extensionsDir, options.extensionName);
      const extensionConfigPath = path.join(extensionDir, 'gemini-extension.json');

      // Ensure extension directory exists
      await ensureDir(extensionDir);

      // Build extension configuration
      const extensionConfig: GeminiExtensionConfig = {
        name: options.extensionName,
        version: options.extensionVersion,
        mcpServers: {},
      };

      // Convert standardized MCP server configs to Gemini extension format
      if (settings.servers) {
        for (const [serverName, serverConfig] of Object.entries(settings.servers)) {
          const geminiConfig: GeminiMcpServerConfig = {
            disabled: serverConfig.disabled ?? false,
          };

          // Add type-specific fields
          if (serverConfig.type === 'stdio') {
            geminiConfig.command = serverConfig.command;
            if (serverConfig.args && serverConfig.args.length > 0) {
              geminiConfig.args = serverConfig.args;
            }
            if (serverConfig.env) {
              geminiConfig.env = serverConfig.env;
            }
            // Support for cwd if needed (extended property not in base type)
            if ('cwd' in serverConfig) {
              const cwd = (serverConfig as { cwd?: string }).cwd;
              if (cwd) {
                geminiConfig.cwd = cwd;
              }
            }
          } else if (serverConfig.type === 'http') {
            geminiConfig.httpUrl = serverConfig.url;
          } else if (serverConfig.type === 'sse') {
            geminiConfig.sseUrl = serverConfig.url;
          }

          extensionConfig.mcpServers[serverName] = geminiConfig;
        }
      }

      // Add optional context file
      if (options.contextContent) {
        extensionConfig.contextFileName = 'GEMINI.md';
        const contextPath = path.join(extensionDir, 'GEMINI.md');
        await fs.writeFile(contextPath, options.contextContent);
      }

      // Add optional tool exclusions
      if (options.excludeTools && options.excludeTools.length > 0) {
        extensionConfig.excludeTools = options.excludeTools;
      }

      // Write extension config with pretty formatting
      await fs.writeFile(extensionConfigPath, `${JSON.stringify(extensionConfig, null, 2)}\n`);
    } catch (error) {
      throw new Error(
        `Failed to create or update Gemini CLI extension: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Update MCP settings in ~/.gemini/settings.json
   * Settings take precedence over extensions
   *
   * @private
   */
  private async updateSettingsJson(settings: McpSettings): Promise<void> {
    try {
      const configDir = path.join(os.homedir(), '.gemini');
      const configPath = path.join(configDir, 'settings.json');

      // Ensure config directory exists
      await ensureDir(configDir);

      // Read existing config or create new
      let config: GeminiSettingsConfig = {};
      if (await pathExists(configPath)) {
        const content = await fs.readFile(configPath, 'utf-8');
        config = JSON.parse(content);
      }

      // Ensure mcpServers key exists
      if (!config.mcpServers) {
        config.mcpServers = {};
      }

      // Convert standardized MCP server configs to Gemini CLI format
      if (settings.servers) {
        for (const [serverName, serverConfig] of Object.entries(settings.servers)) {
          const geminiConfig: GeminiMcpServerConfig = {
            disabled: serverConfig.disabled ?? false,
          };

          // Add type-specific fields
          if (serverConfig.type === 'stdio') {
            geminiConfig.command = serverConfig.command;
            if (serverConfig.args && serverConfig.args.length > 0) {
              geminiConfig.args = serverConfig.args;
            }
            if (serverConfig.env) {
              geminiConfig.env = serverConfig.env;
            }
          } else if (serverConfig.type === 'http') {
            geminiConfig.httpUrl = serverConfig.url;
          } else if (serverConfig.type === 'sse') {
            geminiConfig.sseUrl = serverConfig.url;
          }

          config.mcpServers[serverName] = geminiConfig;
        }
      }

      // Write config back with pretty formatting
      await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
    } catch (error) {
      throw new Error(
        `Failed to update Gemini CLI settings.json: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Update prompt configuration for Gemini CLI
   * Supports two modes:
   * 1. Extension mode: Creates/updates extension with contextFileName (recommended)
   * 2. In-memory mode: Stores system prompt for runtime use
   *
   * Extension mode writes context to {workspaceRoot}/.gemini/extensions/{extensionName}/GEMINI.md
   */
  async updatePrompt(
    config: PromptConfig,
    options?: {
      useExtension?: boolean;
      extensionName?: string;
      extensionVersion?: string;
    },
  ): Promise<void> {
    this.promptConfig = { ...this.promptConfig, ...config };

    if (options?.useExtension && config.systemPrompt) {
      try {
        // Extension mode: Create/update extension with context file
        const extensionsDir = path.join(this.workspaceRoot, '.gemini', 'extensions');
        const extensionDir = path.join(
          extensionsDir,
          options.extensionName || 'aicode-toolkit-mcp',
        );
        const extensionConfigPath = path.join(extensionDir, 'gemini-extension.json');
        const contextPath = path.join(extensionDir, 'GEMINI.md');

        // Ensure extension directory exists
        await ensureDir(extensionDir);

        // Read or create extension config
        let extensionConfig: GeminiExtensionConfig = {
          name: options.extensionName || 'aicode-toolkit-mcp',
          version: options.extensionVersion || '1.0.0',
          mcpServers: {},
        };

        if (await pathExists(extensionConfigPath)) {
          const content = await fs.readFile(extensionConfigPath, 'utf-8');
          extensionConfig = JSON.parse(content);
        }

        // Set context file reference
        extensionConfig.contextFileName = 'GEMINI.md';

        // Write context content
        await fs.writeFile(contextPath, config.systemPrompt);

        // Write extension config
        await fs.writeFile(extensionConfigPath, `${JSON.stringify(extensionConfig, null, 2)}\n`);
      } catch (error) {
        throw new Error(
          `Failed to update Gemini CLI prompt configuration: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    // Otherwise, systemPrompt is stored in memory and used in invokeAsLlm
  }

  /**
   * Invoke Gemini CLI as an LLM
   * Executes Gemini CLI with headless mode and JSON output format
   */
  async invokeAsLlm(params: LlmInvocationParams): Promise<LlmInvocationResponse> {
    // Check if CLI exists (pass env to ensure PATH includes nvm/fnm paths)
    try {
      await execa(this.geminiPath, ['--version'], { timeout: 5000, env: process.env });
    } catch {
      throw new Error(
        `Gemini CLI not found at path: ${this.geminiPath}. Install it with: npm install -g @google/gemini-cli`,
      );
    }

    // Build the prompt with optional system prompt and JSON schema
    let fullPrompt = params.prompt;
    const systemPrompt = this.promptConfig.systemPrompt;
    if (systemPrompt) {
      fullPrompt = `${systemPrompt}\n\n${params.prompt}`;
    }

    // For Gemini, include JSON schema in prompt since CLI doesn't support native schema validation
    if (params.jsonSchema) {
      const schemaInstructions = `\n\nIMPORTANT: You MUST respond with valid JSON that exactly matches this JSON Schema. Do NOT wrap the JSON in markdown code fences. Output ONLY the JSON object, nothing else.\n\nJSON Schema:\n${JSON.stringify(params.jsonSchema, null, 2)}`;
      fullPrompt = `${fullPrompt}${schemaInstructions}`;
    }

    // Build command arguments for non-interactive LLM invocation (no tools)
    const args = [
      fullPrompt, // Positional argument for prompt
      '--output-format',
      'json',
      '--sandbox', // Run in sandbox mode to prevent tool usage
      '--yolo', // Enables OAuth auth with --sandbox (avoids GEMINI_API_KEY requirement)
    ];

    // Add toolConfig merged with defaults as CLI args
    // toolConfig values take precedence over defaults
    args.push(
      ...this.buildToolConfigArgs({
        model: params.model || 'gemini-3-pro-preview', // Default model for better JSON adherence
      }),
    );

    // Execute Gemini CLI
    try {
      const timeout = (params.timeout as number | undefined) || 120000; // 2 minutes default
      const { stdout, exitCode } = await execa(this.geminiPath, args, {
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe',
        timeout,
        maxBuffer: 1024 * 1024 * 100, // 100MB buffer
        env: process.env,
        cwd: this.workspaceRoot,
      });

      if (exitCode !== 0) {
        throw new Error(`Gemini CLI process exited with code ${exitCode}`);
      }

      // Parse JSON response
      const jsonResponse: GeminiJsonResponse = JSON.parse(stdout);

      // Check for errors in response
      if (jsonResponse.error) {
        throw new Error(
          `Gemini CLI error: ${jsonResponse.error.message || 'Unknown error'} (${jsonResponse.error.type || 'unknown'})`,
        );
      }

      // Extract response content
      let responseContent = jsonResponse.response || '';

      // If JSON schema was requested, extract and validate JSON from response
      if (params.jsonSchema && responseContent) {
        responseContent = this.extractJsonFromResponse(responseContent);
      }

      // Determine which model was used from stats (first model in the list)
      const usedModel = jsonResponse.stats?.models
        ? Object.keys(jsonResponse.stats.models)[0]
        : params.model || 'gemini-3-pro-preview';

      // Extract token usage from stats.models
      // Sum up tokens from all models used in the request
      let totalPromptTokens = 0;
      let totalCandidateTokens = 0;

      if (jsonResponse.stats?.models) {
        for (const modelStats of Object.values(jsonResponse.stats.models)) {
          totalPromptTokens += modelStats.tokens?.prompt || 0;
          totalCandidateTokens += modelStats.tokens?.candidates || 0;
        }
      }

      // Return standard LLM response
      return {
        content: responseContent.trim(),
        model: usedModel,
        usage: {
          inputTokens: totalPromptTokens,
          outputTokens: totalCandidateTokens,
        },
      };
    } catch (error) {
      // Provide descriptive error messages based on error type
      if (error instanceof Error) {
        if (error.message.includes('ETIMEDOUT') || error.message.includes('timed out')) {
          throw new Error(
            `Gemini CLI invocation timed out${params.timeout ? ` after ${params.timeout}ms` : ''}. Consider increasing the timeout parameter.`,
          );
        }
        if (error.message.includes('ENOENT')) {
          throw new Error(
            `Gemini CLI not found at path: ${this.geminiPath}. Ensure Gemini CLI is installed and the path is correct.`,
          );
        }
        if (error.message.includes('exited with code')) {
          throw new Error(
            `Gemini CLI process failed: ${error.message}. Check Gemini CLI logs for details.`,
          );
        }
        if (error.message.includes('Unexpected token')) {
          throw new Error(
            `Failed to parse Gemini CLI JSON response: ${error.message}. The output may not be in JSON format.`,
          );
        }
        throw new Error(`Failed to invoke Gemini CLI: ${error.message}`);
      }
      throw new Error(`Failed to invoke Gemini CLI: ${String(error)}`);
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
