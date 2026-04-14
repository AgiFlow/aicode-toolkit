import path from 'node:path';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { FileSystemService } from '../services/FileSystemService';
import type { ToolDefinition } from './types';

export class WriteToFileTool {
  static readonly TOOL_NAME = 'write-to-file';

  private fileSystemService: FileSystemService;

  constructor() {
    this.fileSystemService = new FileSystemService();
  }

  private resolveWorkspaceFilePath(filePath: string): string {
    const workspaceRoot = path.resolve(process.cwd());
    const resolvedPath = path.resolve(workspaceRoot, filePath);
    const relativeToWorkspace = path.relative(workspaceRoot, resolvedPath);
    const isWithinWorkspace =
      !relativeToWorkspace.startsWith(`..${path.sep}`) &&
      relativeToWorkspace !== '..' &&
      !path.isAbsolute(relativeToWorkspace);

    if (!isWithinWorkspace) {
      throw new Error(`Path "${filePath}" is outside the workspace directory`);
    }

    return resolvedPath;
  }

  /**
   * Get the tool definition for MCP
   */
  getDefinition(): ToolDefinition {
    return {
      name: WriteToFileTool.TOOL_NAME,
      description: `Writes content to a file, creating the file and any necessary directories if they don't exist.

This tool will:
- Create the target file if it doesn't exist
- Create any necessary parent directories
- Write the provided content to the file
- Overwrite existing files with new content

Parameters:
- file_path: Absolute or relative path to a file inside the current workspace
- content: The content to write to the file`,
      inputSchema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Path to the file to write within the current workspace directory',
          },
          content: {
            type: 'string',
            description: 'Content to write to the file',
          },
        },
        required: ['file_path', 'content'],
        additionalProperties: false,
      },
    };
  }

  /**
   * Execute the tool
   */
  async execute(args: Record<string, any>): Promise<CallToolResult> {
    try {
      const { file_path, content } = args as { file_path: string; content: string };

      if (!file_path) {
        throw new Error('Missing required parameter: file_path');
      }

      if (content === undefined || content === null) {
        throw new Error('Missing required parameter: content');
      }

      const resolvedPath = this.resolveWorkspaceFilePath(file_path);

      // Ensure the directory exists
      const dirPath = path.dirname(resolvedPath);
      await this.fileSystemService.ensureDir(dirPath);

      // Write the content to the file
      await this.fileSystemService.writeFile(resolvedPath, content);

      return {
        content: [
          {
            type: 'text',
            text: `Successfully wrote content to file: ${resolvedPath}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error writing to file: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
}
