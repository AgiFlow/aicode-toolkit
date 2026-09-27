import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VariableReplacementService } from '../../src/services/VariableReplacementService';
import type { IFileSystemService, ITemplateService } from '../../src/types/interfaces';

describe('VariableReplacementService', () => {
  let service: VariableReplacementService;
  let mockFileSystem: IFileSystemService;
  let mockTemplateService: ITemplateService;

  beforeEach(() => {
    mockFileSystem = {
      readdir: vi.fn(),
      stat: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      pathExists: vi.fn(),
      readJson: vi.fn(),
      ensureDir: vi.fn(),
      copy: vi.fn(),
    };

    mockTemplateService = {
      renderString: vi.fn(),
      containsTemplateVariables: vi.fn(),
    };

    service = new VariableReplacementService(mockFileSystem, mockTemplateService);
  });

  describe('isBinaryFile', () => {
    it('should identify binary files by extension', () => {
      expect(service.isBinaryFile('image.png')).toBe(true);
      expect(service.isBinaryFile('image.jpg')).toBe(true);
      expect(service.isBinaryFile('font.woff2')).toBe(true);
      expect(service.isBinaryFile('archive.zip')).toBe(true);
      expect(service.isBinaryFile('doc.pdf')).toBe(true);
    });

    it('should not identify text files as binary', () => {
      expect(service.isBinaryFile('file.txt')).toBe(false);
      expect(service.isBinaryFile('file.js')).toBe(false);
      expect(service.isBinaryFile('file.ts')).toBe(false);
      expect(service.isBinaryFile('file.json')).toBe(false);
      expect(service.isBinaryFile('file.md')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(service.isBinaryFile('image.PNG')).toBe(true);
      expect(service.isBinaryFile('image.JPG')).toBe(true);
    });
  });

  describe('replaceVariablesInFile', () => {
    it('should replace variables in text files', async () => {
      const filePath = '/test/file.txt';
      const variables = { name: 'John', age: 30 };
      const content = 'Hello {{ name }}, you are {{ age }} years old';
      const rendered = 'Hello John, you are 30 years old';

      vi.mocked(mockFileSystem.readFile).mockResolvedValue(content);
      vi.mocked(mockTemplateService.renderString).mockReturnValue(rendered);
      vi.mocked(mockFileSystem.writeFile).mockResolvedValue();

      await service.replaceVariablesInFile(filePath, variables);

      expect(mockFileSystem.readFile).toHaveBeenCalledWith(filePath, 'utf8');
      expect(mockTemplateService.renderString).toHaveBeenCalledWith(content, variables);
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(filePath, rendered, 'utf8');
    });

    it('should skip binary files', async () => {
      const filePath = '/test/image.png';
      const variables = { name: 'test' };

      await service.replaceVariablesInFile(filePath, variables);

      expect(mockFileSystem.readFile).not.toHaveBeenCalled();
      expect(mockTemplateService.renderString).not.toHaveBeenCalled();
      expect(mockFileSystem.writeFile).not.toHaveBeenCalled();
    });

    it('should handle file read errors gracefully', async () => {
      const filePath = '/test/file.txt';
      const variables = { name: 'test' };

      vi.mocked(mockFileSystem.readFile).mockRejectedValue(new Error('Permission denied'));

      // Should not throw
      await expect(service.replaceVariablesInFile(filePath, variables)).resolves.toBeUndefined();
      expect(mockFileSystem.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('processFilesForVariableReplacement', () => {
    it('should process all files in directory recursively', async () => {
      const dirPath = '/test/dir';
      const variables = { name: 'test' };

      vi.mocked(mockFileSystem.readdir).mockImplementation(async (path: string) => {
        if (path === dirPath) return ['file1.txt', 'subdir'];
        if (path === '/test/dir/subdir') return ['file2.txt'];
        return [];
      });

      vi.mocked(mockFileSystem.stat).mockImplementation(async (path: string) => {
        if (path.includes('subdir') && !path.includes('file2')) {
          return { isDirectory: () => true, isFile: () => false } as any;
        }
        return { isDirectory: () => false, isFile: () => true } as any;
      });

      vi.mocked(mockFileSystem.readFile).mockResolvedValue('content {{ name }}');
      vi.mocked(mockTemplateService.renderString).mockReturnValue('content test');
      vi.mocked(mockFileSystem.writeFile).mockResolvedValue();

      await service.processFilesForVariableReplacement(dirPath, variables);

      expect(mockFileSystem.readdir).toHaveBeenCalledWith(dirPath);
      expect(mockFileSystem.readdir).toHaveBeenCalledWith('/test/dir/subdir');
      expect(mockFileSystem.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should skip directories that cannot be read', async () => {
      const dirPath = '/test/dir';
      const variables = { name: 'test' };

      vi.mocked(mockFileSystem.readdir).mockRejectedValue(new Error('Permission denied'));

      // Should not throw
      await expect(
        service.processFilesForVariableReplacement(dirPath, variables),
      ).resolves.toBeUndefined();
      expect(mockFileSystem.stat).not.toHaveBeenCalled();
    });

    it('should skip items that cannot be stat-ed', async () => {
      const dirPath = '/test/dir';
      const variables = { name: 'test' };

      vi.mocked(mockFileSystem.readdir).mockResolvedValue(['file1.txt']);
      vi.mocked(mockFileSystem.stat).mockRejectedValue(new Error('Permission denied'));

      // Should not throw
      await expect(
        service.processFilesForVariableReplacement(dirPath, variables),
      ).resolves.toBeUndefined();
      expect(mockFileSystem.readFile).not.toHaveBeenCalled();
    });

    it('should skip empty items', async () => {
      const dirPath = '/test/dir';
      const variables = { name: 'test' };

      vi.mocked(mockFileSystem.readdir).mockResolvedValue(['', 'file.txt', null as any]);
      vi.mocked(mockFileSystem.stat).mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
      } as any);
      vi.mocked(mockFileSystem.readFile).mockResolvedValue('content');
      vi.mocked(mockTemplateService.renderString).mockReturnValue('content');
      vi.mocked(mockFileSystem.writeFile).mockResolvedValue();

      await service.processFilesForVariableReplacement(dirPath, variables);

      // Should only process file.txt, skipping empty and null items
      expect(mockFileSystem.stat).toHaveBeenCalledTimes(1);
    });
  });
});
