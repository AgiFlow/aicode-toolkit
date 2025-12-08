import { print } from '@agiflowai/aicode-utils';
/**
 * Add Pattern Command
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
import { AddDesignPatternTool } from '../tools/AddDesignPatternTool';

interface AddPatternOptions {
  verbose?: boolean;
  includes?: string;
}

/**
 * Add a new design pattern to a template's architect.yaml file
 */
export const addPatternCommand = new Command('add-pattern')
  .description("Add a new design pattern to a template's architect.yaml file")
  .argument('<template>', 'Template name (e.g., "nextjs-15", "typescript-mcp-package")')
  .argument('<pattern-name>', 'Name of the design pattern')
  .argument('<design-pattern>', 'Design pattern description or category')
  .argument('<description>', 'Detailed markdown description (use quotes for multi-line)')
  .option(
    '-i, --includes <patterns...>',
    'File patterns that match this design pattern (can specify multiple)',
    ['**/*'],
  )
  .option('-v, --verbose', 'Enable verbose output', false)
  .action(
    async (
      template: string,
      patternName: string,
      designPattern: string,
      description: string,
      options: AddPatternOptions,
    ) => {
      try {
        if (options.verbose) {
          print.info(
            `Adding design pattern with options: ${JSON.stringify(
              {
                template,
                patternName,
                designPattern,
                description: `${description.substring(0, 100)}...`,
                includes: options.includes,
              },
              null,
              2,
            )}`,
          );
        }

        // Create tool instance
        const tool = new AddDesignPatternTool();

        // Execute the tool
        const includes = Array.isArray(options.includes)
          ? options.includes
          : options.includes
            ? [options.includes]
            : ['**/*'];
        const result = await tool.execute({
          template_name: template,
          pattern_name: patternName,
          design_pattern: designPattern,
          description: description,
          includes: includes,
        });

        // Parse and display result
        const firstContent = result.content[0];
        if (firstContent.type !== 'text') {
          print.error('❌ Error: Unexpected response type');
          process.exit(1);
        }

        if (result.isError) {
          const errorData = JSON.parse(firstContent.text);
          print.error('❌ Error:', errorData.error);
          process.exit(1);
        }

        const successData = JSON.parse(firstContent.text);
        print.info(`✅ ${successData.message}`);
        print.info(`📄 File: ${successData.file}`);

        if (options.verbose) {
          print.info('\nPattern added:');
          print.info(JSON.stringify(successData.pattern, null, 2));
        }
      } catch (error) {
        print.error(
          '❌ Error executing add-pattern:',
          error instanceof Error ? error : String(error),
        );
        process.exit(1);
      }
    },
  );
