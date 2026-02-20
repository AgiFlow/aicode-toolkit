/**
 * BundlerServiceFactory
 *
 * DESIGN PATTERNS:
 * - Factory pattern for creating bundler service instances
 * - Registry pattern for bundler implementations
 * - Follows StoriesIndexService factory approach
 *
 * CODING STANDARDS:
 * - Use type-safe factory functions
 * - Provide sensible defaults (ViteReactBundlerService)
 * - Allow user-provided implementations
 * - Document public APIs with JSDoc
 *
 * AVOID:
 * - Hard-coding bundler implementations
 * - Breaking changes to factory interface
 */

import path from 'node:path';
import { log, TemplatesManagerService } from '@agiflowai/aicode-utils';
import { getBundlerConfig } from '../../config';
import type { BaseBundlerService } from './BaseBundlerService';
import { ViteReactBundlerService } from './ViteReactBundlerService';

/** Valid file extensions for custom service modules */
const VALID_SERVICE_EXTENSIONS = ['.ts', '.js', '.mjs', '.cjs'] as const;

/**
 * Factory function type for creating bundler service instances.
 * Users can provide custom implementations by defining their own factory.
 */
export type BundlerServiceFactory = () => BaseBundlerService;

/**
 * Default factory that creates a ViteReactBundlerService instance.
 * Uses the singleton pattern to ensure only one dev server runs at a time.
 *
 * @returns The singleton ViteReactBundlerService instance
 *
 * @example
 * ```typescript
 * import { createDefaultBundlerService } from './BundlerServiceFactory';
 *
 * const bundler = createDefaultBundlerService();
 * await bundler.startDevServer('apps/my-app');
 * ```
 */
export function createDefaultBundlerService(): BaseBundlerService {
  return ViteReactBundlerService.getInstance();
}

/**
 * Registry of available bundler service factories.
 * Allows registration of custom bundler implementations by key.
 *
 * @example
 * ```typescript
 * // Register a custom bundler
 * bundlerRegistry.set('webpack-react', () => new WebpackReactBundlerService());
 *
 * // Get a bundler by key
 * const factory = bundlerRegistry.get('webpack-react');
 * const bundler = factory?.() ?? createDefaultBundlerService();
 * ```
 */
export const bundlerRegistry = new Map<string, BundlerServiceFactory>();

// Register the default Vite + React bundler
bundlerRegistry.set('vite-react', createDefaultBundlerService);

/**
 * Get a bundler service by its identifier.
 * Returns the default ViteReactBundlerService if the key is not found.
 *
 * @param key - The bundler identifier (e.g., 'vite-react', 'webpack-react')
 * @returns A bundler service instance
 *
 * @example
 * ```typescript
 * // Get the default bundler
 * const bundler = getBundlerService('vite-react');
 *
 * // Falls back to default if not found
 * const bundler = getBundlerService('unknown'); // Returns ViteReactBundlerService
 * ```
 */
export function getBundlerService(key: string): BaseBundlerService {
  const factory = bundlerRegistry.get(key);
  if (factory) {
    return factory();
  }
  // Fallback to default bundler
  return createDefaultBundlerService();
}

/**
 * Register a custom bundler service factory.
 *
 * @param key - The bundler identifier
 * @param factory - Factory function that creates the bundler service
 *
 * @example
 * ```typescript
 * import { registerBundlerService } from './BundlerServiceFactory';
 *
 * // Register a custom Webpack + Vue bundler
 * registerBundlerService('webpack-vue', () => new WebpackVueBundlerService());
 * ```
 */
export function registerBundlerService(key: string, factory: BundlerServiceFactory): void {
  bundlerRegistry.set(key, factory);
}

/** Cached bundler service instance loaded from config */
let cachedBundlerService: BaseBundlerService | null = null;

/**
 * Get bundler service based on toolkit.yaml configuration.
 *
 * If a custom service is configured in toolkit.yaml under style-system.bundler.customService,
 * it will be dynamically loaded. Otherwise, returns the default ViteReactBundlerService.
 *
 * The custom service module must:
 * - Export a class that extends BaseBundlerService as default export, OR
 * - Export an instance of BaseBundlerService as default export, OR
 * - Export a getInstance() function that returns a BaseBundlerService
 *
 * @returns Promise resolving to a bundler service instance
 *
 * @example
 * ```typescript
 * // In toolkit.yaml:
 * // style-system:
 * //   bundler:
 * //     customService: packages/my-app/src/bundler/CustomBundlerService.ts
 *
 * const bundler = await getBundlerServiceFromConfig();
 * await bundler.startDevServer('apps/my-app');
 * ```
 */
