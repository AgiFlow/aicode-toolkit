import { print } from '@agiflowai/aicode-utils';
import { Command } from 'commander';
import { WriteToFileTool } from '../tools';
import { assertToolSuccess, loadTextOption } from './utils';

interface FileWriteOptions {
  content?: string;
  contentFile?: string;
}

export const fileCommand = new Command('file').description('Workspace file utilities');

fileCommand
  .command('write <filePath>')
  .description('Write content to a file inside the current workspace')
  .option('--content <text>', 'Content to write')
  .option('--content-file <path>', 'Read content to write from a file')
  .action(async (filePath: string, options: FileWriteOptions): Promise<void> => {
    try {
      const content = await loadTextOption({
        value: options.content,
        filePath: options.contentFile,
        valueFlag: '--content',
        fileFlag: '--content-file',
        required: true,
      });

      const tool = new WriteToFileTool();
      const result = await tool.execute({
        file_path: filePath,
        content,
      });

      print.info(assertToolSuccess(result));
    } catch (error) {
      print.error('Error writing file:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
