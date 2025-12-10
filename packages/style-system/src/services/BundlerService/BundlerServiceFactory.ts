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

import type { BaseBundlerService } from './BaseBundlerService';
import { ViteReactBundlerService } from './ViteReactBundlerService';

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
