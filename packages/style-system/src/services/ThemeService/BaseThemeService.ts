/**
 * BaseThemeService
 *
 * DESIGN PATTERNS:
 * - Abstract base class for theme listing services
 * - Template method pattern for extensible theme extraction
 * - Strategy pattern allowing different theme source implementations
 *
 * CODING STANDARDS:
 * - Abstract classes define interface contracts for subclasses
 * - Protected methods allow subclass customization
 * - Use async/await for all I/O operations
 * - Throw descriptive errors with context
 *
 * AVOID:
 * - Direct instantiation of abstract class
 * - Source-specific logic in base class
 * - Synchronous file operations
 */

import { promises as fs } from 'node:fs';
import type { AvailableThemesResult, ThemeServiceConfig } from './types';

/**
 * Abstract base class for theme listing services.
 *
 * Subclasses must implement the `listThemes` method to provide
 * source-specific theme extraction logic (CSS files, JSON configs, etc.).
 *
 * @example
 * ```typescript
 * class MyCustomThemeService extends BaseThemeService {
 *   async listThemes(): Promise<AvailableThemesResult> {
 *     // Custom theme extraction logic
 *   }
 * }
 * ```
 */
export abstract class BaseThemeService {
  protected config: ThemeServiceConfig;

  /**
   * Creates a new theme service instance
   * @param config - Theme service configuration
   */
  constructor(config: ThemeServiceConfig) {
    this.config = config;
  }

  /**
   * List available themes from the configured source.
   *
   * Subclasses must implement this method to provide source-specific
   * theme extraction logic (e.g., CSS class selectors, JSON files).
   *
   * @returns Promise resolving to available themes result
   * @throws Error if themes cannot be loaded
   */
  abstract listThemes(): Promise<AvailableThemesResult>;

  /**
   * Get the source identifier for this service
   * @returns Source identifier string (e.g., 'css-file', 'json-config', 'custom')
   */
  abstract getSourceId(): 'css-file' | 'json-config' | 'custom';

  /**
   * Validate that a file path exists and is readable.
   * Can be overridden by subclasses for custom validation.
   *
   * @param filePath - Path to validate
   * @throws Error if path is invalid or unreadable
   */
  protected async validatePath(filePath: string): Promise<void> {
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`File not found or not readable: ${filePath}`);
    }
  }
}
