/**
 * List Shared Components CLI Command
 */

import { print } from '@agiflowai/aicode-utils';
import { Command } from 'commander';
import { ListSharedComponentsTool } from '../tools/ListSharedComponentsTool';

interface ListSharedComponentsOptions {
  cursor?: string;
}

export const listSharedComponentsCommand = new Command('list-shared-components')
  .description('List all shared UI components available in the design system')
  .option('-c, --cursor <cursor>', 'Pagination cursor to fetch the next page')
  .action(async (options: ListSharedComponentsOptions): Promise<void> => {
    try {
      const tool = new ListSharedComponentsTool();
      const result = await tool.execute({ cursor: options.cursor });

      if (result.isError) {
        const firstContent = result.content[0];
        const errorText = firstContent?.type === 'text' ? firstContent.text : 'Unknown error';
        throw new Error(errorText);
      }

      const firstContent = result.content[0];
      print.info(firstContent?.type === 'text' ? firstContent.text : '');
    } catch (error) {
      print.error('Error listing shared components:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
