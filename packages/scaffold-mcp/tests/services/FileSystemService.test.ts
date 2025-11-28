import * as fsHelpers from '@agiflowai/aicode-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileSystemService } from '../../src/services/FileSystemService';

// Mock @agiflowai/aicode-utils
vi.mock('@agiflowai/aicode-utils', async () => {
  const actual = await vi.importActual('@agiflowai/aicode-utils');
  return {
    ...actual,
    pathExists: vi.fn(),
    readFile: vi.fn(),
    readJson: vi.fn(),
    writeFile: vi.fn(),
    ensureDir: vi.fn(),
    copy: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
  };
});

describe('FileSystemService', () => {
  let service: FileSystemService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FileSystemService();
  });

  describe('pathExists', () => {
    it('should check if path exists', async () => {
      await service.pathExists('/test/path');

      expect(fsHelpers.pathExists).toHaveBeenCalledWith('/test/path');
    });

    it('should call pathExists for non-existent path', async () => {
      await service.pathExists('/non/existent');

      expect(fsHelpers.pathExists).toHaveBeenCalledWith('/non/existent');
    });
  });

  describe('readFile', () => {
    it('should read file with default encoding', async () => {
      await service.readFile('/test/file.txt');

      expect(fsHelpers.readFile).toHaveBeenCalledWith('/test/file.txt', 'utf8');
    });

    it('should read file with custom encoding', async () => {
      await service.readFile('/test/file.txt', 'ascii');

      expect(fsHelpers.readFile).toHaveBeenCalledWith('/test/file.txt', 'ascii');
    });
  });

  describe('readJson', () => {
    it('should read and parse JSON file', async () => {
      const jsonData = { key: 'value' };
      vi.mocked(fsHelpers.readJson).mockResolvedValue(jsonData);

      const result = await service.readJson('/test/file.json');

      expect(result).toEqual(jsonData);
      expect(fsHelpers.readJson).toHaveBeenCalledWith('/test/file.json');
    });
  });

  describe('writeFile', () => {
    it('should write file with default encoding', async () => {
      vi.mocked(fsHelpers.writeFile).mockResolvedValue(undefined);

      await service.writeFile('/test/file.txt', 'content');

      expect(fsHelpers.writeFile).toHaveBeenCalledWith('/test/file.txt', 'content', 'utf8');
    });

    it('should write file with custom encoding', async () => {
      vi.mocked(fsHelpers.writeFile).mockResolvedValue(undefined);

      await service.writeFile('/test/file.txt', 'content', 'ascii');

      expect(fsHelpers.writeFile).toHaveBeenCalledWith('/test/file.txt', 'content', 'ascii');
    });
  });

  describe('ensureDir', () => {
    it('should ensure directory exists', async () => {
      vi.mocked(fsHelpers.ensureDir).mockResolvedValue(undefined);

      await service.ensureDir('/test/dir');

      expect(fsHelpers.ensureDir).toHaveBeenCalledWith('/test/dir');
    });
  });

  describe('copy', () => {
    it('should copy files or directories', async () => {
      vi.mocked(fsHelpers.copy).mockResolvedValue(undefined);

      await service.copy('/src/path', '/dest/path');

      expect(fsHelpers.copy).toHaveBeenCalledWith('/src/path', '/dest/path');
    });
  });

  describe('readdir', () => {
    it('should read directory contents', async () => {
      const files = ['file1.txt', 'file2.txt'];
      vi.mocked(fsHelpers.readdir).mockResolvedValue(files as any);

      const result = await service.readdir('/test/dir');

      expect(result).toEqual(files);
      expect(fsHelpers.readdir).toHaveBeenCalledWith('/test/dir');
    });
  });

  describe('stat', () => {
    it('should get file stats', async () => {
      const stats = {
        isDirectory: () => false,
        isFile: () => true,
      };
      vi.mocked(fsHelpers.stat).mockResolvedValue(stats as any);

      const result = await service.stat('/test/file.txt');

      expect(result.isFile()).toBe(true);
      expect(result.isDirectory()).toBe(false);
      expect(fsHelpers.stat).toHaveBeenCalledWith('/test/file.txt');
    });

    it('should identify directories', async () => {
      const stats = {
        isDirectory: () => true,
        isFile: () => false,
      };
      vi.mocked(fsHelpers.stat).mockResolvedValue(stats as any);

      const result = await service.stat('/test/dir');

      expect(result.isDirectory()).toBe(true);
      expect(result.isFile()).toBe(false);
    });
  });
});
