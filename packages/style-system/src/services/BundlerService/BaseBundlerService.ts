/**
 * BaseBundlerService
 *
 * DESIGN PATTERNS:
 * - Abstract base class for bundler service implementations
 * - Template method pattern for extensible bundling logic
 * - Strategy pattern allowing different bundler/framework combinations
 *
 * CODING STANDARDS:
 * - Abstract classes define interface contracts for subclasses
 * - Protected methods allow subclass customization
 * - Use async/await for all I/O operations
 * - Throw descriptive errors with context
 *
 * AVOID:
 * - Direct instantiation of abstract class
 * - Bundler-specific logic in base class
 * - Synchronous file operations
 */

import type {
  BundlerServiceConfig,
  DevServerResult,
  PrerenderResult,
  RenderOptions,
  ServeComponentResult,
} from './types';

/**
 * Abstract base class for bundler service implementations.
 *
 * Subclasses must implement the abstract methods to provide
 * bundler-specific (Vite, Webpack, etc.) and framework-specific
 * (React, Vue, etc.) component rendering logic.
 *
 * @example
 * ```typescript
 * class MyCustomBundlerService extends BaseBundlerService {
 *   async startDevServer(appPath: string): Promise<DevServerResult> {
 *     // Custom dev server logic
 *   }
 *   // ... implement other abstract methods
 * }
 * ```
 */
export abstract class BaseBundlerService {
  protected config: BundlerServiceConfig;

  /**
   * Creates a new bundler service instance.
   * @param config - Service configuration options
   */
  constructor(config: BundlerServiceConfig = {}) {
    this.config = config;
  }

  /**
   * Get the bundler identifier for this service.
   * @returns Bundler identifier string (e.g., 'vite', 'webpack')
   */
  abstract getBundlerId(): string;

  /**
   * Get the framework identifier for this service.
   * @returns Framework identifier string (e.g., 'react', 'vue')
   */
  abstract getFrameworkId(): string;

  /**
   * Start a dev server for hot reload and caching.
   *
   * @param appPath - Absolute or relative path to the app directory
   * @returns Promise resolving to server URL and port
   * @throws Error if server fails to start
   */
  abstract startDevServer(appPath: string): Promise<DevServerResult>;

  /**
   * Serve a component dynamically through the dev server.
   *
   * @param options - Component rendering options
   * @returns Promise resolving to the component URL and HTML file path
   * @throws Error if dev server is not running or rendering fails
   */
  abstract serveComponent(options: RenderOptions): Promise<ServeComponentResult>;

  /**
   * Pre-render a component to a static HTML file.
   *
   * @param options - Component rendering options
   * @returns Promise resolving to the HTML file path
   * @throws Error if build fails
   */
  abstract prerenderComponent(options: RenderOptions): Promise<PrerenderResult>;

  /**
   * Check if the dev server is running.
   * @returns True if server is running
   */
  abstract isServerRunning(): boolean;

  /**
   * Get the current server URL.
   * @returns Server URL or null if not running
   */
  abstract getServerUrl(): string | null;

  /**
   * Get the current server port.
   * @returns Server port or null if not running
   */
  abstract getServerPort(): number | null;

  /**
   * Get the current app path being served.
   * @returns App path or null if not running
   */
  abstract getCurrentAppPath(): string | null;

  /**
   * Clean up server resources and reset state.
   */
  abstract cleanup(): Promise<void>;
}
