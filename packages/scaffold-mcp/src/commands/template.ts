import { print } from '@agiflowai/aicode-utils';
import { Command } from 'commander';
import { GenerateBoilerplateFileTool } from '../tools';
import {
  assertToolSuccess,
  detectMonolithMode,
  loadTextOption,
  resolveTemplatesPath,
} from './utils';

interface TemplateFileCreateOptions {
  template?: string;
  content?: string;
  contentFile?: string;
  sourceFile?: string;
  header?: string;
  headerFile?: string;
}

export const templateCommand = new Command('template').description(
  'Manage scaffold template authoring assets',
);

const fileCommand = new Command('file').description('Manage template files');

fileCommand
  .command('create <filePath>')
  .description('Create or update a Liquid template file for a boilerplate or feature')
  .option('-t, --template <name>', 'Template name (optional in monolith mode)')
  .option('--content <text>', 'Template file content')
  .option('--content-file <path>', 'Read template file content from a file')
  .option('--source-file <path>', 'Copy content from an existing source file')
  .option('--header <text>', 'Header comment to prepend to the template file')
  .option('--header-file <path>', 'Read header comment from a file')
  .action(async (filePath: string, options: TemplateFileCreateOptions): Promise<void> => {
    try {
      const contentInputs = [
        options.content !== undefined,
        options.contentFile !== undefined,
        options.sourceFile !== undefined,
      ].filter(Boolean).length;

      if (contentInputs !== 1) {
        throw new Error('Use exactly one of --content, --content-file, or --source-file');
      }

      const templatesPath = await resolveTemplatesPath();
      const isMonolith = await detectMonolithMode();
      const content = await loadTextOption({
        value: options.content,
        filePath: options.contentFile,
        valueFlag: '--content',
        fileFlag: '--content-file',
      });
      const header = await loadTextOption({
        value: options.header,
        filePath: options.headerFile,
        valueFlag: '--header',
        fileFlag: '--header-file',
      });

      const tool = new GenerateBoilerplateFileTool(templatesPath, isMonolith);
      const result = await tool.execute({
        templateName: options.template,
        filePath,
        content,
        sourceFile: options.sourceFile,
        header,
      });

      print.info(assertToolSuccess(result));
    } catch (error) {
      print.error(
        'Error creating template file:',
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

templateCommand.addCommand(fileCommand);
