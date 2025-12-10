/**
 * VitejsService Types
 *
 * Type definitions for the VitejsService service.
 */

/**
 * Options for pre-rendering a component
 */
export interface PreRenderOptions {
  /** Absolute path to the component story file */
  componentPath: string;
  /** Name of the story to render */
  storyName: string;
  /** Optional args to pass to the story */
  args?: Record<string, unknown>;
  /** Path to theme provider */
  themePath?: string;
  /** Whether to use dark mode */
  darkMode?: boolean;
  /** Path to the app directory */
  appPath: string;
  /** CSS files to import */
  cssFiles?: string[];
  /** Path to root component wrapper */
  rootComponent?: string;
}

/**
 * Internal options for building a component to static HTML
 */
export interface BuildComponentOptions {
  /** Absolute path to the component story file */
  componentPath: string;
  /** Name of the story to render */
  storyName: string;
  /** Args to pass to the story */
  args: Record<string, unknown>;
  /** Resolved absolute path to the app directory */
  appPath: string;
  /** Whether to use dark mode */
  darkMode: boolean;
  /** CSS files to import */
  cssFiles: string[];
  /** Path to root component wrapper */
  rootComponent?: string;
  /** Temporary directory for build artifacts */
  tmpDir: string;
}

/**
 * Configuration options for VitejsService
 */
export interface VitejsServiceConfig {
  /**
   * Enable verbose logging
   * @default false
   */
  verbose?: boolean;
}

/**
 * Result returned by VitejsService operations
 */
export interface VitejsServiceResult {
  /**
   * Whether the operation was successful
   */
  success: boolean;

  /**
   * Result data if successful
   */
  data?: unknown;

  /**
   * Error message if failed
   */
  error?: string;
}
