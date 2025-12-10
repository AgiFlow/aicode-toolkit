/**
 * CSSClassesServiceFactory
 *
 * DESIGN PATTERNS:
 * - Factory pattern for creating CSS classes service instances
 * - Supports built-in frameworks and custom service loading
 *
 * CODING STANDARDS:
 * - Use async factory method for dynamic service loading
 * - Return typed results
 * - Throw descriptive errors with context
 *
 * AVOID:
 * - Synchronous file operations
 * - Hardcoded framework paths
 */

import { BaseCSSClassesService } from './BaseCSSClassesService';
import { TailwindCSSClassesService } from './TailwindCSSClassesService';
import type { StyleSystemConfig } from './types';
import { DEFAULT_STYLE_SYSTEM_CONFIG } from './types';

/**
 * Factory for creating CSS classes service instances.
 *
 * Supports built-in frameworks (tailwind) and custom service implementations
 * loaded dynamically from user-specified paths.
 *
 * @example
 * ```typescript
 * const factory = new CSSClassesServiceFactory();
 * const service = await factory.createService({ cssFramework: 'tailwind' });
 * const classes = await service.extractClasses('colors', '/path/to/theme.css');
 * ```
 */
export class CSSClassesServiceFactory {
  /**
   * Create a CSS classes service based on configuration.
   *
   * @param config - Style system configuration (defaults to tailwind)
   * @returns Promise resolving to a CSS classes service instance
   * @throws Error if framework is unknown or custom service cannot be loaded
   */
  async createService(config: Partial<StyleSystemConfig> = {}): Promise<BaseCSSClassesService> {
    const resolvedConfig: StyleSystemConfig = {
      ...DEFAULT_STYLE_SYSTEM_CONFIG,
      ...config,
    };

    // If custom service path is provided, load dynamically
    if (resolvedConfig.customServicePath) {
      return this.loadCustomService(resolvedConfig);
    }

    // Use built-in framework services
    return this.createBuiltInService(resolvedConfig);
  }

  /**
   * Create a built-in CSS classes service based on framework identifier.
   *
   * @param config - Resolved style system configuration
   * @returns CSS classes service instance
   * @throws Error if framework is not supported
   */
  private createBuiltInService(config: StyleSystemConfig): BaseCSSClassesService {
    switch (config.cssFramework) {
      case 'tailwind':
        return new TailwindCSSClassesService(config);
      default:
        throw new Error(
          `Unsupported CSS framework: ${config.cssFramework}. ` +
            `Supported frameworks: tailwind. ` +
            `Use customServicePath to provide a custom implementation.`,
        );
    }
  }

  /**
   * Load a custom CSS classes service from user-specified path.
   *
   * The custom service must export a class that extends BaseCSSClassesService.
   *
   * @param config - Configuration with customServicePath set
   * @returns Promise resolving to custom service instance
   * @throws Error if service cannot be loaded or is invalid
   */
  private async loadCustomService(config: StyleSystemConfig): Promise<BaseCSSClassesService> {
    const servicePath = config.customServicePath;
    if (!servicePath) {
      throw new Error('customServicePath is required for custom service loading');
    }

    try {
      const customModule = await import(servicePath);

      // Look for default export or named export that extends BaseCSSClassesService
      const ServiceClass = customModule.default || customModule.CSSClassesService || customModule.CustomCSSClassesService;

      if (!ServiceClass) {
        throw new Error(
          `Custom service module at ${servicePath} must export a default class, ` +
            `CSSClassesService, or CustomCSSClassesService that extends BaseCSSClassesService`,
        );
      }

      const instance = new ServiceClass(config);

      if (!(instance instanceof BaseCSSClassesService)) {
        throw new Error(`Custom service at ${servicePath} must extend BaseCSSClassesService`);
      }

      return instance;
    } catch (error) {
      if (error instanceof Error && error.message.includes('BaseCSSClassesService')) {
        throw error;
      }
      throw new Error(
        `Failed to load custom CSS classes service from ${servicePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
