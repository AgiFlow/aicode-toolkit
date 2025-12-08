/**
 * TemplateSelectionService Tests
 *
 * TESTING PATTERNS:
 * - Unit tests with mocked dependencies
 * - Test each method independently
 * - Cover success cases, edge cases, and error handling
 *
 * CODING STANDARDS:
 * - Use descriptive test names (should...)
 * - Arrange-Act-Assert pattern
 * - Mock external dependencies
 * - Test behavior, not implementation
 */

import type { Dirent } from 'node:fs';
import os from 'node:os';
import * as fsHelpers from '@agiflowai/aicode-utils';
import { ProjectType } from '@agiflowai/aicode-utils';
import type { GitHubDirectoryEntry } from '@agiflowai/aicode-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TemplateSelectionService } from '../../src/services/TemplateSelectionService';

/** Repository configuration for downloading templates */
interface RepoConfig {
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

/**
 * Creates a mock Dirent object for testing readdir results.
 * Only implements the properties used by TemplateSelectionService.
 */
function createMockDirent(name: string, isDir: boolean): Dirent {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    path: '',
    parentPath: '',
  };
}

// Mock @agiflowai/aicode-utils including fs functions, print utilities, and git functions
vi.mock('@agiflowai/aicode-utils', async () => {
  const actual = await vi.importActual('@agiflowai/aicode-utils');
  return {
    ...actual,
    pathExists: vi.fn(),
    ensureDir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn(),
    copy: vi.fn(),
    remove: vi.fn(),
    cloneSubdirectory: vi.fn(),
    fetchGitHubDirectoryContents: vi.fn(),
    print: {
      info: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      indent: vi.fn(),
    },
  };
});

