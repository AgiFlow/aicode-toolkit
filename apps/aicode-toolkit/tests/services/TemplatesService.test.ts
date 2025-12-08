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
import * as aicodeUtils from '@agiflowai/aicode-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TemplateRepoConfig } from '../../src/services/TemplatesService';
import { TemplatesService } from '../../src/services/TemplatesService';

// Mock @agiflowai/aicode-utils including fs functions, print utilities, and git functions
vi.mock('@agiflowai/aicode-utils', async () => {
  const actual = await vi.importActual('@agiflowai/aicode-utils');
  return {
    ...actual,
    pathExists: vi.fn(),
    ensureDir: vi.fn(),
    writeFile: vi.fn(),
    cloneSubdirectory: vi.fn(),
    fetchGitHubDirectoryContents: vi.fn(),
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
      vi.mocked(aicodeUtils.ensureDir).mockResolvedValue(undefined);
      vi.mocked(aicodeUtils.writeFile).mockResolvedValue(undefined);

      await service.initializeTemplatesFolder(templatesPath);

      expect(aicodeUtils.ensureDir).toHaveBeenCalledWith(templatesPath);
      expect(aicodeUtils.writeFile).toHaveBeenCalledWith(
        path.join(templatesPath, 'README.md'),
        expect.stringContaining('# Templates'),
      );
    });

    it('should create README with proper content', async () => {
      const templatesPath = '/path/to/templates';
      vi.mocked(aicodeUtils.ensureDir).mockResolvedValue(undefined);
      vi.mocked(aicodeUtils.writeFile).mockResolvedValue(undefined);

      await service.initializeTemplatesFolder(templatesPath);

      const writeFileCall = vi.mocked(aicodeUtils.writeFile).mock.calls[0];
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

      vi.mocked(aicodeUtils.fetchGitHubDirectoryContents).mockResolvedValue([]);

      await service.downloadTemplates(templatesPath, mockRepoConfig);

      expect(aicodeUtils.fetchGitHubDirectoryContents).toHaveBeenCalledWith(
        mockRepoConfig.owner,
        mockRepoConfig.repo,
        mockRepoConfig.path,
        mockRepoConfig.branch,
      );
    });

    it('should download new templates', async () => {
      const templatesPath = '/path/to/templates';

      const mockTemplates = [
        { name: 'nextjs-15', type: 'dir', path: 'templates/nextjs-15' },
        { name: 'react-vite', type: 'dir', path: 'templates/react-vite' },
      ];

      vi.mocked(aicodeUtils.fetchGitHubDirectoryContents).mockResolvedValue(mockTemplates);
      vi.mocked(aicodeUtils.pathExists).mockResolvedValue(false);
      vi.mocked(aicodeUtils.cloneSubdirectory).mockResolvedValue(undefined);

      await service.downloadTemplates(templatesPath, mockRepoConfig);

      expect(aicodeUtils.cloneSubdirectory).toHaveBeenCalledTimes(2);
      expect(aicodeUtils.cloneSubdirectory).toHaveBeenCalledWith(
        `https://github.com/${mockRepoConfig.owner}/${mockRepoConfig.repo}.git`,
        mockRepoConfig.branch,
        mockTemplates[0].path,
        path.join(templatesPath, mockTemplates[0].name),
      );
    });

    it('should skip existing templates', async () => {
      const templatesPath = '/path/to/templates';

      const mockTemplates = [
        { name: 'nextjs-15', type: 'dir', path: 'templates/nextjs-15' },
        { name: 'react-vite', type: 'dir', path: 'templates/react-vite' },
      ];

      vi.mocked(aicodeUtils.fetchGitHubDirectoryContents).mockResolvedValue(mockTemplates);
      // First template exists, second doesn't
      vi.mocked(aicodeUtils.pathExists).mockImplementation((pathToCheck) =>
        Promise.resolve(pathToCheck === path.join(templatesPath, 'nextjs-15')),
      );
      vi.mocked(aicodeUtils.cloneSubdirectory).mockResolvedValue(undefined);

      await service.downloadTemplates(templatesPath, mockRepoConfig);

      // Should only clone the second template
      expect(aicodeUtils.cloneSubdirectory).toHaveBeenCalledTimes(1);
      expect(aicodeUtils.cloneSubdirectory).toHaveBeenCalledWith(
        `https://github.com/${mockRepoConfig.owner}/${mockRepoConfig.repo}.git`,
        mockRepoConfig.branch,
        mockTemplates[1].path,
        path.join(templatesPath, mockTemplates[1].name),
      );
    });

    it('should filter out non-directory items', async () => {
      const templatesPath = '/path/to/templates';

      const mockContents = [
        { name: 'nextjs-15', type: 'dir', path: 'templates/nextjs-15' },
        { name: 'README.md', type: 'file', path: 'templates/README.md' },
        { name: 'react-vite', type: 'dir', path: 'templates/react-vite' },
      ];

      vi.mocked(aicodeUtils.fetchGitHubDirectoryContents).mockResolvedValue(mockContents);
      vi.mocked(aicodeUtils.pathExists).mockResolvedValue(false);
      vi.mocked(aicodeUtils.cloneSubdirectory).mockResolvedValue(undefined);

      await service.downloadTemplates(templatesPath, mockRepoConfig);

      // Should only clone directories (2 templates, not the README file)
      expect(aicodeUtils.cloneSubdirectory).toHaveBeenCalledTimes(2);
    });

    it('should throw error on download failure', async () => {
      const templatesPath = '/path/to/templates';

      vi.mocked(aicodeUtils.fetchGitHubDirectoryContents).mockRejectedValue(
        new Error('Network error'),
      );

      await expect(service.downloadTemplates(templatesPath, mockRepoConfig)).rejects.toThrow(
        'Failed to download templates: Network error',
      );
    });
  });
});
