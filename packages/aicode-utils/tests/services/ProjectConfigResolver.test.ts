import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigSource, ProjectType } from '../../src/constants/projectType';
import { ProjectConfigResolver } from '../../src/services/ProjectConfigResolver';
import { TemplatesManagerService } from '../../src/services/TemplatesManagerService';
import * as fsHelpers from '../../src/utils/fsHelpers';

// Mock fsHelpers
vi.mock('../../src/utils/fsHelpers', async () => {
  const actual = await vi.importActual('../../src/utils/fsHelpers');
  return {
    ...actual,
    pathExists: vi.fn(),
    readJson: vi.fn(),
    writeJson: vi.fn(),
  };
});

// Helper to setup pathExists mock
function mockPathExists(existingPaths: string[]): void {
  vi.mocked(fsHelpers.pathExists).mockImplementation(async (filePath) => {
    return existingPaths.includes(filePath as string);
  });
}

// Helper to setup readJson mock
function mockReadJson(content: unknown): void {
  vi.mocked(fsHelpers.readJson).mockResolvedValueOnce(content);
}

// Mock TemplatesManagerService
vi.mock('../../src/services/TemplatesManagerService', () => ({
  TemplatesManagerService: {
    getWorkspaceRoot: vi.fn(),
    readToolkitConfig: vi.fn(),
    writeToolkitConfig: vi.fn(),
  },
}));

