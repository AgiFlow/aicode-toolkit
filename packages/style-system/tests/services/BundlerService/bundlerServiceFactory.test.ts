/**
 * BundlerServiceFactory Tests
 *
 * TESTING PATTERNS:
 * - Unit tests with mocked dependencies
 * - Test factory pattern, caching, custom service loading
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
import type {
  BaseBundlerService,
  DevServerResult,
  PrerenderResult,
  ServeComponentResult,
} from '../../../src/services/BundlerService';

/**
 * Creates a mock bundler service with all required methods properly typed
 */
function createMockBundlerService(
  overrides: Partial<{
    bundlerId: string;
    frameworkId: string;
  }> = {},
): BaseBundlerService {
  const { bundlerId = 'mock', frameworkId = 'mock' } = overrides;
  return {
    config: {},
    getBundlerId: vi.fn(() => bundlerId),
    getFrameworkId: vi.fn(() => frameworkId),
    startDevServer: vi.fn(
      (): Promise<DevServerResult> => Promise.resolve({ url: 'http://localhost:3000', port: 3000 }),
    ),
    serveComponent: vi.fn(
      (): Promise<ServeComponentResult> =>
        Promise.resolve({ url: 'http://localhost:3000/component' }),
    ),
    prerenderComponent: vi.fn(
      (): Promise<PrerenderResult> => Promise.resolve({ htmlFilePath: '/tmp/component.html' }),
    ),
    isServerRunning: vi.fn(() => false),
    getServerUrl: vi.fn(() => null),
    getServerPort: vi.fn(() => null),
    getCurrentAppPath: vi.fn(() => null),
    cleanup: vi.fn((): Promise<void> => Promise.resolve()),
  } as BaseBundlerService;
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

/**
 * Mock structure for config module
 */
interface MockConfig {
  getBundlerConfig: Mock;
}

// Mock dependencies before importing
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

vi.mock(
  '../../../src/config',
  (): MockConfig => ({
    getBundlerConfig: vi.fn(),
  }),
);

// Mock ViteReactBundlerService
const mockViteService = {
  getBundlerId: vi.fn(() => 'vite'),
  getFrameworkId: vi.fn(() => 'react'),
  startDevServer: vi.fn(),
  serveComponent: vi.fn(),
  prerenderComponent: vi.fn(),
  isServerRunning: vi.fn(() => false),
  getServerUrl: vi.fn(() => null),
  getServerPort: vi.fn(() => null),
  getCurrentAppPath: vi.fn(() => null),
  cleanup: vi.fn(),
};

vi.mock('../../../src/services/BundlerService/ViteReactBundlerService', () => ({
  ViteReactBundlerService: {
    getInstance: vi.fn(() => mockViteService),
  },
}));

import { getBundlerConfig } from '../../../src/config';
import {
  bundlerRegistry,
  createDefaultBundlerService,
  getBundlerService,
  getBundlerServiceFromConfig,
  registerBundlerService,
  resetBundlerServiceCache,
  ViteReactBundlerService,
} from '../../../src/services/BundlerService';

describe('BundlerServiceFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBundlerServiceCache();
    // Clear any custom registry entries except vite-react
    for (const key of bundlerRegistry.keys()) {
      if (key !== 'vite-react') {
        bundlerRegistry.delete(key);
      }
    }
  });

  describe('createDefaultBundlerService', () => {
    it('should return ViteReactBundlerService singleton instance', () => {
      const result = createDefaultBundlerService();

      expect(result).toBe(mockViteService);
      expect(ViteReactBundlerService.getInstance).toHaveBeenCalledTimes(1);
    });
  });

  describe('bundlerRegistry', () => {
    it('should have vite-react registered by default', () => {
      expect(bundlerRegistry.has('vite-react')).toBe(true);
    });
  });

  describe('getBundlerService', () => {
    it('should return registered bundler service by key', () => {
      const result = getBundlerService('vite-react');

      expect(result).toBe(mockViteService);
    });

    it('should fall back to default bundler for unknown key', () => {
      const result = getBundlerService('unknown-bundler');

      expect(result).toBe(mockViteService);
    });
  });

  describe('registerBundlerService', () => {
    it('should register a custom bundler service factory', () => {
      const customService = createMockBundlerService({
        bundlerId: 'custom',
        frameworkId: 'custom',
      });
      const customFactory = vi.fn(() => customService);

      registerBundlerService('custom-bundler', customFactory);
      const result = getBundlerService('custom-bundler');

      expect(result).toBe(customService);
      expect(customFactory).toHaveBeenCalled();
    });

    it('should allow overriding existing bundler', () => {
      const customService = createMockBundlerService({
        bundlerId: 'override',
        frameworkId: 'override',
      });
      const customFactory = vi.fn(() => customService);

      registerBundlerService('vite-react', customFactory);
      const result = getBundlerService('vite-react');

      expect(result).toBe(customService);
    });
  });

  describe('getBundlerServiceFromConfig', () => {
    it('should return cached service on subsequent calls', async () => {
      vi.mocked(getBundlerConfig).mockResolvedValue(undefined);

      const result1 = await getBundlerServiceFromConfig();
      const result2 = await getBundlerServiceFromConfig();

      expect(result1).toBe(result2);
      expect(getBundlerConfig).toHaveBeenCalledTimes(1);
    });

    it('should return default service when no custom service is configured', async () => {
      vi.mocked(getBundlerConfig).mockResolvedValue(undefined);

      const result = await getBundlerServiceFromConfig();

      expect(result).toBe(mockViteService);
    });

    it('should return default service when bundler config has no customService', async () => {
      vi.mocked(getBundlerConfig).mockResolvedValue({});

      const result = await getBundlerServiceFromConfig();

      expect(result).toBe(mockViteService);
    });

    it('should fall back to default service when custom service import fails', async () => {
      vi.mocked(getBundlerConfig).mockResolvedValue({
        customService: 'path/to/nonexistent-service.ts',
      });

      const result = await getBundlerServiceFromConfig();

      expect(result).toBe(mockViteService);
    });

    it('should reset cache correctly', async () => {
      vi.mocked(getBundlerConfig).mockResolvedValue(undefined);

      await getBundlerServiceFromConfig();
      resetBundlerServiceCache();

      // After reset, getBundlerConfig should be called again
      await getBundlerServiceFromConfig();

      expect(getBundlerConfig).toHaveBeenCalledTimes(2);
    });
  });

  describe('resetBundlerServiceCache', () => {
    it('should clear cached bundler service', async () => {
      vi.mocked(getBundlerConfig).mockResolvedValue(undefined);

      await getBundlerServiceFromConfig();
      expect(getBundlerConfig).toHaveBeenCalledTimes(1);

      resetBundlerServiceCache();
      await getBundlerServiceFromConfig();

      expect(getBundlerConfig).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string bundler key by falling back to default', () => {
      const result = getBundlerService('');

      expect(result).toBe(mockViteService);
    });

    it('should handle registering bundler with empty string key', () => {
      const customService = createMockBundlerService({
        bundlerId: 'empty-key',
        frameworkId: 'test',
      });
      const customFactory = vi.fn(() => customService);

      registerBundlerService('', customFactory);
      const result = getBundlerService('');

      expect(result).toBe(customService);
    });

    it('should handle factory that throws error by propagating the error', () => {
      const throwingFactory = vi.fn(() => {
        throw new Error('Factory error');
      });

      registerBundlerService('throwing-bundler', throwingFactory);

      expect(() => getBundlerService('throwing-bundler')).toThrow('Factory error');
    });

    it('should handle concurrent calls to getBundlerServiceFromConfig', async () => {
      vi.mocked(getBundlerConfig).mockResolvedValue(undefined);

      const [result1, result2, result3] = await Promise.all([
        getBundlerServiceFromConfig(),
        getBundlerServiceFromConfig(),
        getBundlerServiceFromConfig(),
      ]);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('should handle whitespace-only bundler key', () => {
      const result = getBundlerService('   ');

      expect(result).toBe(mockViteService);
    });
  });
});
