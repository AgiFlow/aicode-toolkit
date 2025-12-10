/**
 * List Themes Command
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

import { print } from '@agiflowai/aicode-utils';
import { Command } from 'commander';
import { ListThemesTool } from '../tools/ListThemesTool';

interface ListThemesOptions {
  appPath?: string;
}

/**
 * List all available theme configurations from CSS files
 */
export const listThemesCommand = new Command('list-themes')
  .description(
    'List all available theme configurations from CSS files configured in project.json style-system config',
  )
  .option(
    '-a, --app-path <path>',
    'App path to read theme config from project.json (e.g., "apps/my-app")',
  )
  .action(async (options: ListThemesOptions): Promise<void> => {
    try {
      const tool = new ListThemesTool();
      const result = await tool.execute({ appPath: options.appPath });

      if (result.isError) {
        const firstContent = result.content[0];
        const errorText = firstContent?.type === 'text' ? firstContent.text : 'Unknown error';
        throw new Error(errorText);
      }

      const firstContent = result.content[0];
      print.info(firstContent?.type === 'text' ? firstContent.text : '');
    } catch (error) {
      print.error('Error listing themes:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
