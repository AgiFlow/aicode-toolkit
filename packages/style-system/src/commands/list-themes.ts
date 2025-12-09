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

import { Command } from 'commander';
import type { DesignSystemConfig } from '../config';
import { ListThemesTool } from '../tools/ListThemesTool';

/**
 * Default configuration for list-themes command
 */
const DEFAULT_CONFIG: DesignSystemConfig = {
  type: 'tailwind',
  themeProvider: '@agimonai/web-ui',
};

/**
 * List all available theme configurations from packages/frontend/shared-theme/configs
 */
export const listThemesCommand = new Command('list-themes')
  .description('List all available theme configurations from packages/frontend/shared-theme/configs')
  .action(async () => {
    try {
      const tool = new ListThemesTool(DEFAULT_CONFIG);
      const result = await tool.execute({});

      if (result.isError) {
        const firstContent = result.content[0];
        const errorText = firstContent?.type === 'text' ? firstContent.text : 'Unknown error';
        throw new Error(errorText);
      }

      const firstContent = result.content[0];
      console.log(firstContent?.type === 'text' ? firstContent.text : '');
    } catch (error) {
      console.error('Error listing themes:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
