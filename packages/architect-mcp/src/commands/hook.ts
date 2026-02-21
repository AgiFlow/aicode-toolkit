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

import { CLAUDE_CODE, GEMINI_CLI, SUPPORTED_LLM_TOOLS, isValidLlmTool } from '@agiflowai/coding-agent-bridge';
import {
  ClaudeCodeAdapter,
  GeminiCliAdapter,
  parseHookType,
  type ClaudeCodeHookInput,
  type GeminiCliHookInput,
  type HookResponse,
} from '@agiflowai/hooks-adapter';
import { print } from '@agiflowai/aicode-utils';
import { Command } from 'commander';

/** Options parsed by Commander for the hook command */
interface HookOptions {
  type?: string;
  toolConfig?: string;
  llmTool?: string;
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

/** Interface for class-based hook with preToolUse and postToolUse methods */
interface HookClass<T> {
  preToolUse?: (context: T) => Promise<HookResponse>;
  postToolUse?: (context: T) => Promise<HookResponse>;
}

/** Interface for Claude Code hook module exports */
interface ClaudeCodeHookModule {
  GetFileDesignPatternHook?: new () => HookClass<ClaudeCodeHookInput>;
  ReviewCodeChangeHook?: new () => HookClass<ClaudeCodeHookInput>;
}

/** Interface for Gemini CLI hook module exports */
interface GeminiCliHookModule {
  GetFileDesignPatternHook?: new () => HookClass<GeminiCliHookInput>;
  ReviewCodeChangeHook?: new () => HookClass<GeminiCliHookInput>;
}

/** Type guard for valid architect hook method keys */
function isHookMethod(key: string): key is keyof HookClass<unknown> {
  return key === 'preToolUse' || key === 'postToolUse';
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
 * Hook command for executing architect hooks
 */
export const hookCommand = new Command('hook')
  .description('Execute architect hooks for AI agent integrations')
  .option(
    '--type <agentAndMethod>',
    'Hook type: <agent>.<method> (e.g., claude-code.preToolUse, gemini-cli.postToolUse)',
    undefined,
  )
  .option(
    '--tool-config <json>',
    'JSON config for the LLM tool (e.g., \'{"model":"gpt-5.2-high"}\')',
    undefined,
  )
  .option(
    '--llm-tool <tool>',
    `LLM tool to use for processing. Supported: ${SUPPORTED_LLM_TOOLS.join(', ')}`,
    undefined,
  )
  .option(
    '--fallback-tool <tool>',
    `Fallback LLM tool when --llm-tool is not set. Supported: ${SUPPORTED_LLM_TOOLS.join(', ')}`,
    undefined,
  )
  .option(
    '--fallback-tool-config <json>',
    'JSON config for the fallback tool (e.g., \'{"model":"claude-sonnet-4-6"}\')',
    undefined,
  )
  .action(async (options: HookOptions): Promise<void> => {
    try {
      if (!options.type) {
        throw new Error(
          '--type option is required. Examples: claude-code.preToolUse, claude-code.postToolUse, gemini-cli.beforeTool, gemini-cli.afterTool',
        );
      }

      const { agent, hookMethod } = parseHookType(options.type);

      // Parse JSON config options
      const toolConfig = parseJsonConfigOption(options.toolConfig, '--tool-config');
      const fallbackToolConfig = parseJsonConfigOption(options.fallbackToolConfig, '--fallback-tool-config');

      // Resolve effective tool and config (specific flags take precedence over fallback)
      const resolvedLlmTool = options.llmTool ?? options.fallbackTool;
      const resolvedToolConfig = toolConfig ?? fallbackToolConfig;

      if (!isHookMethod(hookMethod)) {
        print.error(
          `Unsupported hook method: ${hookMethod}. Supported: preToolUse, postToolUse`,
        );
        process.exit(1);
      }

      // Build adapter config with resolved tool and config
      const adapterConfig: HookAdapterConfig = {};
      if (resolvedToolConfig) {
        adapterConfig.tool_config = resolvedToolConfig;
      }
      if (resolvedLlmTool) {
        if (!isValidLlmTool(resolvedLlmTool)) {
          print.error(
            `Invalid LLM tool: ${resolvedLlmTool}. Supported: ${SUPPORTED_LLM_TOOLS.join(', ')}`,
          );
          process.exit(1);
        }
        adapterConfig.llm_tool = resolvedLlmTool;
      }

      const resolvedAdapterConfig =
        Object.keys(adapterConfig).length > 0 ? adapterConfig : undefined;

      if (agent === CLAUDE_CODE) {
        // Import hook module via barrel export (dynamic for conditional loading based on agent type)
        const hookModule: ClaudeCodeHookModule = await import('../hooks/claudeCode');

        const claudeCallbacks: ClaudeCodeHookCallback[] = [];

        if (hookModule.GetFileDesignPatternHook) {
          const hookInstance = new hookModule.GetFileDesignPatternHook();
          const hookFn = hookInstance[hookMethod];
          if (hookFn) {
            claudeCallbacks.push(hookFn.bind(hookInstance));
          }
        }

        if (hookModule.ReviewCodeChangeHook) {
          const hookInstance = new hookModule.ReviewCodeChangeHook();
          const hookFn = hookInstance[hookMethod];
          if (hookFn) {
            claudeCallbacks.push(hookFn.bind(hookInstance));
          }
        }

        if (claudeCallbacks.length === 0) {
          print.error(`No hooks registered for method: ${hookMethod} in Claude Code hooks`);
          process.exit(1);
        }

        const adapter = new ClaudeCodeAdapter();
        await adapter.executeMultiple(claudeCallbacks, resolvedAdapterConfig);
      } else if (agent === GEMINI_CLI) {
        // Import hook module via barrel export (dynamic for conditional loading based on agent type)
        const hookModule: GeminiCliHookModule = await import('../hooks/geminiCli');

        const geminiCallbacks: GeminiCliHookCallback[] = [];

        if (hookModule.GetFileDesignPatternHook) {
          const hookInstance = new hookModule.GetFileDesignPatternHook();
          const hookFn = hookInstance[hookMethod];
          if (hookFn) {
            geminiCallbacks.push(hookFn.bind(hookInstance));
          }
        }

        if (hookModule.ReviewCodeChangeHook) {
          const hookInstance = new hookModule.ReviewCodeChangeHook();
          const hookFn = hookInstance[hookMethod];
          if (hookFn) {
            geminiCallbacks.push(hookFn.bind(hookInstance));
          }
        }

        if (geminiCallbacks.length === 0) {
          print.error(`No hooks registered for method: ${hookMethod} in Gemini CLI hooks`);
          process.exit(1);
        }

        const adapter = new GeminiCliAdapter();
        await adapter.executeMultiple(geminiCallbacks, resolvedAdapterConfig);
      } else {
        print.error(`Unsupported agent: ${agent}. Supported: ${CLAUDE_CODE}, ${GEMINI_CLI}`);
        process.exit(1);
      }
    } catch (error) {
      print.error(`Hook error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });
