/**
 * Hook Command
 *
 * DESIGN PATTERNS:
 * - Command pattern with Commander for CLI argument parsing
 * - Async/await pattern for asynchronous operations
 * - Error handling pattern with try-catch and proper exit codes
 *
 * CODING STANDARDS:
 * - Use async action handlers for asynchronous operations
 * - Provide clear option descriptions and default values
 * - Handle errors gracefully with process.exit()
 * - Log progress and errors to console
 * - Use Commander's .option() for inputs
 *
 * AVOID:
 * - Synchronous blocking operations in action handlers
 * - Missing error handling (always use try-catch)
 * - Hardcoded values (use options or environment variables)
 * - Not exiting with appropriate exit codes on errors
 */

import {
  CLAUDE_CODE,
  GEMINI_CLI,
  SUPPORTED_LLM_TOOLS,
  isValidLlmTool,
} from '@agiflowai/coding-agent-bridge';
import type { HookAgentConfig, HookConfig } from '@agiflowai/aicode-utils';
import {
  ClaudeCodeAdapter,
  GeminiCliAdapter,
  parseHookType,
  type ClaudeCodeHookInput,
  type GeminiCliHookInput,
  type HookResponse,
} from '@agiflowai/hooks-adapter';
import { TemplatesManagerService, print } from '@agiflowai/aicode-utils';
import { Command } from 'commander';

/** Options parsed by Commander for the hook command */
interface HookOptions {
  type?: string;
  marker?: string;
  fallbackTool?: string;
  fallbackToolConfig?: string;
}

/** Adapter config shape passed to executeMultiple */
interface HookAdapterConfig {
  tool_config?: Record<string, unknown>;
  llm_tool?: string;
}

/** Type guard to validate parsed JSON is a record object */
function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Type for Claude Code hook callback function */
type ClaudeCodeHookCallback = (context: ClaudeCodeHookInput) => Promise<HookResponse>;

/** Type for Gemini CLI hook callback function */
type GeminiCliHookCallback = (context: GeminiCliHookInput) => Promise<HookResponse>;

/** Interface for class-based hook with lifecycle methods */
interface HookClass<T> {
  preToolUse?: (context: T) => Promise<HookResponse>;
  postToolUse?: (context: T) => Promise<HookResponse>;
  stop?: (context: T) => Promise<HookResponse>;
  userPromptSubmit?: (context: T) => Promise<HookResponse>;
  taskCompleted?: (context: T) => Promise<HookResponse>;
}

/** Interface for Claude Code hook module exports */
interface ClaudeCodeHookModule {
  UseScaffoldMethodHook?: new () => HookClass<ClaudeCodeHookInput>;
  PhantomCodeCheckHook?: new (marker: string) => HookClass<ClaudeCodeHookInput>;
}

/** Interface for Gemini CLI hook module exports */
interface GeminiCliHookModule {
  UseScaffoldMethodHook?: new () => HookClass<GeminiCliHookInput>;
}

/** Type guard for valid scaffold hook method keys */
function isHookMethod(key: string): key is keyof HookClass<unknown> {
  return ['preToolUse', 'postToolUse', 'stop', 'userPromptSubmit', 'taskCompleted'].includes(key);
}

/**
 * Parse a JSON config string. Returns undefined for empty input, throws on invalid JSON or non-object.
 */
