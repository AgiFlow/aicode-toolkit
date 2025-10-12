import { log, print } from '@agiflowai/aicode-utils';
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

interface GetFileDesignPatternOptions {
  verbose?: boolean;
  json?: boolean;
  llmTool?: string;
}

/**
 * Get design pattern information for a file
 */
export const getFileDesignPatternCommand = new Command('get-file-design-pattern')
  .description('Analyze a file against template-specific and global design patterns')
  .argument('<file-path>', 'Path to the file to analyze')
  .option('-v, --verbose', 'Enable verbose output', false)
  .option('-j, --json', 'Output as JSON', false)
  .option('--llm-tool <tool>', 'Use LLM to filter relevant patterns (claude-code)', undefined)
  .action(async (filePath: string, options: GetFileDesignPatternOptions) => {
    try {
      if (options.verbose) {
        print.info(`Analyzing file: ${filePath}`);
        if (options.llmTool) {
          print.info(`Using LLM tool: ${options.llmTool}`);
        }
      }

      // Validate llm-tool option
      const llmTool = options.llmTool as 'claude-code' | undefined;
      if (llmTool && llmTool !== 'claude-code') {
        print.error(`Invalid LLM tool: ${llmTool}. Currently only "claude-code" is supported.`);
        process.exit(1);
      }

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
              const cleanDescription = pattern.description
                .replace(/\n\n/g, '\n')
                .trim();
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
      print.error('❌ Error executing get-file-design-pattern:', error instanceof Error ? error : String(error));
      process.exit(1);
    }
  });
