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

import { Command } from 'commander';
import { CLAUDE_CODE, GEMINI_CLI, isValidLlmTool } from '@agiflowai/coding-agent-bridge';
import {
  ClaudeCodeAdapter,
  GeminiCliAdapter,
  parseHookType,
  type ClaudeCodeHookInput,
  type GeminiCliHookInput,
  type HookResponse,
} from '@agiflowai/hooks-adapter';
import { print } from '@agiflowai/aicode-utils';

interface HookOptions {
  type?: string;
  toolConfig?: string;
  llmTool?: string;
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

/**
 * Hook command for executing architect hooks
 */
export const hookCommand = new Command('hook')
  .description('Execute architect hooks for AI agent integrations')
  .option(
    '--type <agentAndMethod>',
    'Hook type: <agent>.<method> (e.g., claude-code.preToolUse, gemini-cli.afterTool)',
  )
  .option(
    '--tool-config <json>',
    'JSON config for the LLM tool (e.g., \'{"model":"gpt-5.2-high"}\')',
  )
  .option(
    '--llm-tool <tool>',
    'LLM tool to use for processing (e.g., claude-code, gemini-cli)',
  )
  .action(async (options: HookOptions): Promise<void> => {
    try {
      if (!options.type) {
        print.error('--type option is required');
        print.info('Examples:');
        print.info('  architect hook --type claude-code.preToolUse');
        print.info('  architect hook --type claude-code.postToolUse');
        print.info('  architect hook --type gemini-cli.beforeTool');
        print.info('  architect hook --type gemini-cli.afterTool');
        process.exit(1);
      }

      const { agent, hookMethod } = parseHookType(options.type);

      // Parse tool config JSON if provided
      let toolConfig: Record<string, unknown> | undefined;
      if (options.toolConfig) {
        try {
          const parsed: unknown = JSON.parse(options.toolConfig);
          if (!isRecordObject(parsed)) {
            print.error('--tool-config must be a JSON object, not an array or primitive value');
            process.exit(1);
          }
          toolConfig = parsed;
        } catch (error) {
          print.error(
            `Invalid JSON for --tool-config. Expected format: '{"key":"value"}'. Parse error: ${error instanceof Error ? error.message : String(error)}`,
          );
          process.exit(1);
        }
      }

      if (agent === CLAUDE_CODE) {
        // Import hook modules (dynamic import for conditional loading based on agent type)
        const [getFileDesignPatternModule, reviewCodeChangeModule]: [ClaudeCodeHookModule, ClaudeCodeHookModule] = await Promise.all([
          import('../hooks/claudeCode/getFileDesignPattern'),
          import('../hooks/claudeCode/reviewCodeChange'),
        ]);

        // Collect all available hooks for this hook method
        const claudeCallbacks: ClaudeCodeHookCallback[] = [];

        // Instantiate GetFileDesignPatternHook class and get the method
        if (getFileDesignPatternModule.GetFileDesignPatternHook) {
          const hookInstance = new getFileDesignPatternModule.GetFileDesignPatternHook();
          const hookFn = hookInstance[hookMethod as keyof HookClass<ClaudeCodeHookInput>];
          if (hookFn) {
            claudeCallbacks.push(hookFn.bind(hookInstance));
          }
        }

        // Instantiate ReviewCodeChangeHook class and get the method
        if (reviewCodeChangeModule.ReviewCodeChangeHook) {
          const hookInstance = new reviewCodeChangeModule.ReviewCodeChangeHook();
          const hookFn = hookInstance[hookMethod as keyof HookClass<ClaudeCodeHookInput>];
          if (hookFn) {
            claudeCallbacks.push(hookFn.bind(hookInstance));
          }
        }

        if (claudeCallbacks.length === 0) {
          print.error(`Hook not found: ${hookMethod} in Claude Code hooks`);
          process.exit(1);
        }

        const adapter = new ClaudeCodeAdapter();

        // Build config object with optional tool_config and llm_tool
        const adapterConfig: { tool_config?: Record<string, unknown>; llm_tool?: string } = {};
        if (toolConfig) {
          adapterConfig.tool_config = toolConfig;
        }
        if (options.llmTool) {
          if (!isValidLlmTool(options.llmTool)) {
            print.error(`Invalid --llm-tool value: ${options.llmTool}. Supported: claude-code, gemini-cli`);
            process.exit(1);
          }
          adapterConfig.llm_tool = options.llmTool;
        }

        // Execute all hooks in serial with shared stdin
        await adapter.executeMultiple(
          claudeCallbacks,
          Object.keys(adapterConfig).length > 0 ? adapterConfig : undefined,
        );

      } else if (agent === GEMINI_CLI) {
        // Import hook modules (dynamic import for conditional loading based on agent type)
        const [getFileDesignPatternModule, reviewCodeChangeModule]: [GeminiCliHookModule, GeminiCliHookModule] = await Promise.all([
          import('../hooks/geminiCli/getFileDesignPattern'),
          import('../hooks/geminiCli/reviewCodeChange'),
        ]);

        // Collect all available hooks for this hook method
        const geminiCallbacks: GeminiCliHookCallback[] = [];

        // Instantiate GetFileDesignPatternHook class and get the method
        if (getFileDesignPatternModule.GetFileDesignPatternHook) {
          const hookInstance = new getFileDesignPatternModule.GetFileDesignPatternHook();
          const hookFn = hookInstance[hookMethod as keyof HookClass<GeminiCliHookInput>];
          if (hookFn) {
            geminiCallbacks.push(hookFn.bind(hookInstance));
          }
        }

        // Instantiate ReviewCodeChangeHook class and get the method
        if (reviewCodeChangeModule.ReviewCodeChangeHook) {
          const hookInstance = new reviewCodeChangeModule.ReviewCodeChangeHook();
          const hookFn = hookInstance[hookMethod as keyof HookClass<GeminiCliHookInput>];
          if (hookFn) {
            geminiCallbacks.push(hookFn.bind(hookInstance));
          }
        }

        if (geminiCallbacks.length === 0) {
          print.error(`Hook not found: ${hookMethod} in Gemini CLI hooks`);
          process.exit(1);
        }

        const adapter = new GeminiCliAdapter();

        // Build config object with optional tool_config and llm_tool
        const geminiAdapterConfig: { tool_config?: Record<string, unknown>; llm_tool?: string } = {};
        if (toolConfig) {
          geminiAdapterConfig.tool_config = toolConfig;
        }
        if (options.llmTool) {
          if (!isValidLlmTool(options.llmTool)) {
            print.error(`Invalid --llm-tool value: ${options.llmTool}. Supported: claude-code, gemini-cli`);
            process.exit(1);
          }
          geminiAdapterConfig.llm_tool = options.llmTool;
        }

        // Execute all hooks in serial with shared stdin
        await adapter.executeMultiple(
          geminiCallbacks,
          Object.keys(geminiAdapterConfig).length > 0 ? geminiAdapterConfig : undefined,
        );

      } else {
        print.error(`Unsupported agent: ${agent}. Supported: ${CLAUDE_CODE}, ${GEMINI_CLI}`);
        process.exit(1);
      }
    } catch (error) {
      print.error(`Hook error: ${(error as Error).message}`);
      process.exit(1);
    }
  });