function parseJsonConfigOption(
  value: string | undefined,
  flagName: string,
): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecordObject(parsed)) {
      throw new Error(`${flagName} must be a JSON object, not an array or primitive value`);
    }
    return parsed;
  } catch (error) {
    throw new Error(
      `Invalid JSON for ${flagName}. Expected format: '{"key":"value"}'. Parse error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Hook command for executing scaffold hooks
 */
export const hookCommand = new Command('hook')
  .description('Execute scaffold hooks for AI agent integrations')
  .option(
    '--type <agentAndMethod>',
    'Hook type: <agent>.<method> (e.g., claude-code.postToolUse, gemini-cli.postToolUse)',
  )
  .option('--marker <tag>', 'Scaffold marker tag to scan for in phantom code check')
  .option(
    '--fallback-tool <tool>',
    `Fallback LLM tool for scaffold operations. Supported: ${SUPPORTED_LLM_TOOLS.join(', ')}`,
  )
  .option(
    '--fallback-tool-config <json>',
    'JSON config for the fallback tool (e.g., \'{"model":"claude-sonnet-4-6"}\')',
  )
  .action(async (options: HookOptions): Promise<void> => {
    try {
      if (!options.type) {
        throw new Error(
          '--type option is required. Examples: claude-code.preToolUse, claude-code.postToolUse, gemini-cli.postToolUse',
        );
      }

      const { agent, hookMethod } = parseHookType(options.type);

      // Read per-agent per-method config; CLI flags take precedence
      const toolkitConfig = await TemplatesManagerService.readToolkitConfig();
      const hookConfig = toolkitConfig?.['scaffold-mcp']?.hook;
      const methodConfig =
        hookConfig?.[agent as keyof HookConfig]?.[hookMethod as keyof HookAgentConfig];

      const marker = options.marker ?? '@scaffold-generated';
      const fallbackToolStr = options.fallbackTool ?? methodConfig?.['llm-tool'];

      // CLI --fallback-tool-config (JSON string) takes precedence over config object
      const fallbackToolConfig = options.fallbackToolConfig
        ? parseJsonConfigOption(options.fallbackToolConfig, '--fallback-tool-config')
        : methodConfig?.['tool-config'];

      // Validate fallback tool if provided
      if (fallbackToolStr && !isValidLlmTool(fallbackToolStr)) {
        throw new Error(
          `Invalid --fallback-tool: ${fallbackToolStr}. Supported: ${SUPPORTED_LLM_TOOLS.join(', ')}`,
        );
      }

      // Build adapter config from fallback tool options
      const adapterConfig: HookAdapterConfig = {};
      if (fallbackToolConfig) {
        adapterConfig.tool_config = fallbackToolConfig;
      }
      if (fallbackToolStr) {
        adapterConfig.llm_tool = fallbackToolStr;
      }
      const resolvedAdapterConfig =
        Object.keys(adapterConfig).length > 0 ? adapterConfig : undefined;

      if (!isHookMethod(hookMethod)) {
        // No hooks registered for this method — exit gracefully (no-op)
        process.exit(0);
      }

      if (agent === CLAUDE_CODE) {
        // Import hook module via barrel export (dynamic for conditional loading based on agent type)
        const hookModule: ClaudeCodeHookModule = await import('../hooks/claudeCode');

        const claudeCallbacks: ClaudeCodeHookCallback[] = [];

        if (hookModule.UseScaffoldMethodHook) {
          const hookInstance = new hookModule.UseScaffoldMethodHook();
          const hookFn = hookInstance[hookMethod];
          if (hookFn) {
            claudeCallbacks.push(hookFn.bind(hookInstance));
          }
        }

        if (hookModule.PhantomCodeCheckHook) {
          const hookInstance = new hookModule.PhantomCodeCheckHook(marker);
          const hookFn = hookInstance[hookMethod];
          if (hookFn) {
            claudeCallbacks.push(hookFn.bind(hookInstance));
          }
        }

        if (claudeCallbacks.length === 0) {
          // No hooks registered for this method — exit gracefully (no-op)
          process.exit(0);
        }

        const adapter = new ClaudeCodeAdapter();
        await adapter.executeMultiple(claudeCallbacks, resolvedAdapterConfig);
      } else if (agent === GEMINI_CLI) {
        // Import hook module via barrel export (dynamic for conditional loading based on agent type)
        const hookModule: GeminiCliHookModule = await import('../hooks/geminiCli');

        const geminiCallbacks: GeminiCliHookCallback[] = [];

        if (hookModule.UseScaffoldMethodHook) {
          const hookInstance = new hookModule.UseScaffoldMethodHook();
          const hookFn = hookInstance[hookMethod];
          if (hookFn) {
            geminiCallbacks.push(hookFn.bind(hookInstance));
          }
        }

        if (geminiCallbacks.length === 0) {
          // No hooks registered for this method — exit gracefully (no-op)
          process.exit(0);
        }

        const adapter = new GeminiCliAdapter();
        await adapter.executeMultiple(geminiCallbacks, resolvedAdapterConfig);
      } else {
        throw new Error(`Unsupported agent: ${agent}. Supported: ${CLAUDE_CODE}, ${GEMINI_CLI}`);
      }
    } catch (error) {
      print.error(`Hook error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });
