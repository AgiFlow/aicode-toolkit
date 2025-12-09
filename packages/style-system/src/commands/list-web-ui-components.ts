/**
 * List Web UI Components CLI Command
 */

import { log } from '@agiflowai/aicode-utils';
import { Command } from 'commander';
import { ListWebUiComponentsTool } from '../tools/ListWebUiComponentsTool';

interface ListWebUiComponentsOptions {
  cursor?: string;
}

export const listWebUiComponentsCommand = new Command('list-web-ui-components')
  .description('List all web UI components available in the design system (filtered by style-system tag)')
  .option('-c, --cursor <cursor>', 'Pagination cursor to fetch the next page')
  .action(async (options: ListWebUiComponentsOptions): Promise<void> => {
    try {
      const tool = new ListWebUiComponentsTool();
      const result = await tool.execute({ cursor: options.cursor });

      if (result.isError) {
        const firstContent = result.content[0];
        const errorText = firstContent?.type === 'text' ? firstContent.text : 'Unknown error';
        throw new Error(errorText);
      }

      const firstContent = result.content[0];
      log.info(firstContent?.type === 'text' ? firstContent.text : '');
    } catch (error) {
      log.error('Error listing web UI components:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
