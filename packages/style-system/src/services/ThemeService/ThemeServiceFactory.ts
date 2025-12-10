/**
 * ThemeServiceFactory
 *
 * DESIGN PATTERNS:
 * - Factory pattern for creating theme service instances
 * - Supports built-in CSS theme extraction and custom service loading
 *
 * CODING STANDARDS:
 * - Use async factory method for dynamic service loading
 * - Return typed results
 * - Throw descriptive errors with context
 *
 * AVOID:
 * - Synchronous file operations
 * - Hardcoded service paths
 */

import { BaseThemeService } from './BaseThemeService';
import { CSSThemeService } from './CSSThemeService';
import type { ThemeServiceConfig } from './types';
import { DEFAULT_THEME_SERVICE_CONFIG } from './types';

/**
 * Factory for creating theme service instances.
 *
 * Supports the built-in CSSThemeService and custom service implementations
 * loaded dynamically from user-specified paths.
 *
 * @example
 * ```typescript
 * const factory = new ThemeServiceFactory();
 *
 * // Create default CSS-based service
 * const service = await factory.createService({
 *   themePath: 'apps/my-app/src/styles/colors.css'
 * });
 *
 * // Create with custom service override
 * const customService = await factory.createService({
 *   customServicePath: './my-custom-theme-service.ts'
 * });
 *
 * const themes = await service.listThemes();
 * ```
 */
export class ThemeServiceFactory {
  /**
   * Create a theme service based on configuration.
   *
   * Resolution order:
   * 1. If customServicePath is provided, load custom service dynamically
   * 2. Otherwise, create the default CSSThemeService
   *
   * @param config - Theme service configuration
   * @returns Promise resolving to a theme service instance
   * @throws Error if custom service cannot be loaded or is invalid
   */
  async createService(config: Partial<ThemeServiceConfig> = {}): Promise<BaseThemeService> {
    const resolvedConfig: ThemeServiceConfig = {
      ...DEFAULT_THEME_SERVICE_CONFIG,
      ...config,
    };

    // If custom service path is provided, load dynamically
    if (resolvedConfig.customServicePath) {
      return this.loadCustomService(resolvedConfig);
    }

    // Use built-in CSS theme service
    return new CSSThemeService(resolvedConfig);
  }

  /**
   * Load a custom theme service from user-specified path.
   *
   * The custom service must export a class that extends BaseThemeService.
   *
   * @param config - Configuration with customServicePath set
   * @returns Promise resolving to custom service instance
   * @throws Error if service cannot be loaded or is invalid
   */
  private async loadCustomService(config: ThemeServiceConfig): Promise<BaseThemeService> {
    const servicePath = config.customServicePath;
    if (!servicePath) {
      throw new Error('customServicePath is required for custom service loading');
    }

    try {
      // Dynamic import required: path is user-specified at runtime
      const customModule = await import(servicePath);

      // Look for default export or named exports that extend BaseThemeService
      const ServiceClass =
        customModule.default ||
        customModule.ThemeService ||
        customModule.CustomThemeService;

      if (!ServiceClass) {
        throw new Error(
          `Custom service module at ${servicePath} must export a default class, ` +
            `ThemeService, or CustomThemeService that extends BaseThemeService`,
        );
      }

      const instance = new ServiceClass(config);

      if (!(instance instanceof BaseThemeService)) {
        throw new Error(`Custom service at ${servicePath} must extend BaseThemeService`);
      }

      return instance;
    } catch (error) {
      if (error instanceof Error && error.message.includes('BaseThemeService')) {
        throw error;
      }
      throw new Error(
        `Failed to load custom theme service from ${servicePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
