import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScaffoldConfigLoader } from '../../src/services/ScaffoldConfigLoader';
import { TemplateService } from '../../src/services/TemplateService';
import { createMockFileSystemService, createMockTemplateService } from '../__mocks__';

describe('ScaffoldConfigLoader', () => {
  let loader: ScaffoldConfigLoader;
  let mockFileSystem: ReturnType<typeof createMockFileSystemService>;
  let mockTemplate: ReturnType<typeof createMockTemplateService>;

  beforeEach(() => {
    mockFileSystem = createMockFileSystemService();
    mockTemplate = createMockTemplateService();
    loader = new ScaffoldConfigLoader(mockFileSystem, mockTemplate);
  });

  describe('parseIncludeEntry', () => {
    it('should parse basic file path', () => {
      const result = loader.parseIncludeEntry('src/index.ts', {});

      expect(result.sourcePath).toBe('src/index.ts');
      expect(result.targetPath).toBe('src/index.ts');
      expect(result.conditions).toEqual({});
    });

    it('should parse conditional includes', () => {
      const result = loader.parseIncludeEntry('layout.tsx?withLayout=true', { withLayout: true });

      expect(result.sourcePath).toBe('layout.tsx');
      expect(result.conditions).toEqual({ withLayout: 'true' });
    });

    it('should parse multiple conditions', () => {
      const result = loader.parseIncludeEntry('test.tsx?withTests=true&withDocs=false', {});

      expect(result.conditions).toEqual({
        withTests: 'true',
        withDocs: 'false',
      });
    });

    it('should parse arrow syntax for path mapping', () => {
      const result = loader.parseIncludeEntry('template.tsx->src/app/page.tsx', {});

      expect(result.sourcePath).toBe('template.tsx');
      expect(result.targetPath).toBe('src/app/page.tsx');
    });

    it('should combine arrow syntax with conditions', () => {
      const result = loader.parseIncludeEntry('template.tsx->{{ path }}/page.tsx?withPage=true', {
        path: 'custom',
      });

      expect(result.sourcePath).toBe('template.tsx');
      expect(result.targetPath).toBe('custom/page.tsx');
      expect(result.conditions).toEqual({ withPage: 'true' });
    });

    it('should correctly parse arrow syntax with variable replacement and conditions', () => {
      const result = loader.parseIncludeEntry(
        'src/components/Component/Component.tsx->src/components/{{componentName}}/{{componentName}}.tsx?withSmartComponent=true',
        { componentName: 'Button', withSmartComponent: true },
      );

      expect(result.sourcePath).toBe('src/components/Component/Component.tsx');
      expect(result.targetPath).toBe('src/components/Button/Button.tsx');
      expect(result.conditions).toEqual({ withSmartComponent: 'true' });
    });

    it('should handle spaces around arrow syntax with conditions', () => {
      const result = loader.parseIncludeEntry(
        'src/Component.tsx -> src/{{ name }}.tsx?withFeature=true',
        { name: 'MyComponent' },
      );

      expect(result.sourcePath).toBe('src/Component.tsx');
      expect(result.targetPath).toBe('src/MyComponent.tsx');
      expect(result.conditions).toEqual({ withFeature: 'true' });
    });
  });

  describe('shouldIncludeFile', () => {
    it('should return true when no conditions', () => {
      const result = loader.shouldIncludeFile(undefined, {});

      expect(result).toBe(true);
    });

    it('should return true when boolean condition matches', () => {
      const result = loader.shouldIncludeFile({ withLayout: 'true' }, { withLayout: true });

      expect(result).toBe(true);
    });

    it('should return false when boolean condition does not match', () => {
      const result = loader.shouldIncludeFile({ withLayout: 'true' }, { withLayout: false });

      expect(result).toBe(false);
    });

    it('should return true when string condition matches', () => {
      const result = loader.shouldIncludeFile({ type: 'component' }, { type: 'component' });

      expect(result).toBe(true);
    });

    it('should return false when string condition does not match', () => {
      const result = loader.shouldIncludeFile({ type: 'component' }, { type: 'page' });

      expect(result).toBe(false);
    });

    it('should handle multiple conditions', () => {
      const result = loader.shouldIncludeFile(
        { withTests: 'true', type: 'service' },
        { withTests: true, type: 'service' },
      );

      expect(result).toBe(true);
    });

    it('should return false when condition variable is undefined', () => {
      const result = loader.shouldIncludeFile(
        { withSmartComponent: 'true' },
        { componentName: 'Button' }, // withSmartComponent not provided
      );

      expect(result).toBe(false);
    });

    it('should handle string "true" variable correctly', () => {
      const result = loader.shouldIncludeFile({ withFeature: 'true' }, { withFeature: 'true' });

      expect(result).toBe(true);
    });

    it('should handle string "false" variable correctly when condition expects true', () => {
      const result = loader.shouldIncludeFile({ withFeature: 'true' }, { withFeature: 'false' });

      expect(result).toBe(false);
    });

    it('should handle string "false" variable correctly when condition expects false', () => {
      const result = loader.shouldIncludeFile({ withFeature: 'false' }, { withFeature: 'false' });

      expect(result).toBe(true);
    });

    it('should handle string "true" variable correctly when condition expects false', () => {
      const result = loader.shouldIncludeFile({ withFeature: 'false' }, { withFeature: 'true' });

      expect(result).toBe(false);
    });

    it('should return false when condition expects true but variable is undefined', () => {
      // This is the case when schema has default: false but variable is not passed
      const result = loader.shouldIncludeFile({ withSmartComponent: 'true' }, {});

      expect(result).toBe(false);
    });

    it('should return true when condition expects false and variable is undefined', () => {
      // undefined should be treated as falsy, so condition ?withFeature=false should match
      const result = loader.shouldIncludeFile({ withFeature: 'false' }, {});

      expect(result).toBe(true);
    });
  });

  describe('parseIncludeEntry + shouldIncludeFile integration', () => {
    it('should correctly filter arrow syntax includes with conditions when variable is true', () => {
      const includeEntry =
        'src/components/Component/Component.tsx->src/components/{{componentName}}/{{componentName}}.tsx?withSmartComponent=true';
      const variables = { componentName: 'Button', withSmartComponent: true };

      const parsed = loader.parseIncludeEntry(includeEntry, variables);
      const shouldInclude = loader.shouldIncludeFile(parsed.conditions, variables);

      expect(parsed.sourcePath).toBe('src/components/Component/Component.tsx');
      expect(parsed.targetPath).toBe('src/components/Button/Button.tsx');
      expect(parsed.conditions).toEqual({ withSmartComponent: 'true' });
      expect(shouldInclude).toBe(true);
    });

    it('should correctly filter arrow syntax includes with conditions when variable is false', () => {
      const includeEntry =
        'src/components/Component/Component.tsx->src/components/{{componentName}}/{{componentName}}.tsx?withSmartComponent=true';
      const variables = { componentName: 'Button', withSmartComponent: false };

      const parsed = loader.parseIncludeEntry(includeEntry, variables);
      const shouldInclude = loader.shouldIncludeFile(parsed.conditions, variables);

      expect(shouldInclude).toBe(false);
    });

    it('should correctly filter arrow syntax includes with conditions when variable is not provided', () => {
      const includeEntry =
        'src/components/Component/Component.tsx->src/components/{{componentName}}/{{componentName}}.tsx?withSmartComponent=true';
      const variables = { componentName: 'Button' }; // withSmartComponent not provided

      const parsed = loader.parseIncludeEntry(includeEntry, variables);
      const shouldInclude = loader.shouldIncludeFile(parsed.conditions, variables);

      expect(shouldInclude).toBe(false);
    });
  });

  describe('replaceVariablesInPath', () => {
    it('should replace variables in path', () => {
      mockTemplate.renderString.mockReturnValue('src/app/dashboard/page.tsx');

      const _result = loader.replaceVariablesInPath('src/app/{{ pagePath }}/page.tsx', {
        pagePath: 'dashboard',
      });

      expect(mockTemplate.renderString).toHaveBeenCalled();
    });
  });

  describe('validateTemplate', () => {
    it('should return valid for existing template with all files', async () => {
      mockFileSystem.pathExists.mockResolvedValue(true);

      // Mock parseArchitectConfig to return a valid config
      const parseArchitectConfigSpy = vi.spyOn(loader as any, 'parseArchitectConfig');
      parseArchitectConfigSpy.mockResolvedValue({
        boilerplate: {
          name: 'test',
          includes: ['package.json', 'src/index.ts'],
        },
      });

      const result = await loader.validateTemplate('/templates/test', 'boilerplate');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for non-existent template', async () => {
      mockFileSystem.pathExists.mockResolvedValue(false);

      const result = await loader.validateTemplate('/nonexistent', 'boilerplate');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect missing template files', async () => {
      mockFileSystem.pathExists
        .mockResolvedValueOnce(true) // Template dir exists
        .mockResolvedValueOnce(false) // First file missing
        .mockResolvedValueOnce(false); // .liquid version also missing

      // Mock parseArchitectConfig to return a config with a missing file
      const parseArchitectConfigSpy = vi.spyOn(loader as any, 'parseArchitectConfig');
      parseArchitectConfigSpy.mockResolvedValue({
        boilerplate: {
          name: 'test',
          includes: ['missing-file.ts'],
        },
      });

      const result = await loader.validateTemplate('/templates/test', 'boilerplate');

      expect(result.isValid).toBe(false);
      expect(result.missingFiles.length).toBeGreaterThan(0);
    });
  });
});

