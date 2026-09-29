import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WriteToFileTool } from '../../src/tools/WriteToFileTool';
import { getText } from '../helpers/getText';
import type { FileSystemService } from '../../src/services/FileSystemService';

// Mock the service
vi.mock('../../src/services/FileSystemService');

/** Exposes the tool's private service so tests can spy on it. */
function internals(tool: WriteToFileTool): { fileSystemService: FileSystemService } {
  return tool as unknown as { fileSystemService: FileSystemService };
}

describe('WriteToFileTool', () => {
  let tool: WriteToFileTool;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    cwdSpy?.mockRestore();
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/workspace');
    tool = new WriteToFileTool();
  });

  it('keeps its captured workspace after the process working directory changes', async () => {
    cwdSpy.mockReturnValue('/another-checkout');
    const result = await tool.execute({ file_path: 'result.txt', content: 'original workspace' });
    expect(result.isError).toBeFalsy();
    expect(internals(tool).fileSystemService.writeFile).toHaveBeenCalledWith(
      '/workspace/result.txt',
      'original workspace',
    );
  });

  it('keeps two explicit workspaces isolated in one process', async () => {
    const first = new WriteToFileTool('/checkout-a');
    const second = new WriteToFileTool('/checkout-b');
    await Promise.all([
      first.execute({ file_path: 'result.txt', content: 'a' }),
      second.execute({ file_path: 'result.txt', content: 'b' }),
    ]);
    expect(internals(first).fileSystemService.writeFile).toHaveBeenCalledWith(
      '/checkout-a/result.txt',
      'a',
    );
    expect(internals(second).fileSystemService.writeFile).toHaveBeenCalledWith(
      '/checkout-b/result.txt',
      'b',
    );
    const rejected = await first.execute({
      file_path: '/checkout-b/result.txt',
      content: 'wrong workspace',
    });
    expect(rejected.isError).toBe(true);
    expect(internals(first).fileSystemService.writeFile).toHaveBeenCalledTimes(1);
  });

  it('rejects non-string contents before touching the filesystem', async () => {
    const result = await tool.execute({ file_path: 'result.txt', content: 123 });
    expect(result.isError).toBe(true);
    expect(internals(tool).fileSystemService.writeFile).not.toHaveBeenCalled();
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

      const ensureDirSpy = vi.spyOn(internals(tool).fileSystemService, 'ensureDir');
      const writeFileSpy = vi.spyOn(internals(tool).fileSystemService, 'writeFile');
      ensureDirSpy.mockResolvedValue();
      writeFileSpy.mockResolvedValue();

      const result = await tool.execute(args);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].type).toBe('text');
      expect(getText(result.content[0])).toContain('Successfully wrote content to file');
      expect(getText(result.content[0])).toContain('/workspace/test/output/file.txt');
      expect(ensureDirSpy).toHaveBeenCalledWith('/workspace/test/output');
      expect(writeFileSpy).toHaveBeenCalledWith('/workspace/test/output/file.txt', 'Hello, World!');
    });

    it('should write file successfully with relative path', async () => {
      const args = {
        file_path: 'output/file.txt',
        content: 'Test content',
      };

      const ensureDirSpy = vi.spyOn(internals(tool).fileSystemService, 'ensureDir');
      const writeFileSpy = vi.spyOn(internals(tool).fileSystemService, 'writeFile');
      ensureDirSpy.mockResolvedValue();
      writeFileSpy.mockResolvedValue();

      const result = await tool.execute(args);

      expect(result.isError).toBeFalsy();
      expect(getText(result.content[0])).toContain('Successfully wrote content to file');
      expect(ensureDirSpy).toHaveBeenCalled();
      expect(writeFileSpy).toHaveBeenCalled();
    });

    it('should handle empty content', async () => {
      const args = {
        file_path: '/workspace/test/empty.txt',
        content: '',
      };

      const ensureDirSpy = vi.spyOn(internals(tool).fileSystemService, 'ensureDir');
      const writeFileSpy = vi.spyOn(internals(tool).fileSystemService, 'writeFile');
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
      expect(getText(result.content[0])).toContain('Missing required parameter: file_path');
    });

    it('should return error when content is missing', async () => {
      const args = {
        file_path: '/workspace/test/file.txt',
      };

      const result = await tool.execute(args);

      expect(result.isError).toBe(true);
      expect(getText(result.content[0])).toContain('Missing required parameter: content');
    });

    it('should handle file system errors gracefully', async () => {
      const args = {
        file_path: '/workspace/test/file.txt',
        content: 'Test',
      };

      const ensureDirSpy = vi.spyOn(internals(tool).fileSystemService, 'ensureDir');
      ensureDirSpy.mockRejectedValue(new Error('Permission denied'));

      const result = await tool.execute(args);

      expect(result.isError).toBe(true);
      expect(getText(result.content[0])).toContain('Permission denied');
    });

    it('should create parent directories before writing', async () => {
      const args = {
        file_path: '/workspace/deep/nested/path/file.txt',
        content: 'content',
      };

      const ensureDirSpy = vi.spyOn(internals(tool).fileSystemService, 'ensureDir');
      const writeFileSpy = vi.spyOn(internals(tool).fileSystemService, 'writeFile');
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

      const ensureDirSpy = vi.spyOn(internals(tool).fileSystemService, 'ensureDir');
      const writeFileSpy = vi.spyOn(internals(tool).fileSystemService, 'writeFile');

      const result = await tool.execute(args);

      expect(result.isError).toBe(true);
      expect(getText(result.content[0])).toContain('outside the workspace directory');
      expect(ensureDirSpy).not.toHaveBeenCalled();
      expect(writeFileSpy).not.toHaveBeenCalled();
    });

    it('should reject relative traversal outside the workspace', async () => {
      const args = {
        file_path: '../outside.txt',
        content: 'blocked',
      };

      const ensureDirSpy = vi.spyOn(internals(tool).fileSystemService, 'ensureDir');
      const writeFileSpy = vi.spyOn(internals(tool).fileSystemService, 'writeFile');

      const result = await tool.execute(args);

      expect(result.isError).toBe(true);
      expect(getText(result.content[0])).toContain('outside the workspace directory');
      expect(ensureDirSpy).not.toHaveBeenCalled();
      expect(writeFileSpy).not.toHaveBeenCalled();
    });
  });
});
