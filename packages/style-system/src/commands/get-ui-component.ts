/**
 * Get UI Component CLI Command
 */

import { Command } from 'commander';
import { GetComponentVisualTool } from '../tools/GetComponentVisualTool';

interface GetUiComponentOptions {
  componentName: string;
  appPath: string;
  storyName: string;
  darkMode: boolean;
}

export const getUiComponentCommand = new Command('get-ui-component')
  .description(
    'Get a screenshot of a UI component rendered with app-specific design system configuration. Returns screenshot path and story file content.',
  )
  .requiredOption(
    '-c, --component-name <name>',
    'The name of the component to capture (e.g., "Button", "Card")',
  )
  .requiredOption(
    '-a, --app-path <path>',
    'The app path (relative or absolute) to load design system config from (e.g., "apps/agiflow-app")',
  )
  .option(
    '-s, --story-name <name>',
    'The story name to render (e.g., "Playground", "Default")',
    'Playground',
  )
  .option('-d, --dark-mode', 'Render the component in dark mode', false)
  .action(async (options: GetUiComponentOptions): Promise<void> => {
    try {
      const tool = new GetComponentVisualTool();
      const result = await tool.execute({
        componentName: options.componentName,
        appPath: options.appPath,
        storyName: options.storyName,
        darkMode: options.darkMode,
      });

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
