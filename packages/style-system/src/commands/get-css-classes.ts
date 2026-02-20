/**
 * Get CSS Classes CLI Command
 */

import { print } from '@agiflowai/aicode-utils';
import { Command } from 'commander';
import { GetCSSClassesTool } from '../tools/GetCSSClassesTool';

interface GetCSSClassesOptions {
  category: string;
  appPath?: string;
  themePath: string;
}

export const getCSSClassesCommand = new Command('get-css-classes')
  .description('Extract and return all valid CSS classes from a theme CSS file')
  .option(
    '-c, --category <category>',
    "Category filter: 'colors', 'typography', 'spacing', 'effects', 'all'",
    'all',
  )
  .option(
    '-a, --app-path <path>',
    'App path to read theme path from project.json (e.g., "apps/agiflow-app")',
  )
  .option(
    '-t, --theme-path <path>',
    'Default theme CSS file path relative to workspace root (used if appPath not provided or themePath not in project.json)',
    'packages/frontend/web-theme/src/agimon-theme.css',
  )
  .action(async (options: GetCSSClassesOptions): Promise<void> => {
    try {
      // Instantiate tool with default theme path from command line args
      const tool = new GetCSSClassesTool(options.themePath);
      const result = await tool.execute({
        category: options.category,
        appPath: options.appPath,
      });

      if (result.isError) {
        const firstContent = result.content[0];
        const errorText = firstContent?.type === 'text' ? firstContent.text : 'Unknown error';
        throw new Error(errorText);
      }

      const firstContent = result.content[0];
      print.info(firstContent?.type === 'text' ? firstContent.text : '');
    } catch (error) {
      print.error(
        'Error getting CSS classes:',
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });
