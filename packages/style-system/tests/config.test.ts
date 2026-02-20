/**
 * Config Tests
 *
 * TESTING PATTERNS:
 * - Unit tests with mocked file system
 * - Test validation logic independently
 * - Cover success cases, edge cases, and error handling
 *
 * CODING STANDARDS:
 * - Use descriptive test names (should...)
 * - Arrange-Act-Assert pattern
 * - Mock external dependencies
 * - Test behavior, not implementation
 */

import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mock structure for node:fs module
 */
interface MockFs {
  promises: {
    readFile: Mock;
    access: Mock;
  };
}

/**
 * Mock structure for @agiflowai/aicode-utils module
 */
interface MockAicodeUtils {
  log: {
    info: Mock;
    warn: Mock;
    error: Mock;
    debug: Mock;
  };
  TemplatesManagerService: {
    getWorkspaceRootSync: Mock<[], string>;
  };
}

// Mock the file system and TemplatesManagerService before importing config
vi.mock(
  'node:fs',
  (): MockFs => ({
    promises: {
      readFile: vi.fn(),
      access: vi.fn(),
    },
  }),
);

vi.mock(
  '@agiflowai/aicode-utils',
  (): MockAicodeUtils => ({
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    TemplatesManagerService: {
      getWorkspaceRootSync: vi.fn((): string => '/mock/workspace'),
    },
  }),
);

import { promises as fs } from 'node:fs';
import {
  getAppDesignSystemConfig,
  getBundlerConfig,
  getGetCssClassesConfig,
  getSharedComponentTags,
} from '../src/config';

