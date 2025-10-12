/**
 * Review Code Change Command
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

import { log, print } from '@agiflowai/aicode-utils';
import { Command } from 'commander';
import { ReviewCodeChangeTool } from '../tools/ReviewCodeChangeTool';

interface ReviewCodeChangeOptions {
  verbose?: boolean;
  json?: boolean;
  llmTool?: string;
}

/**
 * Review code changes against template-specific and global rules to identify violations
 */
export const reviewCodeChangeCommand = new Command('review-code-change')
  .description('Review code changes against template-specific and global rules to identify violations')
  .argument('<file-path>', 'Path to the file to review')
  .option('-v, --verbose', 'Enable verbose output', false)
  .option('-j, --json', 'Output as JSON', false)
  .option('--llm-tool <tool>', 'LLM tool to use for code review (currently only "claude-code" is supported)', 'claude-code')
  .action(async (filePath: string, options: ReviewCodeChangeOptions) => {
    try {
      if (options.verbose) {
        log.info('Reviewing file:', filePath);
        log.info('Using LLM tool:', options.llmTool);
      }

      // Validate llm-tool option
      if (options.llmTool && options.llmTool !== 'claude-code') {
        print.error('❌ Error: Only "claude-code" is currently supported for --llm-tool');
        process.exit(1);
      }

      // Create tool instance
      const tool = new ReviewCodeChangeTool({
        llmTool: options.llmTool,
      });

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
        // Pretty print the results
        print.info(`\n## ${data.file_path}`);

        if (data.project_name) {
          print.info(`Project: ${data.project_name}`);
        }

        if (data.source_template) {
          print.info(`Template: ${data.source_template}`);
        }

        if (data.matched_rules) {
          print.info('\n### Matched Rule Pattern\n');
          print.info(`**${data.matched_rules.pattern}**`);
          print.info(data.matched_rules.description);
          print.info('');
        }

        // Display severity
        const severityEmoji: Record<string, string> = {
          LOW: '🟢',
          MEDIUM: '🟡',
          HIGH: '🔴',
        };
        print.info(`### Review Result: ${severityEmoji[data.severity] || '⚪'} ${data.severity}\n`);

        // Display feedback
        if (data.review_feedback) {
          print.info(data.review_feedback);
          print.info('');
        }

        // Display issues found
        if (data.issues_found && data.issues_found.length > 0) {
          print.info('### Issues Found\n');

          const groupedIssues: Record<string, any[]> = {
            must_not_do: [],
            must_do: [],
            should_do: [],
          };

          for (const issue of data.issues_found) {
            if (groupedIssues[issue.type]) {
              groupedIssues[issue.type].push(issue);
            }
          }

          if (groupedIssues.must_not_do.length > 0) {
            print.info('**❌ Must Not Do Violations:**\n');
            for (const issue of groupedIssues.must_not_do) {
              print.info(`- ${issue.rule}`);
              if (issue.violation) {
                print.info(`  Violation: ${issue.violation}`);
              }
            }
            print.info('');
          }

          if (groupedIssues.must_do.length > 0) {
            print.info('**⚠️ Must Do Missing:**\n');
            for (const issue of groupedIssues.must_do) {
              print.info(`- ${issue.rule}`);
              if (issue.violation) {
                print.info(`  Note: ${issue.violation}`);
              }
            }
            print.info('');
          }

          if (groupedIssues.should_do.length > 0) {
            print.info('**💡 Should Do Suggestions:**\n');
            for (const issue of groupedIssues.should_do) {
              print.info(`- ${issue.rule}`);
              if (issue.violation) {
                print.info(`  Note: ${issue.violation}`);
              }
            }
            print.info('');
          }
        } else {
          print.success('✅ No violations found!\n');
        }
      }
    } catch (error) {
      log.error('❌ Error executing review-code-change:', error);
      process.exit(1);
    }
  });
