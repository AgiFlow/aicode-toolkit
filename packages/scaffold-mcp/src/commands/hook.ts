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
import { messages } from '@agiflowai/aicode-utils';

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
 * Hook command for executing scaffold hooks
 */
export const hookCommand = new Command('hook')
  .description('Execute scaffold hooks for AI agent integrations')
  .option(
    '--type <agentAndMethod>',
    'Hook type: <agent>.<method> (e.g., claude-code.postToolUse, gemini-cli.afterTool)',
  )
  .action(async (options: HookOptions) => {
    try {
      if (!options.type) {
        messages.error('--type option is required');
        messages.hint('Examples:');
        messages.hint('  scaffold hook --type claude-code.preToolUse');
        messages.hint('  scaffold hook --type claude-code.postToolUse');
        messages.hint('  scaffold hook --type gemini-cli.beforeTool');
        messages.hint('  scaffold hook --type gemini-cli.afterTool');
        process.exit(1);
      }

      const { agent, hookMethod } = parseHookType(options.type);

      if (agent === CLAUDE_CODE) {
        const hooks = await import('../hooks/claudeCode/useScaffoldMethod');
        const hookName = `${hookMethod}Hook` as keyof typeof hooks;
        const callback = hooks[hookName];

        if (!callback) {
          messages.error(`Hook not found: ${hookName} in claudeCode/useScaffoldMethod`);
          process.exit(1);
        }

        const adapter = new ClaudeCodeAdapter();
        await adapter.execute(callback);
      } else if (agent === GEMINI_CLI) {
        const hooks = await import('../hooks/geminiCli/useScaffoldMethod');
        const hookName = `${hookMethod}Hook` as keyof typeof hooks;
        const callback = hooks[hookName];

        if (!callback) {
          messages.error(`Hook not found: ${hookName} in geminiCli/useScaffoldMethod`);
          process.exit(1);
        }

        const adapter = new GeminiCliAdapter();
        await adapter.execute(callback);
      } else {
        messages.error(`Unsupported agent: ${agent}. Supported: ${CLAUDE_CODE}, ${GEMINI_CLI}`);
        process.exit(1);
      }
    } catch (error) {
      messages.error(`Hook error: ${(error as Error).message}`);
      process.exit(1);
    }
  });
