/**
 * TemplatesService Tests
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

import path from 'node:path';
import * as fsHelpers from '@agiflowai/aicode-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TemplateRepoConfig } from '../../src/services/TemplatesService';
import { TemplatesService } from '../../src/services/TemplatesService';

// Mock dependencies
vi.mock('../../src/utils/git', () => ({
  cloneSubdirectory: vi.fn(),
  fetchGitHubDirectoryContents: vi.fn(),
}));

// Mock @agiflowai/aicode-utils including fs functions and print utilities
vi.mock('@agiflowai/aicode-utils', async () => {
  const actual = await vi.importActual('@agiflowai/aicode-utils');
  return {
    ...actual,
    pathExists: vi.fn(),
    ensureDir: vi.fn(),
    writeFile: vi.fn(),
    print: {
      info: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
    },
    messages: {
      warning: vi.fn(),
    },
    icons: {
      download: '⬇',
      folder: '📁',
      check: '✓',
      skip: '⊘',
    },
  };
});

describe('TemplatesService', () => {
  let service: TemplatesService;

  beforeEach(() => {
    service = new TemplatesService();
    vi.clearAllMocks();
  });

  describe('initializeTemplatesFolder', () => {
    it('should create templates directory and README', async () => {
      const templatesPath = '/path/to/templates';
      vi.mocked(fsHelpers.ensureDir).mockResolvedValue(undefined);
      vi.mocked(fsHelpers.writeFile).mockResolvedValue(undefined);

      await service.initializeTemplatesFolder(templatesPath);

      expect(fsHelpers.ensureDir).toHaveBeenCalledWith(templatesPath);
      expect(fsHelpers.writeFile).toHaveBeenCalledWith(
        path.join(templatesPath, 'README.md'),
        expect.stringContaining('# Templates'),
      );
    });

    it('should create README with proper content', async () => {
      const templatesPath = '/path/to/templates';
      vi.mocked(fsHelpers.ensureDir).mockResolvedValue(undefined);
      vi.mocked(fsHelpers.writeFile).mockResolvedValue(undefined);

      await service.initializeTemplatesFolder(templatesPath);

      const writeFileCall = vi.mocked(fsHelpers.writeFile).mock.calls[0];
      const readmeContent = writeFileCall[1] as string;

      expect(readmeContent).toContain('# Templates');
      expect(readmeContent).toContain('Boilerplates');
      expect(readmeContent).toContain('Features');
      expect(readmeContent).toContain('scaffold.yaml');
      expect(readmeContent).toContain('Liquid syntax');
    });
  });

  describe('downloadTemplates', () => {
    const mockRepoConfig: TemplateRepoConfig = {
      owner: 'testowner',
      repo: 'testrepo',
      branch: 'main',
      path: 'templates',
    };

    it('should handle empty templates directory', async () => {
      const templatesPath = '/path/to/templates';
      const { fetchGitHubDirectoryContents } = await import('../../src/utils/git');

      vi.mocked(fetchGitHubDirectoryContents).mockResolvedValue([]);

      await service.downloadTemplates(templatesPath, mockRepoConfig);

      expect(fetchGitHubDirectoryContents).toHaveBeenCalledWith(
        mockRepoConfig.owner,
        mockRepoConfig.repo,
        mockRepoConfig.path,
        mockRepoConfig.branch,
      );
    });

    it('should download new templates', async () => {
      const templatesPath = '/path/to/templates';
      const { fetchGitHubDirectoryContents, cloneSubdirectory } = await import(
        '../../src/utils/git'
      );

      const mockTemplates = [
        { name: 'nextjs-15', type: 'dir', path: 'templates/nextjs-15' },
        { name: 'react-vite', type: 'dir', path: 'templates/react-vite' },
      ];

      vi.mocked(fetchGitHubDirectoryContents).mockResolvedValue(mockTemplates);
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(false);
      vi.mocked(cloneSubdirectory).mockResolvedValue(undefined);

      await service.downloadTemplates(templatesPath, mockRepoConfig);

      expect(cloneSubdirectory).toHaveBeenCalledTimes(2);
      expect(cloneSubdirectory).toHaveBeenCalledWith(
        `https://github.com/${mockRepoConfig.owner}/${mockRepoConfig.repo}.git`,
        mockRepoConfig.branch,
        mockTemplates[0].path,
        path.join(templatesPath, mockTemplates[0].name),
      );
    });

    it('should skip existing templates', async () => {
      const templatesPath = '/path/to/templates';
      const { fetchGitHubDirectoryContents, cloneSubdirectory } = await import(
        '../../src/utils/git'
      );

      const mockTemplates = [
        { name: 'nextjs-15', type: 'dir', path: 'templates/nextjs-15' },
        { name: 'react-vite', type: 'dir', path: 'templates/react-vite' },
      ];

      vi.mocked(fetchGitHubDirectoryContents).mockResolvedValue(mockTemplates);
      // First template exists, second doesn't
      vi.mocked(fsHelpers.pathExists).mockImplementation((pathToCheck) =>
        Promise.resolve(pathToCheck === path.join(templatesPath, 'nextjs-15')),
      );
      vi.mocked(cloneSubdirectory).mockResolvedValue(undefined);

      await service.downloadTemplates(templatesPath, mockRepoConfig);

      // Should only clone the second template
      expect(cloneSubdirectory).toHaveBeenCalledTimes(1);
      expect(cloneSubdirectory).toHaveBeenCalledWith(
        `https://github.com/${mockRepoConfig.owner}/${mockRepoConfig.repo}.git`,
        mockRepoConfig.branch,
        mockTemplates[1].path,
        path.join(templatesPath, mockTemplates[1].name),
      );
    });

    it('should filter out non-directory items', async () => {
      const templatesPath = '/path/to/templates';
      const { fetchGitHubDirectoryContents, cloneSubdirectory } = await import(
        '../../src/utils/git'
      );

      const mockContents = [
        { name: 'nextjs-15', type: 'dir', path: 'templates/nextjs-15' },
        { name: 'README.md', type: 'file', path: 'templates/README.md' },
        { name: 'react-vite', type: 'dir', path: 'templates/react-vite' },
      ];

      vi.mocked(fetchGitHubDirectoryContents).mockResolvedValue(mockContents);
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(false);
      vi.mocked(cloneSubdirectory).mockResolvedValue(undefined);

      await service.downloadTemplates(templatesPath, mockRepoConfig);

      // Should only clone directories (2 templates, not the README file)
      expect(cloneSubdirectory).toHaveBeenCalledTimes(2);
    });

    it('should throw error on download failure', async () => {
      const templatesPath = '/path/to/templates';
      const { fetchGitHubDirectoryContents } = await import('../../src/utils/git');

      vi.mocked(fetchGitHubDirectoryContents).mockRejectedValue(new Error('Network error'));

      await expect(service.downloadTemplates(templatesPath, mockRepoConfig)).rejects.toThrow(
        'Failed to download templates: Network error',
      );
    });
  });
});
