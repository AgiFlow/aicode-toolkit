import { print } from '@agiflowai/aicode-utils';
/**
 * Get File Design Pattern Command
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
 * - Use Commander's .option() and .argument() for inputs
 *
 * AVOID:
 * - Synchronous blocking operations in action handlers
 * - Missing error handling (always use try-catch)
 * - Hardcoded values (use options or environment variables)
 * - Not exiting with appropriate exit codes on errors
 */

import { Command } from 'commander';
import { GetFileDesignPatternTool } from '../tools/GetFileDesignPatternTool';
import {
  CLAUDE_CODE,
  type LlmToolId,
  isValidLlmTool,
  SUPPORTED_LLM_TOOLS,
} from '@agiflowai/coding-agent-bridge';
import { AdapterProxyService, PRE_TOOL_USE } from '@agiflowai/hooks-adapter';
import { preToolUseHook } from '../hooks/claudeCode/preToolUse';

interface GetFileDesignPatternOptions {
  verbose?: boolean;
  json?: boolean;
  llmTool?: string;
  hook?: string;
}

/**
 * Get design pattern information for a file
 */
export const getFileDesignPatternCommand = new Command('get-file-design-pattern')
  .description('Analyze a file against template-specific and global design patterns')
  .argument('[file-path]', 'Path to the file to analyze (optional if using --hook)')
  .option('-v, --verbose', 'Enable verbose output', false)
  .option('-j, --json', 'Output as JSON', false)
  .option(
    '--llm-tool <tool>',
    `Use LLM to filter relevant patterns. Supported: ${SUPPORTED_LLM_TOOLS.join(', ')}`,
    undefined,
  )
  .option(
    '--hook <agent>',
    'Run in hook mode for specified agent (e.g., claude-code)',
  )
  .action(async (filePath: string | undefined, options: GetFileDesignPatternOptions) => {
    try {
      // HOOK MODE: Delegate to AdapterProxy
      if (options.hook) {
        await AdapterProxyService.execute(CLAUDE_CODE, PRE_TOOL_USE, preToolUseHook);
        return;
      }

      // NORMAL CLI MODE: Use file-path argument
      if (!filePath) {
        print.error('file-path is required when not using --hook mode');
        process.exit(1);
      }

      if (options.verbose) {
        print.info(`Analyzing file: ${filePath}`);
        if (options.llmTool) {
          print.info(`Using LLM tool: ${options.llmTool}`);
        }
      }

      // Validate llm-tool option
      if (options.llmTool && !isValidLlmTool(options.llmTool)) {
        print.error(
          `Invalid LLM tool: ${options.llmTool}. Supported: ${SUPPORTED_LLM_TOOLS.join(', ')}`,
        );
        process.exit(1);
      }

      const llmTool = options.llmTool as LlmToolId | undefined;

      // Create tool instance with optional LLM support
      const tool = new GetFileDesignPatternTool({ llmTool });

      // Execute the tool
      const result = await tool.execute({
        file_path: filePath,
      });

      // Parse and display result
      if (result.isError) {
        const errorData = JSON.parse(result.content[0].text as string);
        print.error('❌ Error:', errorData.error || errorData);
        process.exit(1);
      }

      const data = JSON.parse(result.content[0].text as string);

      if (options.json) {
        // Output raw JSON
        print.info(JSON.stringify(data, null, 2));
      } else {
        // Lead developer style: concise, direct, actionable
        print.info(`\n## ${data.file_path}`);

        if (data.project_name) {
          print.info(`Project: ${data.project_name}`);
        }

        if (data.source_template) {
          print.info(`Template: ${data.source_template}`);
        }

        if (data.matched_patterns && data.matched_patterns.length > 0) {
          print.info('\n### Design Patterns\n');

          for (const pattern of data.matched_patterns) {
            print.info(`**${pattern.design_pattern}** (${pattern.confidence})`);

            if (pattern.description) {
              // Clean up description formatting
              const cleanDescription = pattern.description.replace(/\n\n/g, '\n').trim();
              print.info(cleanDescription);
            }

            print.info('');
          }
        } else {
          print.info('\n⚠️ No design patterns matched.');
        }

        if (data.recommendations && data.recommendations.length > 0) {
          print.info('### Action Items\n');
          for (const rec of data.recommendations) {
            print.info(`- ${rec}`);
          }
          print.newline();
        }
      }
    } catch (error) {
      print.error(
        '❌ Error executing get-file-design-pattern:',
        error instanceof Error ? error : String(error),
      );
      process.exit(1);
    }
  });
