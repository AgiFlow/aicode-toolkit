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
import { ClaudeCodeAdapter, GeminiCliAdapter } from '@agiflowai/hooks-adapter';
import { print } from '@agiflowai/aicode-utils';
import type { HookCallback } from '@agiflowai/hooks-adapter';

interface HookOptions {
  type?: string;
}

/**
 * Parse hook type option in format: agent.hookMethod
 * Examples: claude-code.preToolUse, gemini-cli.afterTool
 */
function parseHookType(hookType: string): { agent: string; hookMethod: string } {
  const [agent, hookMethod] = hookType.split('.');

  if (!agent || !hookMethod) {
    throw new Error(`Invalid hook type: ${hookType}. Expected: <agent>.<hookMethod>`);
  }

  return { agent, hookMethod };
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
  .action(async (options: HookOptions) => {
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

      // Collect all hook callbacks to run in serial
      const hookCallbacks: HookCallback[] = [];

      if (agent === CLAUDE_CODE) {
        // Import both hook modules
        const [getFileDesignPatternHooks, reviewCodeChangeHooks] = await Promise.all([
          import('../hooks/claudeCode/getFileDesignPattern'),
          import('../hooks/claudeCode/reviewCodeChange'),
        ]);

        const hookName = `${hookMethod}Hook`;

        // Collect all available hooks for this hook method
        const getFileHook = (getFileDesignPatternHooks as any)[hookName] as HookCallback | undefined;
        const reviewCodeHook = (reviewCodeChangeHooks as any)[hookName] as HookCallback | undefined;

        if (getFileHook) {
          hookCallbacks.push(getFileHook);
        }
        if (reviewCodeHook) {
          hookCallbacks.push(reviewCodeHook);
        }

        if (hookCallbacks.length === 0) {
          print.error(`Hook not found: ${hookName} in Claude Code hooks`);
          process.exit(1);
        }

        const adapter = new ClaudeCodeAdapter();

        // Execute all hooks in serial
        for (const callback of hookCallbacks) {
          await adapter.execute(callback);
        }
      } else if (agent === GEMINI_CLI) {
        // Import both hook modules
        const [getFileDesignPatternHooks, reviewCodeChangeHooks] = await Promise.all([
          import('../hooks/geminiCli/getFileDesignPattern'),
          import('../hooks/geminiCli/reviewCodeChange'),
        ]);

        const hookName = `${hookMethod}Hook`;

        // Collect all available hooks for this hook method
        const getFileHook = (getFileDesignPatternHooks as any)[hookName] as HookCallback | undefined;
        const reviewCodeHook = (reviewCodeChangeHooks as any)[hookName] as HookCallback | undefined;

        if (getFileHook) {
          hookCallbacks.push(getFileHook);
        }
        if (reviewCodeHook) {
          hookCallbacks.push(reviewCodeHook);
        }

        if (hookCallbacks.length === 0) {
          print.error(`Hook not found: ${hookName} in Gemini CLI hooks`);
          process.exit(1);
        }

        const adapter = new GeminiCliAdapter();

        // Execute all hooks in serial
        for (const callback of hookCallbacks) {
          await adapter.execute(callback);
        }
      } else {
        print.error(`Unsupported agent: ${agent}. Supported: ${CLAUDE_CODE}, ${GEMINI_CLI}`);
        process.exit(1);
      }
    } catch (error) {
      print.error(`Hook error: ${(error as Error).message}`);
      process.exit(1);
    }
  });
