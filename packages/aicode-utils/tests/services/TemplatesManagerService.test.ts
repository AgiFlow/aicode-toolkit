/**
 * TemplatesManagerService Tests
 *
 * TESTING PATTERNS:
 * - Unit tests for each public method
 * - Test success cases, error cases, and edge cases
 * - Mock external dependencies
 * - Use descriptive test names that explain what is being tested
 *
 * CODING STANDARDS:
 * - Use Vitest testing framework
 * - Group related tests with describe blocks
 * - Use beforeEach for test setup
 * - Clear test names: 'should [expected behavior] when [condition]'
 * - Test both happy paths and error scenarios
 *
 * AVOID:
 * - Testing implementation details (test behavior, not internals)
 * - Shared state between tests (use beforeEach for clean setup)
 * - Overly complex test setup (keep tests simple and focused)
 */

import path from 'node:path';
import * as fs from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TemplatesManagerService } from '../../src/services/TemplatesManagerService';
import * as fsHelpers from '../../src/utils/fsHelpers';

// Mock fsHelpers
vi.mock('../../src/utils/fsHelpers', () => ({
  pathExists: vi.fn(),
  pathExistsSync: vi.fn(),
}));

// Mock node:fs/promises for stat
vi.mock('node:fs/promises', () => ({
  stat: vi.fn(),
  readFile: vi.fn(),
}));

describe('TemplatesManagerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getConfigFileName', () => {
    it('should return scaffold config file name', () => {
      expect(TemplatesManagerService.getConfigFileName()).toBe('scaffold.yaml');
    });
  });

  describe('getTemplatesFolderName', () => {
    it('should return templates folder name', () => {
      expect(TemplatesManagerService.getTemplatesFolderName()).toBe('templates');
    });
  });

  describe('isInitialized', () => {
    it('should return true when templates directory exists and is a directory', async () => {
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

      const result = await TemplatesManagerService.isInitialized('/path/to/templates');
      expect(result).toBe(true);
    });

    it('should return false when templates directory does not exist', async () => {
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(false);

      const result = await TemplatesManagerService.isInitialized('/path/to/templates');
      expect(result).toBe(false);
    });

    it('should return false when path exists but is not a directory', async () => {
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as any);

      const result = await TemplatesManagerService.isInitialized('/path/to/templates');
      expect(result).toBe(false);
    });
  });

  describe('findTemplatesPathSync', () => {
    it('should find templates folder in workspace root', () => {
      const mockCwd = process.cwd();
      const gitPath = path.join(mockCwd, '.git');
      const templatesPath = path.join(mockCwd, 'templates');

      vi.mocked(fsHelpers.pathExistsSync).mockImplementation((p: string) => {
        if (p === gitPath) return true;
        if (p === templatesPath) return true;
        if (p === path.join(mockCwd, 'toolkit.yaml')) return false;
        return false;
      });

      const result = TemplatesManagerService.findTemplatesPathSync();
      expect(result).toBe(templatesPath);
    });

    it('should throw error when templates folder not found', () => {
      vi.mocked(fsHelpers.pathExistsSync).mockReturnValue(false);

      expect(() => {
        TemplatesManagerService.findTemplatesPathSync();
      }).toThrow('Templates folder not found');
    });
  });

  describe('findTemplatesPath', () => {
    it('should find templates folder in workspace root', async () => {
      const mockCwd = process.cwd();
      const gitPath = path.join(mockCwd, '.git');
      const templatesPath = path.join(mockCwd, 'templates');

      vi.mocked(fsHelpers.pathExists).mockImplementation(async (p: string) => {
        if (p === gitPath) return true;
        if (p === templatesPath) return true;
        if (p === path.join(mockCwd, 'toolkit.yaml')) return false;
        return false;
      });

      const result = await TemplatesManagerService.findTemplatesPath();
      expect(result).toBe(templatesPath);
    });

    it('should throw error when templates folder not found', async () => {
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(false);

      await expect(TemplatesManagerService.findTemplatesPath()).rejects.toThrow(
        'Templates folder not found',
      );
    });
  });
});
