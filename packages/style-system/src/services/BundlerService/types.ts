/**
 * BundlerService Types
 *
 * Type definitions for the BundlerService abstraction.
 * Supports multiple bundler implementations (Vite, Webpack, etc.)
 * and multiple frameworks (React, Vue, etc.).
 */

/**
 * Options for rendering a component through the bundler.
 *
 * @example
 * ```typescript
 * const options: RenderOptions = {
 *   componentPath: '/path/to/Button.stories.tsx',
 *   storyName: 'Primary',
 *   appPath: 'apps/my-app',
 *   darkMode: true,
 * };
 * ```
 */
export interface RenderOptions {
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
 * Internal options for building a component to static HTML.
 */
export interface BuildOptions {
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
 * Result from starting a dev server.
 */
export interface DevServerResult {
  /** URL where the dev server is accessible */
  url: string;
  /** Port the server is listening on */
  port: number;
}

/**
 * Result from serving a component through dev server.
 */
export interface ServeComponentResult {
  /** URL to access the rendered component */
  url: string;
  /** Path to the generated HTML file (optional if served from memory) */
  htmlFilePath?: string;
  /** The generated HTML content (optional if served from memory) */
  htmlContent?: string;
}

/**
 * Result from pre-rendering a component to static HTML.
 */
export interface PrerenderResult {
  /** Path to the generated static HTML file */
  htmlFilePath: string;
}

/**
 * Configuration for BundlerService implementations.
 */
export interface BundlerServiceConfig {
  /** Enable verbose logging @default false */
  verbose?: boolean;
}

/**
 * Default configuration values.
 */
export const DEFAULT_BUNDLER_CONFIG: Required<BundlerServiceConfig> = {
  verbose: false,
};
