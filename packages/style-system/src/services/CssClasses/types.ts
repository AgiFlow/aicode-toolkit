/**
 * CSSClasses Service Types
 *
 * Shared type definitions for CSS class extraction services.
 * Configuration is read from toolkit.yaml under the 'style-system' key.
 */

/**
 * Represents a single CSS class with its name and value
 */
export interface CSSClassValue {
  class: string;
  value: string;
}

/**
 * Categories of CSS classes that can be extracted
 */
export type CSSClassCategory = 'colors' | 'typography' | 'spacing' | 'effects' | 'all';

/**
 * Result of CSS class extraction organized by category
 */
export interface CSSClassesResult {
  category: string;
  classes: {
    colors?: CSSClassValue[];
    typography?: CSSClassValue[];
    spacing?: CSSClassValue[];
    effects?: CSSClassValue[];
    sidebar?: CSSClassValue[];
    icons?: CSSClassValue[];
    grid?: CSSClassValue[];
    animations?: CSSClassValue[];
  };
  totalClasses?: number;
}

/**
 * CSS classes service configuration
 *
 * Example toolkit.yaml:
 * ```yaml
 * style-system:
 *   getCssClasses:
 *     customService: ./my-custom-css-service.ts
 * ```
 */
export interface StyleSystemConfig {
  /** CSS framework type (tailwind, vanilla, etc.) */
  cssFramework: string;

  /**
   * Custom service class path for CSS extraction override.
   * Path is relative to workspace root.
   * The module must export a class that extends BaseCSSClassesService.
   */
  customServicePath?: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_STYLE_SYSTEM_CONFIG: StyleSystemConfig = {
  cssFramework: 'tailwind',
};
