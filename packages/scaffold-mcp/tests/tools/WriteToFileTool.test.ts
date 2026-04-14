import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WriteToFileTool } from '../../src/tools/WriteToFileTool';

// Mock the service
vi.mock('../../src/services/FileSystemService');

describe('WriteToFileTool', () => {
  let tool: WriteToFileTool;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    cwdSpy?.mockRestore();
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/workspace');
    tool = new WriteToFileTool();
  });

  describe('getDefinition', () => {
    it('should return tool definition with correct schema', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('write-to-file');
      expect(definition.description).toBeTruthy();
      expect(definition.description).toContain('Writes content to a file');
      expect(definition.inputSchema.type).toBe('object');
      expect(definition.inputSchema.required).toContain('file_path');
      expect(definition.inputSchema.required).toContain('content');
    });

    it('should include file_path and content in schema', () => {
      const definition = tool.getDefinition();

      expect(definition.inputSchema.properties.file_path).toBeDefined();
      expect(definition.inputSchema.properties.file_path.type).toBe('string');
      expect(definition.inputSchema.properties.content).toBeDefined();
      expect(definition.inputSchema.properties.content.type).toBe('string');
    });
  });

  describe('execute', () => {
    it('should write file successfully with absolute path', async () => {
      const args = {
        file_path: '/workspace/test/output/file.txt',
        content: 'Hello, World!',
      };

      const ensureDirSpy = vi.spyOn(tool.fileSystemService, 'ensureDir');
      const writeFileSpy = vi.spyOn(tool.fileSystemService, 'writeFile');
      ensureDirSpy.mockResolvedValue();
      writeFileSpy.mockResolvedValue();

      const result = await tool.execute(args);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Successfully wrote content to file');
      expect(result.content[0].text).toContain('/workspace/test/output/file.txt');
      expect(ensureDirSpy).toHaveBeenCalledWith('/workspace/test/output');
      expect(writeFileSpy).toHaveBeenCalledWith('/workspace/test/output/file.txt', 'Hello, World!');
    });

    it('should write file successfully with relative path', async () => {
      const args = {
        file_path: 'output/file.txt',
        content: 'Test content',
      };

      const ensureDirSpy = vi.spyOn(tool.fileSystemService, 'ensureDir');
      const writeFileSpy = vi.spyOn(tool.fileSystemService, 'writeFile');
      ensureDirSpy.mockResolvedValue();
      writeFileSpy.mockResolvedValue();

      const result = await tool.execute(args);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Successfully wrote content to file');
      expect(ensureDirSpy).toHaveBeenCalled();
      expect(writeFileSpy).toHaveBeenCalled();
    });

    it('should handle empty content', async () => {
      const args = {
        file_path: '/workspace/test/empty.txt',
        content: '',
      };

      const ensureDirSpy = vi.spyOn(tool.fileSystemService, 'ensureDir');
      const writeFileSpy = vi.spyOn(tool.fileSystemService, 'writeFile');
      ensureDirSpy.mockResolvedValue();
      writeFileSpy.mockResolvedValue();

      const result = await tool.execute(args);

      expect(result.isError).toBeFalsy();
      expect(writeFileSpy).toHaveBeenCalledWith('/workspace/test/empty.txt', '');
    });

    it('should return error when file_path is missing', async () => {
      const args = {
        content: 'Test content',
      };

      const result = await tool.execute(args);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing required parameter: file_path');
    });

    it('should return error when content is missing', async () => {
      const args = {
        file_path: '/workspace/test/file.txt',
      };

      const result = await tool.execute(args);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing required parameter: content');
    });

    it('should handle file system errors gracefully', async () => {
      const args = {
        file_path: '/workspace/test/file.txt',
        content: 'Test',
      };

      const ensureDirSpy = vi.spyOn(tool.fileSystemService, 'ensureDir');
      ensureDirSpy.mockRejectedValue(new Error('Permission denied'));

      const result = await tool.execute(args);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Permission denied');
    });

    it('should create parent directories before writing', async () => {
      const args = {
        file_path: '/workspace/deep/nested/path/file.txt',
        content: 'content',
      };

      const ensureDirSpy = vi.spyOn(tool.fileSystemService, 'ensureDir');
      const writeFileSpy = vi.spyOn(tool.fileSystemService, 'writeFile');
      ensureDirSpy.mockResolvedValue();
      writeFileSpy.mockResolvedValue();

      await tool.execute(args);

      expect(ensureDirSpy).toHaveBeenCalledWith('/workspace/deep/nested/path');
      expect(writeFileSpy).toHaveBeenCalled();
    });

    it('should reject absolute paths outside the workspace', async () => {
      const args = {
        file_path: '/tmp/aicode-toolkit-poc.txt',
        content: 'blocked',
      };

      const ensureDirSpy = vi.spyOn(tool.fileSystemService, 'ensureDir');
      const writeFileSpy = vi.spyOn(tool.fileSystemService, 'writeFile');

      const result = await tool.execute(args);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('outside the workspace directory');
      expect(ensureDirSpy).not.toHaveBeenCalled();
      expect(writeFileSpy).not.toHaveBeenCalled();
    });

    it('should reject relative traversal outside the workspace', async () => {
      const args = {
        file_path: '../outside.txt',
        content: 'blocked',
      };

      const ensureDirSpy = vi.spyOn(tool.fileSystemService, 'ensureDir');
      const writeFileSpy = vi.spyOn(tool.fileSystemService, 'writeFile');

      const result = await tool.execute(args);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('outside the workspace directory');
      expect(ensureDirSpy).not.toHaveBeenCalled();
      expect(writeFileSpy).not.toHaveBeenCalled();
    });
  });
});