describe('TemplateSelectionService', () => {
  let service: TemplateSelectionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TemplateSelectionService();
  });

  describe('constructor', () => {
    it('should create tmp directory path with timestamp', () => {
      const tmpDir = service.getTmpDir();
      expect(tmpDir).toContain(os.tmpdir());
      expect(tmpDir).toContain('aicode-templates-');
    });
  });

  describe('downloadTemplatesToTmp', () => {
    const repoConfig: RepoConfig = {
      owner: 'AgiFlow',
      repo: 'aicode-toolkit',
      branch: 'main',
      path: 'templates',
    };

    it('should download templates to tmp directory', async () => {
      const mockContents: GitHubDirectoryEntry[] = [
        { name: 'nextjs-15', type: 'dir', path: 'templates/nextjs-15' },
        { name: 'typescript-mcp', type: 'dir', path: 'templates/typescript-mcp' },
        { name: 'README.md', type: 'file', path: 'templates/README.md' },
      ];

      vi.mocked(fsHelpers.fetchGitHubDirectoryContents).mockResolvedValue(mockContents);
      vi.mocked(fsHelpers.ensureDir).mockResolvedValue(undefined);
      vi.mocked(fsHelpers.cloneSubdirectory).mockResolvedValue(undefined);

      const result = await service.downloadTemplatesToTmp(repoConfig);

      expect(result).toBe(service.getTmpDir());
      expect(fsHelpers.fetchGitHubDirectoryContents).toHaveBeenCalledWith(
        'AgiFlow',
        'aicode-toolkit',
        'templates',
        'main',
      );
      // Should only clone directories (not files)
      expect(fsHelpers.cloneSubdirectory).toHaveBeenCalledTimes(2);
    });

    it('should throw error if no templates found', async () => {
      vi.mocked(fsHelpers.fetchGitHubDirectoryContents).mockResolvedValue([]);
      vi.mocked(fsHelpers.ensureDir).mockResolvedValue(undefined);

      await expect(service.downloadTemplatesToTmp(repoConfig)).rejects.toThrow(
        'No templates found in repository',
      );
    });

    it('should cleanup on download error', async () => {
      vi.mocked(fsHelpers.fetchGitHubDirectoryContents).mockRejectedValue(
        new Error('Network error'),
      );
      vi.mocked(fsHelpers.ensureDir).mockResolvedValue(undefined);
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(true);
      vi.mocked(fsHelpers.remove).mockResolvedValue(undefined);

      await expect(service.downloadTemplatesToTmp(repoConfig)).rejects.toThrow(
        'Failed to download templates',
      );
    });
  });

  describe('listTemplates', () => {
    it('should list templates with descriptions', async () => {
      const mockEntries: Dirent[] = [
        createMockDirent('nextjs-15', true),
        createMockDirent('typescript-mcp', true),
        createMockDirent('README.md', false),
      ];

      vi.mocked(fsHelpers.readdir).mockResolvedValue(mockEntries);
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(false);

      const templates = await service.listTemplates();

      expect(templates).toHaveLength(2);
      expect(templates[0].name).toBe('nextjs-15');
      expect(templates[1].name).toBe('typescript-mcp');
    });

    it('should read descriptions from scaffold.yaml', async () => {
      const mockEntries: Dirent[] = [createMockDirent('nextjs-15', true)];

      vi.mocked(fsHelpers.readdir).mockResolvedValue(mockEntries);
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(true);
      vi.mocked(fsHelpers.readFile).mockResolvedValue('description: Next.js 15 template');

      const templates = await service.listTemplates();

      expect(templates[0].description).toBe('Next.js 15 template');
    });
  });

  describe('copyTemplates', () => {
    const destinationPath = '/workspace/templates';

    it('should copy selected templates for monorepo', async () => {
      const templateNames = ['nextjs-15', 'typescript-mcp'];

      vi.mocked(fsHelpers.ensureDir).mockResolvedValue(undefined);
      // Source exists (true), destination doesn't exist (false)
      vi.mocked(fsHelpers.pathExists)
        .mockResolvedValueOnce(true) // nextjs-15 source exists
        .mockResolvedValueOnce(false) // nextjs-15 destination doesn't exist
        .mockResolvedValueOnce(true) // typescript-mcp source exists
        .mockResolvedValueOnce(false); // typescript-mcp destination doesn't exist
      vi.mocked(fsHelpers.copy).mockResolvedValue(undefined);

      await service.copyTemplates(templateNames, destinationPath, ProjectType.MONOREPO);

      expect(fsHelpers.copy).toHaveBeenCalledTimes(2);
    });

    it('should allow single template for monolith', async () => {
      const templateNames = ['nextjs-15'];

      vi.mocked(fsHelpers.ensureDir).mockResolvedValue(undefined);
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(true);
      vi.mocked(fsHelpers.copy).mockResolvedValue(undefined);

      await expect(
        service.copyTemplates(templateNames, destinationPath, ProjectType.MONOLITH),
      ).resolves.not.toThrow();
    });

    it('should reject multiple templates for monolith', async () => {
      const templateNames = ['nextjs-15', 'typescript-mcp'];

      await expect(
        service.copyTemplates(templateNames, destinationPath, ProjectType.MONOLITH),
      ).rejects.toThrow('Monolith projects can only use a single template');
    });

    it('should skip templates that already exist', async () => {
      const templateNames = ['nextjs-15'];

      vi.mocked(fsHelpers.ensureDir).mockResolvedValue(undefined);
      vi.mocked(fsHelpers.pathExists)
        .mockResolvedValueOnce(true) // Source exists
        .mockResolvedValueOnce(true); // Destination already exists

      await service.copyTemplates(templateNames, destinationPath, ProjectType.MONOLITH);

      expect(fsHelpers.copy).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should remove tmp directory if exists', async () => {
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(true);
      vi.mocked(fsHelpers.remove).mockResolvedValue(undefined);

      await service.cleanup();

      expect(fsHelpers.remove).toHaveBeenCalledWith(service.getTmpDir());
    });

    it('should not throw if tmp directory does not exist', async () => {
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(false);

      await expect(service.cleanup()).resolves.not.toThrow();
    });

    it('should not throw if cleanup fails', async () => {
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(true);
      vi.mocked(fsHelpers.remove).mockRejectedValue(new Error('Permission denied'));

      await expect(service.cleanup()).resolves.not.toThrow();
    });
  });
});