export async function getBundlerServiceFromConfig(): Promise<BaseBundlerService> {
  // Return cached instance if available
  if (cachedBundlerService) {
    return cachedBundlerService;
  }

  const config = await getBundlerConfig();

  if (!config?.customService) {
    // No custom service configured, use default
    cachedBundlerService = createDefaultBundlerService();
    return cachedBundlerService;
  }

  const monorepoRoot = TemplatesManagerService.getWorkspaceRootSync();
  const customServicePath = path.resolve(monorepoRoot, config.customService);

  // Security: Validate path stays within workspace root (prevent path traversal)
  const normalizedWorkspaceRoot = path.resolve(monorepoRoot);
  if (!customServicePath.startsWith(normalizedWorkspaceRoot + path.sep)) {
    log.error(
      `[BundlerServiceFactory] Security error: customService path "${config.customService}" ` +
        `resolves outside workspace root`,
    );
    cachedBundlerService = createDefaultBundlerService();
    return cachedBundlerService;
  }

  // Validate file extension is a valid source file
  const ext = path.extname(customServicePath).toLowerCase();
  if (!VALID_SERVICE_EXTENSIONS.includes(ext as (typeof VALID_SERVICE_EXTENSIONS)[number])) {
    log.error(
      `[BundlerServiceFactory] Invalid file extension "${ext}" for customService. ` +
        `Expected one of: ${VALID_SERVICE_EXTENSIONS.join(', ')}`,
    );
    cachedBundlerService = createDefaultBundlerService();
    return cachedBundlerService;
  }

  try {
    log.info(`[BundlerServiceFactory] Loading custom bundler service from: ${customServicePath}`);

    // Dynamic import of the custom service module
    const module = await import(customServicePath);

    // Try different export patterns
    if (module.default) {
      // Check if default export is a class (has prototype with constructor)
      if (typeof module.default === 'function' && module.default.prototype) {
        // Check for getInstance static method (singleton pattern)
        if (typeof module.default.getInstance === 'function') {
          cachedBundlerService = module.default.getInstance();
        } else {
          // Instantiate the class
          cachedBundlerService = new module.default();
        }
      } else if (typeof module.default === 'object') {
        // Default export is already an instance
        cachedBundlerService = module.default;
      }
    } else if (typeof module.getInstance === 'function') {
      // Named export getInstance function
      cachedBundlerService = module.getInstance();
    }

    if (!cachedBundlerService) {
      throw new Error(
        'Custom bundler service module must export a class extending BaseBundlerService as default, ' +
          'an instance as default, or a getInstance() function',
      );
    }

    // Validate it's a BaseBundlerService (duck typing check for all required methods)
    const requiredMethods = [
      'getBundlerId',
      'getFrameworkId',
      'startDevServer',
      'serveComponent',
      'prerenderComponent',
      'isServerRunning',
      'getServerUrl',
      'getServerPort',
      'getCurrentAppPath',
      'cleanup',
    ] as const;

    const missingMethods = requiredMethods.filter(
      (method) =>
        typeof (cachedBundlerService as unknown as Record<string, unknown>)[method] !== 'function',
    );

    if (missingMethods.length > 0) {
      throw new Error(
        `Custom bundler service must implement BaseBundlerService interface. ` +
          `Missing methods: ${missingMethods.join(', ')}`,
      );
    }

    log.info(`[BundlerServiceFactory] Custom bundler service loaded successfully`);
    return cachedBundlerService;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`[BundlerServiceFactory] Failed to load custom bundler service: ${message}`);
    log.info('[BundlerServiceFactory] Falling back to default ViteReactBundlerService');

    cachedBundlerService = createDefaultBundlerService();
    return cachedBundlerService;
  }
}

/**
 * Reset the cached bundler service.
 * Useful for testing or when config changes.
 */
export function resetBundlerServiceCache(): void {
  cachedBundlerService = null;
}
