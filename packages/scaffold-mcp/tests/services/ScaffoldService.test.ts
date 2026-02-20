import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScaffoldConfigLoader } from '../../src/services/ScaffoldConfigLoader';
import { ScaffoldService } from '../../src/services/ScaffoldService';
import { TemplateService } from '../../src/services/TemplateService';
import { createMockFileSystemService } from '../__mocks__';

describe('ScaffoldService', () => {
  let scaffoldService: ScaffoldService;
  let mockFileSystem: ReturnType<typeof createMockFileSystemService>;
  let templateService: TemplateService;
  let scaffoldConfigLoader: ScaffoldConfigLoader;

  beforeEach(() => {
    mockFileSystem = createMockFileSystemService();
    templateService = new TemplateService();
    scaffoldConfigLoader = new ScaffoldConfigLoader(mockFileSystem, templateService);

    // Mock variableReplacer
    const mockVariableReplacer = {
      replaceVariablesInFile: vi.fn().mockResolvedValue(undefined),
      processFilesForVariableReplacement: vi.fn().mockResolvedValue(undefined),
    };

    scaffoldService = new ScaffoldService(
      mockFileSystem,
      scaffoldConfigLoader,
      mockVariableReplacer as any,
      '/templates',
    );
  });

  describe('processScaffold with schema defaults', () => {
    it('should apply schema defaults before condition checking', async () => {
      // Setup mocks
      mockFileSystem.pathExists.mockResolvedValue(true);
      mockFileSystem.ensureDir.mockResolvedValue(undefined);
      mockFileSystem.copy.mockResolvedValue(undefined);
      mockFileSystem.stat.mockResolvedValue({ isDirectory: () => false, isFile: () => true });
      mockFileSystem.readFile.mockResolvedValue('file content');

      // Spy on parseIncludeEntry and shouldIncludeFile
      const parseIncludeSpy = vi.spyOn(scaffoldConfigLoader, 'parseIncludeEntry');
      const shouldIncludeSpy = vi.spyOn(scaffoldConfigLoader, 'shouldIncludeFile');

      // Config with schema defaults
      const config = {
        name: 'test-feature',
        variables_schema: {
          type: 'object',
          properties: {
            componentName: { type: 'string' },
            withSmartComponent: { type: 'boolean', default: false },
            withStorybook: { type: 'boolean', default: true },
          },
          required: ['componentName'],
        },
        includes: [
          'src/Component.tsx->src/{{componentName}}.tsx',
          'src/SmartComponent.tsx->src/{{componentName}}Smart.tsx?withSmartComponent=true',
          'src/Stories.tsx->src/{{componentName}}.stories.tsx?withStorybook=true',
        ],
      };

      // Call processScaffold with variables that don't include the optional booleans
      const variables = { componentName: 'Button' };

      // Access private method via any
      const _result = await (scaffoldService as any).processScaffold({
        config,
        targetPath: '/target',
        templatePath: '/templates/test',
        allVariables: variables,
        scaffoldType: 'feature',
      });

      // Verify parseIncludeEntry was called with defaults applied
      expect(parseIncludeSpy).toHaveBeenCalled();

      // Get the variables passed to shouldIncludeFile
      const shouldIncludeCalls = shouldIncludeSpy.mock.calls;

      // Find the call for withSmartComponent condition
      const smartComponentCall = shouldIncludeCalls.find(
        (call) => call[0]?.withSmartComponent === 'true',
      );
      expect(smartComponentCall).toBeDefined();
      // The variables should have withSmartComponent: false (from default)
      expect(smartComponentCall?.[1].withSmartComponent).toBe(false);

      // Find the call for withStorybook condition
      const storybookCall = shouldIncludeCalls.find((call) => call[0]?.withStorybook === 'true');
      expect(storybookCall).toBeDefined();
      // The variables should have withStorybook: true (from default)
      expect(storybookCall?.[1].withStorybook).toBe(true);
    });

    it('should include file when schema default matches condition', async () => {
      mockFileSystem.pathExists.mockImplementation(async (p: string) => {
        // Template files exist, target files don't
        return p.startsWith('/templates');
      });
      mockFileSystem.ensureDir.mockResolvedValue(undefined);
      mockFileSystem.copy.mockResolvedValue(undefined);
      mockFileSystem.stat.mockResolvedValue({ isDirectory: () => false, isFile: () => true });
      mockFileSystem.readFile.mockResolvedValue('file content');

      const config = {
        name: 'test-feature',
        variables_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            withFeature: { type: 'boolean', default: true }, // default: true
          },
          required: ['name'],
        },
        includes: [
          'src/Feature.tsx->src/{{name}}Feature.tsx?withFeature=true', // condition: true
        ],
      };

      const _result = await (scaffoldService as any).processScaffold({
        config,
        targetPath: '/target',
        templatePath: '/templates/test',
        allVariables: { name: 'My' }, // withFeature not provided, should use default: true
        scaffoldType: 'feature',
      });

      // File should be included because default: true matches condition: true
      expect(mockFileSystem.copy).toHaveBeenCalled();
    });

    it('should exclude file when schema default does not match condition', async () => {
      mockFileSystem.pathExists.mockImplementation(async (p: string) => {
        return p.startsWith('/templates');
      });
      mockFileSystem.ensureDir.mockResolvedValue(undefined);
      mockFileSystem.copy.mockResolvedValue(undefined);
      mockFileSystem.stat.mockResolvedValue({ isDirectory: () => false, isFile: () => true });

      const config = {
        name: 'test-feature',
        variables_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            withFeature: { type: 'boolean', default: false }, // default: false
          },
          required: ['name'],
        },
        includes: [
          'src/Feature.tsx->src/{{name}}Feature.tsx?withFeature=true', // condition: true
        ],
      };

      const _result = await (scaffoldService as any).processScaffold({
        config,
        targetPath: '/target',
        templatePath: '/templates/test',
        allVariables: { name: 'My' }, // withFeature not provided, should use default: false
        scaffoldType: 'feature',
      });

      // File should NOT be included because default: false doesn't match condition: true
      expect(mockFileSystem.copy).not.toHaveBeenCalled();
    });

    it('should use provided value over schema default', async () => {
      mockFileSystem.pathExists.mockImplementation(async (p: string) => {
        return p.startsWith('/templates');
      });
      mockFileSystem.ensureDir.mockResolvedValue(undefined);
      mockFileSystem.copy.mockResolvedValue(undefined);
      mockFileSystem.stat.mockResolvedValue({ isDirectory: () => false, isFile: () => true });
      mockFileSystem.readFile.mockResolvedValue('file content');

      const config = {
        name: 'test-feature',
        variables_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            withFeature: { type: 'boolean', default: false }, // default: false
          },
          required: ['name'],
        },
        includes: ['src/Feature.tsx->src/{{name}}Feature.tsx?withFeature=true'],
      };

      const _result = await (scaffoldService as any).processScaffold({
        config,
        targetPath: '/target',
        templatePath: '/templates/test',
        allVariables: { name: 'My', withFeature: true }, // explicitly set to true
        scaffoldType: 'feature',
      });

      // File should be included because provided value: true matches condition: true
      expect(mockFileSystem.copy).toHaveBeenCalled();
    });
  });
});