describe('ProjectConfigResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveProjectConfig', () => {
    it('should resolve config from project.json (monorepo)', async () => {
      const projectPath = '/test/apps/my-app';
      const projectJsonPath = path.join(projectPath, 'project.json');
      const mockProjectJson = {
        name: 'my-app',
        sourceTemplate: 'nextjs-15',
      };

      mockPathExists([projectJsonPath]);
      mockReadJson(mockProjectJson);

      const result = await ProjectConfigResolver.resolveProjectConfig(projectPath);

      expect(result).toEqual({
        type: ProjectType.MONOREPO,
        sourceTemplate: 'nextjs-15',
        configSource: ConfigSource.PROJECT_JSON,
      });
    });

    it('should resolve config from toolkit.yaml (monolith)', async () => {
      const projectPath = '/test/my-monolith';
      const workspaceRoot = '/test';
      const mockToolkitConfig = {
        version: '1.0',
        templatesPath: './templates',
        projectType: 'monolith' as const,
        sourceTemplate: 'react-vite',
      };

      mockPathExists([]); // project.json doesn't exist
      vi.mocked(TemplatesManagerService.getWorkspaceRoot).mockResolvedValueOnce(workspaceRoot);
      vi.mocked(TemplatesManagerService.readToolkitConfig).mockResolvedValueOnce(mockToolkitConfig);

      const result = await ProjectConfigResolver.resolveProjectConfig(projectPath);

      expect(result).toEqual({
        type: ProjectType.MONOLITH,
        sourceTemplate: 'react-vite',
        configSource: ConfigSource.TOOLKIT_YAML,
        workspaceRoot,
      });
    });

    it('should use explicit template when provided', async () => {
      const projectPath = '/test/my-app';
      const explicitTemplate = 'custom-template';

      const result = await ProjectConfigResolver.resolveProjectConfig(
        projectPath,
        explicitTemplate,
      );

      expect(result).toEqual({
        type: ProjectType.MONOLITH,
        sourceTemplate: 'custom-template',
        configSource: ConfigSource.TOOLKIT_YAML,
      });
    });

    it('should throw helpful error when no configuration found', async () => {
      const projectPath = '/test/no-config';

      mockPathExists([]);
      vi.mocked(TemplatesManagerService.getWorkspaceRoot).mockResolvedValueOnce('/test');
      vi.mocked(TemplatesManagerService.readToolkitConfig).mockResolvedValueOnce(null);

      await expect(ProjectConfigResolver.resolveProjectConfig(projectPath)).rejects.toThrow(
        'No project configuration found',
      );
    });
  });

  describe('hasConfiguration', () => {
    it('should return true when configuration exists', async () => {
      const projectPath = '/test/apps/my-app';
      const projectJsonPath = path.join(projectPath, 'project.json');
      const mockProjectJson = {
        name: 'my-app',
        sourceTemplate: 'nextjs-15',
      };

      mockPathExists([projectJsonPath]);
      mockReadJson(mockProjectJson);

      const result = await ProjectConfigResolver.hasConfiguration(projectPath);

      expect(result).toBe(true);
    });

    it('should return false when configuration does not exist', async () => {
      const projectPath = '/test/no-config';

      mockPathExists([]);
      vi.mocked(TemplatesManagerService.getWorkspaceRoot).mockResolvedValueOnce('/test');
      vi.mocked(TemplatesManagerService.readToolkitConfig).mockResolvedValueOnce(null);

      const result = await ProjectConfigResolver.hasConfiguration(projectPath);

      expect(result).toBe(false);
    });

    it('should return false when path does not exist', async () => {
      const projectPath = '/test/error';

      // When pathExists returns false (file doesn't exist),
      // the flow continues and eventually returns false (no config found)
      vi.mocked(fsHelpers.pathExists).mockResolvedValueOnce(false);
      vi.mocked(TemplatesManagerService.getWorkspaceRoot).mockResolvedValueOnce('/test');
      vi.mocked(TemplatesManagerService.readToolkitConfig).mockResolvedValueOnce(null);

      const result = await ProjectConfigResolver.hasConfiguration(projectPath);

      expect(result).toBe(false);
    });
  });

  describe('createToolkitYaml', () => {
    it('should create toolkit.yaml for monolith project', async () => {
      const sourceTemplate = 'react-vite';
      const workspaceRoot = '/test';

      vi.mocked(TemplatesManagerService.getWorkspaceRoot).mockResolvedValueOnce(workspaceRoot);
      vi.mocked(TemplatesManagerService.readToolkitConfig).mockResolvedValueOnce(null);
      vi.mocked(TemplatesManagerService.writeToolkitConfig).mockResolvedValueOnce();

      await ProjectConfigResolver.createToolkitYaml(sourceTemplate);

      expect(TemplatesManagerService.writeToolkitConfig).toHaveBeenCalledWith(
        {
          version: '1.0',
          templatesPath: './templates',
          projectType: 'monolith',
          sourceTemplate: 'react-vite',
        },
        workspaceRoot,
      );
    });

    it('should preserve existing toolkit.yaml settings', async () => {
      const sourceTemplate = 'react-vite';
      const workspaceRoot = '/test';
      const existingConfig = {
        version: '2.0',
        templatesPath: './custom-templates',
      };

      vi.mocked(TemplatesManagerService.getWorkspaceRoot).mockResolvedValueOnce(workspaceRoot);
      vi.mocked(TemplatesManagerService.readToolkitConfig).mockResolvedValueOnce(existingConfig);
      vi.mocked(TemplatesManagerService.writeToolkitConfig).mockResolvedValueOnce();

      await ProjectConfigResolver.createToolkitYaml(sourceTemplate);

      expect(TemplatesManagerService.writeToolkitConfig).toHaveBeenCalledWith(
        {
          version: '2.0', // Preserves existing version instead of overwriting
          templatesPath: './custom-templates',
          projectType: 'monolith',
          sourceTemplate: 'react-vite',
        },
        workspaceRoot,
      );
    });
  });

  describe('createProjectJson', () => {
    it('should create new project.json when it does not exist', async () => {
      const projectPath = '/test/apps/my-app';
      const projectName = 'my-app';
      const sourceTemplate = 'nextjs-15';
      const projectJsonPath = path.join(projectPath, 'project.json');

      mockPathExists([]);
      vi.mocked(fsHelpers.writeJson).mockResolvedValueOnce();

      await ProjectConfigResolver.createProjectJson(projectPath, projectName, sourceTemplate);

      expect(fsHelpers.writeJson).toHaveBeenCalledWith(
        projectJsonPath,
        expect.objectContaining({ sourceTemplate: 'nextjs-15' }),
      );
    });

    it('should update existing project.json with sourceTemplate', async () => {
      const projectPath = '/test/apps/my-app';
      const projectName = 'my-app';
      const sourceTemplate = 'nextjs-15';
      const projectJsonPath = path.join(projectPath, 'project.json');
      const existingProjectJson = {
        name: 'my-app',
        $schema: '../../node_modules/nx/schemas/project-schema.json',
        targets: {},
      };

      mockPathExists([projectJsonPath]);
      mockReadJson(existingProjectJson);
      vi.mocked(fsHelpers.writeJson).mockResolvedValueOnce();

      await ProjectConfigResolver.createProjectJson(projectPath, projectName, sourceTemplate);

      expect(fsHelpers.writeJson).toHaveBeenCalledWith(
        projectJsonPath,
        expect.objectContaining({
          name: 'my-app',
          sourceTemplate: 'nextjs-15',
          targets: {},
        }),
      );
    });
  });
});
