/**
 * ThemeService Types
 *
 * Type definitions for the ThemeService service.
 */

/**
 * Configuration for theme service
 */
export interface ThemeServiceConfig {
  /** Path to theme CSS file (from project.json style-system.themePath) */
  themePath?: string;
  /** CSS files to scan for themes (from project.json style-system.cssFiles) */
  cssFiles?: string[];
  /** Custom service path for user-provided theme service implementation */
  customServicePath?: string;
}

/**
 * Default theme service configuration
 */
export const DEFAULT_THEME_SERVICE_CONFIG: ThemeServiceConfig = {
  themePath: undefined,
  cssFiles: [],
  customServicePath: undefined,
};

/**
 * Theme metadata returned by listAvailableThemes
 */
export interface ThemeInfo {
  /** Theme name (derived from CSS class selector or filename) */
  name: string;
  /** Original filename with extension */
  fileName: string;
  /** Absolute path to theme file */
  path: string;
  /** Color variables defined in theme (from CSS parsing) */
  colorVariables?: Record<string, string>;
  /** Legacy: color data from JSON config (deprecated, use colorVariables) */
  colors?: Record<string, unknown>;
  /** Number of color shades (e.g., 50-950) */
  shadeCount?: number;
}

/**
 * Result of listing available themes
 */
export interface AvailableThemesResult {
  /** Array of available themes */
  themes: ThemeInfo[];
  /** Currently active theme name if detected */
  activeTheme?: string;
  /** Legacy: active brand name (deprecated, use activeTheme) */
  activeBrand?: string;
  /** Source of themes (css-file, json-config, custom) */
  source?: 'css-file' | 'json-config' | 'custom';
}

/**
 * Result returned by ThemeService operations (generic wrapper)
 */
export interface ThemeServiceResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Result data if successful */
  data?: AvailableThemesResult;
  /** Error message if failed */
  error?: string;
}
