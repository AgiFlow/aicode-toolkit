/**
 * BundlerService Barrel Export
 *
 * Exports all BundlerService components for convenient importing.
 * The BundlerService abstraction allows different bundler/framework
 * combinations (Vite+React, Webpack+Vue, etc.) to be used interchangeably.
 *
 * @example
 * ```typescript
 * import {
 *   BaseBundlerService,
 *   ViteReactBundlerService,
 *   createDefaultBundlerService,
 *   type RenderOptions,
 * } from './BundlerService';
 *
 * // Use the default bundler
 * const bundler = createDefaultBundlerService();
 * await bundler.startDevServer('apps/my-app');
 *
 * // Or use a custom bundler
 * const customBundler = new MyCustomBundlerService();
 * ```
 */

// Base class
export { BaseBundlerService } from './BaseBundlerService';

// Default implementation
export { ViteReactBundlerService } from './ViteReactBundlerService';

// Factory functions
export {
  bundlerRegistry,
  createDefaultBundlerService,
  getBundlerService,
  registerBundlerService,
  type BundlerServiceFactory,
} from './BundlerServiceFactory';

// Types
export type {
  BuildOptions,
  BundlerServiceConfig,
  DevServerResult,
  PrerenderResult,
  RenderOptions,
  ServeComponentResult,
} from './types';

export { DEFAULT_BUNDLER_CONFIG } from './types';
