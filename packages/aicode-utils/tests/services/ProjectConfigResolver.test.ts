import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigSource, ProjectType } from '../../src/constants/projectType';
import { ProjectConfigResolver } from '../../src/services/ProjectConfigResolver';
import { TemplatesManagerService } from '../../src/services/TemplatesManagerService';

// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

// Helper to setup pathExists mock
function mockPathExists(existingPaths: string[]): void {
  vi.mocked(fs.access).mockImplementation(async (filePath) => {
    if (existingPaths.includes(filePath as string)) {
      return;
    }
    throw new Error('ENOENT');
  });
}

// Helper to setup readJson mock
function mockReadFile(content: unknown): void {
  vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(content));
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
      mockReadFile(mockProjectJson);

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
      mockReadFile(mockProjectJson);

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

    it('should return false when filesystem access fails (errors are silently caught)', async () => {
      const projectPath = '/test/error';

      // When fs.access fails, the internal pathExists helper catches the error
      // and returns false, which cascades to "No project configuration found"
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('Permission denied'));
      vi.mocked(TemplatesManagerService.getWorkspaceRoot).mockResolvedValueOnce('/test');
      vi.mocked(TemplatesManagerService.readToolkitConfig).mockResolvedValueOnce(null);

      const result = await ProjectConfigResolver.hasConfiguration(projectPath);

      // Since pathExists silently catches filesystem errors and returns false,
      // the flow continues and eventually returns false (no config found)
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
      vi.mocked(fs.writeFile).mockResolvedValueOnce();

      await ProjectConfigResolver.createProjectJson(projectPath, projectName, sourceTemplate);

      expect(fs.writeFile).toHaveBeenCalledWith(
        projectJsonPath,
        expect.stringContaining('"sourceTemplate": "nextjs-15"'),
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
      mockReadFile(existingProjectJson);
      vi.mocked(fs.writeFile).mockResolvedValueOnce();

      await ProjectConfigResolver.createProjectJson(projectPath, projectName, sourceTemplate);

      expect(fs.writeFile).toHaveBeenCalledWith(
        projectJsonPath,
        expect.stringContaining('"sourceTemplate": "nextjs-15"'),
      );
    });
  });
});
