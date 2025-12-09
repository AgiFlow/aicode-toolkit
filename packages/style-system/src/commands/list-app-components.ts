/**
 * List App Components CLI Command
 */

import { Command } from 'commander';
import { ListAppComponentsTool } from '../tools/ListAppComponentsTool';

interface ListAppComponentsOptions {
  appPath: string;
  cursor?: string;
}

export const listAppComponentsCommand = new Command('list-app-components')
  .description(
    "List app-specific components and package components. Reads the app's package.json to find workspace dependencies.",
  )
  .requiredOption(
    '-a, --app-path <path>',
    'The app path (relative or absolute) to list components for (e.g., "apps/agiflow-app")',
  )
  .option('-c, --cursor <cursor>', 'Pagination cursor to fetch the next page')
  .action(async (options: ListAppComponentsOptions): Promise<void> => {
    try {
      const tool = new ListAppComponentsTool();
      const result = await tool.execute({ appPath: options.appPath, cursor: options.cursor });

      if (result.isError) {
        const firstContent = result.content[0];
        const errorText = firstContent?.type === 'text' ? firstContent.text : 'Unknown error';
        throw new Error(errorText);
      }

      const firstContent = result.content[0];
      console.log(firstContent?.type === 'text' ? firstContent.text : '');
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