describe('ScaffoldConfigLoader with real TemplateService (LiquidJS)', () => {
  let loader: ScaffoldConfigLoader;
  let mockFileSystem: ReturnType<typeof createMockFileSystemService>;
  let realTemplateService: TemplateService;

  beforeEach(() => {
    mockFileSystem = createMockFileSystemService();
    realTemplateService = new TemplateService();
    loader = new ScaffoldConfigLoader(mockFileSystem, realTemplateService);
  });

  describe('parseIncludeEntry with LiquidJS rendering', () => {
    it('should correctly render variables in target path with arrow syntax and conditions', () => {
      const result = loader.parseIncludeEntry(
        'src/components/Component/Component.tsx->src/components/{{componentName}}/{{componentName}}.tsx?withSmartComponent=true',
        { componentName: 'Button', withSmartComponent: true },
      );

      expect(result.sourcePath).toBe('src/components/Component/Component.tsx');
      expect(result.targetPath).toBe('src/components/Button/Button.tsx');
      expect(result.conditions).toEqual({ withSmartComponent: 'true' });
    });

    it('should correctly render variables with spaces in Liquid syntax', () => {
      const result = loader.parseIncludeEntry(
        'src/Example.tsx->src/{{ componentName }}/{{ componentName }}.tsx?withFeature=true',
        { componentName: 'MyComponent' },
      );

      expect(result.sourcePath).toBe('src/Example.tsx');
      expect(result.targetPath).toBe('src/MyComponent/MyComponent.tsx');
      expect(result.conditions).toEqual({ withFeature: 'true' });
    });

    it('should correctly apply Liquid filters like pascalCase', () => {
      const result = loader.parseIncludeEntry(
        'src/Example.tsx->src/{{ name | pascalCase }}.tsx',
        { name: 'my-component' },
      );

      expect(result.targetPath).toBe('src/MyComponent.tsx');
    });

    it('should correctly apply Liquid filters like kebabCase', () => {
      const result = loader.parseIncludeEntry(
        'src/Example.tsx->src/{{ name | kebabCase }}.tsx',
        { name: 'MyComponent' },
      );

      expect(result.targetPath).toBe('src/my-component.tsx');
    });
  });

  describe('full integration: parseIncludeEntry + shouldIncludeFile with LiquidJS', () => {
    it('should correctly parse, render, and filter includes with conditions', () => {
      const includeEntry =
        'src/components/Example/Example.tsx->src/components/{{ componentName }}/{{ componentName }}.tsx?withSmartComponent=true';
      const variables = { componentName: 'Button', withSmartComponent: true };

      const parsed = loader.parseIncludeEntry(includeEntry, variables);
      const shouldInclude = loader.shouldIncludeFile(parsed.conditions, variables);

      expect(parsed.sourcePath).toBe('src/components/Example/Example.tsx');
      expect(parsed.targetPath).toBe('src/components/Button/Button.tsx');
      expect(parsed.conditions).toEqual({ withSmartComponent: 'true' });
      expect(shouldInclude).toBe(true);
    });

    it('should filter out includes when condition is false', () => {
      const includeEntry =
        'src/components/Example/Example.tsx->src/components/{{ componentName }}/{{ componentName }}.tsx?withSmartComponent=true';
      const variables = { componentName: 'Button', withSmartComponent: false };

      const parsed = loader.parseIncludeEntry(includeEntry, variables);
      const shouldInclude = loader.shouldIncludeFile(parsed.conditions, variables);

      expect(shouldInclude).toBe(false);
    });

    it('should filter out includes when condition variable is not provided', () => {
      const includeEntry =
        'src/components/Example/Example.tsx->src/components/{{ componentName }}/{{ componentName }}.tsx?withSmartComponent=true';
      const variables = { componentName: 'Button' };

      const parsed = loader.parseIncludeEntry(includeEntry, variables);
      const shouldInclude = loader.shouldIncludeFile(parsed.conditions, variables);

      expect(shouldInclude).toBe(false);
    });
  });
});
