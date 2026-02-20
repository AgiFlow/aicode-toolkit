import { print } from '@agiflowai/aicode-utils';
/**
 * ValidateArchitect Command
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
import { ValidateArchitectTool } from '../tools';

interface ValidateArchitectOptions {
  template?: boolean;
  verbose?: boolean;
}

/**
 * Validate an architect.yaml file for syntax and schema errors
 */
export const validateArchitectCommand = new Command('validate-architect')
  .description('Validate an architect.yaml file for syntax and schema errors')
  .argument('[path]', 'Path to architect.yaml file OR template name')
  .option('-t, --template', 'Treat the path argument as a template name', false)
  .option('-v, --verbose', 'Enable verbose output', false)
  .action(async (pathArg: string | undefined, options: ValidateArchitectOptions): Promise<void> => {
    try {
      // Create tool instance - delegates validation logic to the tool
      const tool = new ValidateArchitectTool();

      // Determine input type based on options
      const input = options.template
        ? { template_name: pathArg }
        : pathArg
          ? { file_path: pathArg }
          : {};

      if (options.verbose) {
        print.info(`Validating with input: ${JSON.stringify(input)}`);
      }

      // Execute the tool
      const result = await tool.execute(input);

      // Parse and display result
      const firstContent = result.content[0];
      if (firstContent.type !== 'text') {
        print.error('Unexpected response type');
        process.exit(1);
      }

      const data = JSON.parse(firstContent.text);

      if (result.isError || !data.valid) {
        print.error('Validation failed\n');

        if (data.file_path) {
          print.info(`File: ${data.file_path}\n`);
        }

        for (const error of data.errors || []) {
          print.error(`[${error.type}] ${error.message}`);

          if (error.location) {
            print.info(`  Location: ${error.location}`);
          }

          if (error.details) {
            print.info(`  Details: ${error.details}`);
          }

          print.info(`\n  How to fix:\n  ${error.fix_suggestion.split('\n').join('\n  ')}\n`);
        }

        process.exit(1);
      }

      // Success output
      print.info('Validation successful\n');
      print.info(`File: ${data.file_path}`);
      print.info(`Features: ${data.features_count}`);

      if (options.verbose && data.features.length > 0) {
        print.info('\nFeatures:');
        for (const feature of data.features) {
          print.info(
            `  - ${feature.name || '(unnamed)'}: ${feature.design_pattern} (${feature.includes_count} patterns)`,
          );
        }
      }
    } catch (error) {
      print.error(
        'Error executing validate-architect:',
        error instanceof Error ? error : String(error),
      );
      process.exit(1);
    }
  });