describe('config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAppDesignSystemConfig', () => {
    it('should throw error when appPath is empty', async () => {
      await expect(getAppDesignSystemConfig('')).rejects.toThrow(
        'appPath is required and must be a non-empty string',
      );
    });

    it('should throw error when appPath is not a string', async () => {
      await expect(getAppDesignSystemConfig(null as unknown as string)).rejects.toThrow(
        'appPath is required and must be a non-empty string',
      );
    });

    it('should return default config when style-system is not present', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test-app',
        }),
      );

      const result = await getAppDesignSystemConfig('apps/test-app');

      expect(result).toEqual({
        type: 'tailwind',
        themeProvider: '@agimonai/web-ui',
        sharedComponentTags: ['style-system'],
      });
    });

    it('should validate and return style-system config when present', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test-app',
          'style-system': {
            type: 'shadcn',
            themeProvider: './src/theme-provider',
          },
        }),
      );

      const result = await getAppDesignSystemConfig('apps/test-app');

      expect(result).toEqual({
        type: 'shadcn',
        themeProvider: './src/theme-provider',
      });
    });

    it('should throw error when style-system.type is invalid', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test-app',
          'style-system': {
            type: 'invalid',
            themeProvider: './src/theme-provider',
          },
        }),
      );

      await expect(getAppDesignSystemConfig('apps/test-app')).rejects.toThrow(
        "style-system.type must be 'tailwind' or 'shadcn'",
      );
    });

    it('should throw error when style-system.themeProvider is missing', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test-app',
          'style-system': {
            type: 'tailwind',
          },
        }),
      );

      await expect(getAppDesignSystemConfig('apps/test-app')).rejects.toThrow(
        'style-system.themeProvider is required and must be a string',
      );
    });

    it('should throw error when style-system.cssFiles is not an array of strings', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test-app',
          'style-system': {
            type: 'tailwind',
            themeProvider: './src/theme-provider',
            cssFiles: [123, 'valid.css'],
          },
        }),
      );

      await expect(getAppDesignSystemConfig('apps/test-app')).rejects.toThrow(
        'style-system.cssFiles must be an array of strings',
      );
    });

    it('should throw error when project.json contains invalid JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('{ invalid json }');

      await expect(getAppDesignSystemConfig('apps/test-app')).rejects.toThrow('Invalid JSON');
    });

    it('should throw error when project.json file cannot be read', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT: no such file or directory'));

      await expect(getAppDesignSystemConfig('apps/test-app')).rejects.toThrow(
        'Failed to read style-system config',
      );
    });

    it('should validate and return config with all optional properties', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test-app',
          'style-system': {
            type: 'tailwind',
            themeProvider: './src/theme-provider',
            cssFiles: ['./styles/global.css', './styles/theme.css'],
            sharedComponentTags: ['custom-tag', 'design-system'],
            rootComponent: './src/root-component',
            themePath: './src/theme.css',
          },
        }),
      );

      const result = await getAppDesignSystemConfig('apps/test-app');

      expect(result).toEqual({
        type: 'tailwind',
        themeProvider: './src/theme-provider',
        cssFiles: ['./styles/global.css', './styles/theme.css'],
        sharedComponentTags: ['custom-tag', 'design-system'],
        rootComponent: './src/root-component',
        themePath: './src/theme.css',
      });
    });

    it('should throw error when style-system.sharedComponentTags is not an array of strings', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: 'test-app',
          'style-system': {
            type: 'tailwind',
            themeProvider: './src/theme-provider',
            sharedComponentTags: ['valid', 123],
          },
        }),
      );

      await expect(getAppDesignSystemConfig('apps/test-app')).rejects.toThrow(
        'style-system.sharedComponentTags must be an array of strings',
      );
    });
  });

  describe('getSharedComponentTags', () => {
    it('should return default tags when toolkit.yaml does not exist', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(error);

      const result = await getSharedComponentTags();

      expect(result).toEqual(['style-system']);
    });

    it('should return tags from toolkit.yaml when valid', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(`
style-system:
  sharedComponentTags:
    - custom-tag
    - another-tag
`);

      const result = await getSharedComponentTags();

      expect(result).toEqual(['custom-tag', 'another-tag']);
    });

    it('should return default tags when sharedComponentTags is not a valid array', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(`
style-system:
  sharedComponentTags: "not-an-array"
`);

      const result = await getSharedComponentTags();

      expect(result).toEqual(['style-system']);
    });

    it('should return default tags when toolkit.yaml is empty', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('');

      const result = await getSharedComponentTags();

      expect(result).toEqual(['style-system']);
    });

    it('should return default tags when style-system key exists but sharedComponentTags is missing', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(`
style-system:
  otherKey: value
`);

      const result = await getSharedComponentTags();

      expect(result).toEqual(['style-system']);
    });

    it('should return default tags when sharedComponentTags contains non-string values', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(`
style-system:
  sharedComponentTags:
    - valid-tag
    - 123
`);

      const result = await getSharedComponentTags();

      expect(result).toEqual(['style-system']);
    });
  });

  describe('getBundlerConfig', () => {
    it('should return undefined when toolkit.yaml does not exist', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(error);

      const result = await getBundlerConfig();

      expect(result).toBeUndefined();
    });

    it('should return bundler config when valid', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(`
style-system:
  bundler:
    customService: path/to/custom-bundler.ts
`);

      const result = await getBundlerConfig();

      expect(result).toEqual({ customService: 'path/to/custom-bundler.ts' });
    });

    it('should return undefined when bundler key is missing', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(`
style-system:
  sharedComponentTags:
    - ui
`);

      const result = await getBundlerConfig();

      expect(result).toBeUndefined();
    });

    it('should return undefined when style-system key is missing', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(`
other-config:
  key: value
`);

      const result = await getBundlerConfig();

      expect(result).toBeUndefined();
    });

    it('should return undefined when toolkit.yaml is empty', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('');

      const result = await getBundlerConfig();

      expect(result).toBeUndefined();
    });

    it('should return undefined and warn when customService is not a string', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(`
style-system:
  bundler:
    customService: 123
`);

      const result = await getBundlerConfig();

      expect(result).toBeUndefined();
    });

    it('should return config with empty customService when not provided', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(`
style-system:
  bundler: {}
`);

      const result = await getBundlerConfig();

      expect(result).toEqual({});
    });

    it('should handle non-ENOENT file read errors', async () => {
      const error = new Error('Permission denied') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      vi.mocked(fs.readFile).mockRejectedValue(error);

      const result = await getBundlerConfig();

      expect(result).toBeUndefined();
    });

    it('should handle malformed YAML content', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('{ invalid: yaml: content: [}');

      const result = await getBundlerConfig();

      expect(result).toBeUndefined();
    });
  });

  describe('getGetCssClassesConfig', () => {
    it('should return undefined when toolkit.yaml does not exist', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(error);

      const result = await getGetCssClassesConfig();

      expect(result).toBeUndefined();
    });

    it('should return getCssClasses config when valid', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(`
style-system:
  getCssClasses:
    customService: path/to/custom-css-service.ts
`);

      const result = await getGetCssClassesConfig();

      expect(result).toEqual({ customService: 'path/to/custom-css-service.ts' });
    });

    it('should return undefined when getCssClasses key is missing', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(`
style-system:
  sharedComponentTags:
    - ui
`);

      const result = await getGetCssClassesConfig();

      expect(result).toBeUndefined();
    });

    it('should return undefined when style-system key is missing', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(`
other-config:
  key: value
`);

      const result = await getGetCssClassesConfig();

      expect(result).toBeUndefined();
    });

    it('should return undefined when toolkit.yaml is empty', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('');

      const result = await getGetCssClassesConfig();

      expect(result).toBeUndefined();
    });

    it('should return undefined and warn when customService is not a string', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(`
style-system:
  getCssClasses:
    customService: 456
`);

      const result = await getGetCssClassesConfig();

      expect(result).toBeUndefined();
    });

    it('should return config with empty customService when not provided', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(`
style-system:
  getCssClasses: {}
`);

      const result = await getGetCssClassesConfig();

      expect(result).toEqual({});
    });

    it('should handle non-ENOENT file read errors', async () => {
      const error = new Error('Permission denied') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      vi.mocked(fs.readFile).mockRejectedValue(error);

      const result = await getGetCssClassesConfig();

      expect(result).toBeUndefined();
    });

    it('should handle malformed YAML content', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('{ invalid: yaml: content: [}');

      const result = await getGetCssClassesConfig();

      expect(result).toBeUndefined();
    });
  });
});
