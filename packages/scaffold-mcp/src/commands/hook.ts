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
import { CLAUDE_CODE, GEMINI_CLI } from '@agiflowai/coding-agent-bridge';
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
  marker?: string;
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
}

/** Interface for PhantomCodeCheck hook module exports */
interface PhantomCodeCheckHookModule {
  PhantomCodeCheckHook?: new (marker: string) => HookClass<ClaudeCodeHookInput>;
}

/** Interface for Gemini CLI hook module exports */
interface GeminiCliHookModule {
  UseScaffoldMethodHook?: new () => HookClass<GeminiCliHookInput>;
}

/**
 * Hook command for executing scaffold hooks
 */
export const hookCommand = new Command('hook')
  .description('Execute scaffold hooks for AI agent integrations')
  .option(
    '--type <agentAndMethod>',
    'Hook type: <agent>.<method> (e.g., claude-code.postToolUse, gemini-cli.afterTool)',
  )
  .option(
    '--marker <tag>',
    'Scaffold marker tag to scan for in phantom code check (default: @scaffold-generated)',
  )
  .action(async (options: HookOptions): Promise<void> => {
    try {
      if (!options.type) {
        print.error('--type option is required');
        print.info('Examples:');
        print.info('  scaffold hook --type claude-code.preToolUse');
        print.info('  scaffold hook --type claude-code.postToolUse');
        print.info('  scaffold hook --type gemini-cli.beforeTool');
        print.info('  scaffold hook --type gemini-cli.afterTool');
        process.exit(1);
      }

      const { agent, hookMethod } = parseHookType(options.type);

      if (agent === CLAUDE_CODE) {
        // Import hook modules (dynamic import for conditional loading based on agent type)
        const useScaffoldMethodModule: ClaudeCodeHookModule = await import(
          '../hooks/claudeCode/useScaffoldMethod'
        );
        const phantomCodeCheckModule: PhantomCodeCheckHookModule = await import(
          '../hooks/claudeCode/phantomCodeCheck'
        );

        // Collect all available hooks for this hook method
        const claudeCallbacks: ClaudeCodeHookCallback[] = [];

        // Instantiate UseScaffoldMethodHook class and get the method
        if (useScaffoldMethodModule.UseScaffoldMethodHook) {
          const hookInstance = new useScaffoldMethodModule.UseScaffoldMethodHook();
          const hookFn = hookInstance[hookMethod as keyof HookClass<ClaudeCodeHookInput>];
          if (hookFn) {
            claudeCallbacks.push(hookFn.bind(hookInstance));
          }
        }

        // Instantiate PhantomCodeCheckHook with marker and get the method
        if (phantomCodeCheckModule.PhantomCodeCheckHook) {
          const markerValue = options.marker ?? '@scaffold-generated';
          const hookInstance = new phantomCodeCheckModule.PhantomCodeCheckHook(markerValue);
          const hookFn = hookInstance[hookMethod as keyof HookClass<ClaudeCodeHookInput>];
          if (hookFn) {
            claudeCallbacks.push(hookFn.bind(hookInstance));
          }
        }

        if (claudeCallbacks.length === 0) {
          // No hooks registered for this method — exit gracefully (no-op)
          process.exit(0);
        }

        const adapter = new ClaudeCodeAdapter();

        // Execute all hooks in serial with shared stdin
        await adapter.executeMultiple(claudeCallbacks);
      } else if (agent === GEMINI_CLI) {
        // Import hook module (dynamic import for conditional loading based on agent type)
        const useScaffoldMethodModule: GeminiCliHookModule = await import(
          '../hooks/geminiCli/useScaffoldMethod'
        );

        // Collect all available hooks for this hook method
        const geminiCallbacks: GeminiCliHookCallback[] = [];

        // Instantiate UseScaffoldMethodHook class and get the method
        if (useScaffoldMethodModule.UseScaffoldMethodHook) {
          const hookInstance = new useScaffoldMethodModule.UseScaffoldMethodHook();
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

        // Execute all hooks in serial with shared stdin
        await adapter.executeMultiple(geminiCallbacks);
      } else {
        print.error(`Unsupported agent: ${agent}. Supported: ${CLAUDE_CODE}, ${GEMINI_CLI}`);
        process.exit(1);
      }
    } catch (error) {
      print.error(`Hook error: ${(error as Error).message}`);
      process.exit(1);
    }
  });
