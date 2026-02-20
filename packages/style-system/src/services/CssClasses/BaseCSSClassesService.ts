/**
 * BaseCSSClassesService
 *
 * DESIGN PATTERNS:
 * - Abstract base class for CSS class extraction services
 * - Template method pattern for extensible extraction logic
 * - Strategy pattern allowing different CSS framework implementations
 *
 * CODING STANDARDS:
 * - Abstract classes define interface contracts for subclasses
 * - Protected methods allow subclass customization
 * - Use async/await for all I/O operations
 * - Throw descriptive errors with context
 *
 * AVOID:
 * - Direct instantiation of abstract class
 * - Framework-specific logic in base class
 * - Synchronous file operations
 */

import { promises as fs } from 'node:fs';
import type { CSSClassCategory, CSSClassesResult, StyleSystemConfig } from './types';

/**
 * Abstract base class for CSS class extraction services.
 *
 * Subclasses must implement the `extractClasses` method to provide
 * framework-specific CSS class extraction logic.
 *
 * @example
 * ```typescript
 * class MyCustomCSSService extends BaseCSSClassesService {
 *   async extractClasses(category: CSSClassCategory, themePath: string): Promise<CSSClassesResult> {
 *     // Custom extraction logic
 *   }
 * }
 * ```
 */
export abstract class BaseCSSClassesService {
  protected config: StyleSystemConfig;

  /**
   * Creates a new CSS classes service instance
   * @param config - Style system configuration from toolkit.yaml
   */
  constructor(config: StyleSystemConfig) {
    this.config = config;
  }

  /**
   * Extract CSS classes from a theme file.
   *
   * Subclasses must implement this method to provide framework-specific
   * extraction logic (e.g., Tailwind, vanilla CSS, CSS-in-JS).
   *
   * @param category - Category filter for CSS classes ('colors', 'typography', 'spacing', 'effects', 'all')
   * @param themePath - Absolute path to the theme CSS file
   * @returns Promise resolving to extracted CSS classes organized by category
   * @throws Error if theme file cannot be read or parsed
   */
  abstract extractClasses(
    category: CSSClassCategory | string,
    themePath: string,
  ): Promise<CSSClassesResult>;

  /**
   * Get the CSS framework identifier for this service
   * @returns Framework identifier string (e.g., 'tailwind', 'vanilla')
   */
  abstract getFrameworkId(): string;

  /**
   * Validate that the theme path exists and is readable.
   * Can be overridden by subclasses for custom validation.
   *
   * @param themePath - Path to validate
   * @throws Error if path is invalid or unreadable
   */
  protected async validateThemePath(themePath: string): Promise<void> {
    try {
      await fs.access(themePath);
    } catch {
      throw new Error(`Theme file not found or not readable: ${themePath}`);
    }
  }
}
