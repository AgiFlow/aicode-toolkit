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
  type LlmToolId,
  isValidLlmTool,
  SUPPORTED_LLM_TOOLS,
} from '@agiflowai/coding-agent-bridge';

interface GetFileDesignPatternOptions {
  verbose?: boolean;
  json?: boolean;
  llmTool?: string;
  toolConfig?: string;
}

/**
 * Get design pattern information for a file
 */
export const getFileDesignPatternCommand = new Command('get-file-design-pattern')
  .description('Analyze a file against template-specific and global design patterns')
  .argument('<file-path>', 'Path to the file to analyze')
  .option('-v, --verbose', 'Enable verbose output', false)
  .option('-j, --json', 'Output as JSON', false)
  .option(
    '--llm-tool <tool>',
    `Use LLM to filter relevant patterns. Supported: ${SUPPORTED_LLM_TOOLS.join(', ')}`,
    undefined,
  )
  .option(
    '--tool-config <json>',
    'JSON config for the LLM tool (e.g., \'{"model":"gpt-5.2"}\')',
    undefined,
  )
  .action(async (filePath: string, options: GetFileDesignPatternOptions): Promise<void> => {
    try {
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

      // Parse tool config JSON
      let toolConfig: Record<string, unknown> | undefined;
      if (options.toolConfig) {
        try {
          toolConfig = JSON.parse(options.toolConfig);
          if (options.verbose) {
            print.info(`Tool config: ${JSON.stringify(toolConfig)}`);
          }
        } catch (error) {
          print.error(
            `Invalid JSON for --tool-config: ${error instanceof Error ? error.message : String(error)}`,
          );
          process.exit(1);
        }
      }

      const llmTool = options.llmTool as LlmToolId | undefined;

      // Create tool instance with optional LLM support
      const tool = new GetFileDesignPatternTool({ llmTool, toolConfig });

      // Execute the tool
      const result = await tool.execute({
        file_path: filePath,
      });

      // Parse and display result
      const firstContent = result.content[0];
      if (firstContent.type !== 'text') {
        print.error('❌ Error: Unexpected response type');
        process.exit(1);
      }

      if (result.isError) {
        const errorData = JSON.parse(firstContent.text);
        print.error('❌ Error:', errorData.error || errorData);
        process.exit(1);
      }

      const data = JSON.parse(firstContent.text);

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
