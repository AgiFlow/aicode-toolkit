/**
 * ViteReactBundlerService
 *
 * DESIGN PATTERNS:
 * - Concrete implementation of BaseBundlerService
 * - Singleton pattern for dev server management
 * - Programmatic Vite build for React component SSR
 *
 * CODING STANDARDS:
 * - Use async/await for asynchronous operations
 * - Throw descriptive errors for error cases
 * - Keep methods focused and well-named
 * - Document complex logic with comments
 *
 * AVOID:
 * - Mixing concerns (keep focused on Vite + React)
 * - Direct tool implementation (services should be tool-agnostic)
 */

import { promises as fs } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { log, TemplatesManagerService } from '@agiflowai/aicode-utils';
import tailwindcss from '@tailwindcss/vite';
import type { Connect, Plugin, ViteDevServer } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { BaseBundlerService } from './BaseBundlerService';
import type {
  BuildOptions,
  BundlerServiceConfig,
  DevServerResult,
  PrerenderResult,
  RenderOptions,
  ServeComponentResult,
} from './types';

/**
 * Maximum age for story configs in milliseconds (5 minutes).
 * Configs older than this are cleaned up to prevent memory leaks.
 */
const STORY_CONFIG_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Maximum number of story configs to keep in memory.
 * Oldest configs are removed when this limit is exceeded.
 */
const STORY_CONFIG_MAX_COUNT = 100;

/**
 * Valid pattern for story names.
 * Allows alphanumeric characters, underscores, hyphens, and spaces.
 */
const VALID_STORY_NAME_PATTERN = /^[a-zA-Z0-9_\- ]+$/;

/**
 * Valid pattern for component paths.
 * Must end with .stories.tsx, .stories.ts, .stories.jsx, or .stories.js
 */
const VALID_COMPONENT_PATH_PATTERN = /\.stories\.(tsx?|jsx?)$/;

/**
 * Validates a story name to prevent code injection.
 * @param storyName - The story name to validate
 * @throws Error if the story name contains invalid characters
 */
function validateStoryName(storyName: string): void {
  if (!storyName || typeof storyName !== 'string') {
    throw new Error('Story name is required and must be a string');
  }
  if (!VALID_STORY_NAME_PATTERN.test(storyName)) {
    throw new Error(
      `Story name "${storyName}" contains invalid characters. Only alphanumeric characters, underscores, hyphens, and spaces are allowed.`,
    );
  }
}

/**
 * Validates a component path to prevent code injection.
 * @param componentPath - The component path to validate
 * @throws Error if the component path is invalid
 */
function validateComponentPath(componentPath: string): void {
  if (!componentPath || typeof componentPath !== 'string') {
    throw new Error('Component path is required and must be a string');
  }
  if (!VALID_COMPONENT_PATH_PATTERN.test(componentPath)) {
    throw new Error(
      `Component path "${componentPath}" must be a valid Storybook story file (*.stories.tsx, *.stories.ts, *.stories.jsx, or *.stories.js)`,
    );
  }
  // Prevent path traversal attacks
  if (componentPath.includes('..')) {
    throw new Error('Component path must not contain path traversal sequences (..)');
  }
}

/**
 * Helper to create a Vite plugin that serves story entry files from memory.
 */
function createStoryEntryPlugin(
  getStoryConfig: (id: string) => BuildOptions | undefined,
  generateCode: (opts: BuildOptions) => string,
): Plugin {
  // Virtual module pattern for serving story entry files from memory
  // The /@virtual:story-entry?id=xxx pattern is used in HTML script src
  return {
    name: 'vite-plugin-story-entry',
    enforce: 'pre',  // Run before Vite's built-in plugins (especially vite:build-html)
    resolveId(id: string): string | undefined {
      // Match virtual module requests (with or without leading /)
      if (id.includes('virtual:story-entry')) {
        log.debug(`[vite-plugin-story-entry] resolveId: ${id}`);
        return `\0${id.replace(/^\//, '')}`;  // Remove leading / if present
      }
      return undefined;
    },
    load(id: string): string | undefined {
      if (id.includes('virtual:story-entry')) {
        log.debug(`[vite-plugin-story-entry] load: ${id}`);
        // Extract story ID from the virtual module id
        const idMatch = id.match(/id=([^&]+)/);
        const storyId = idMatch?.[1];

        if (storyId) {
          const config = getStoryConfig(storyId);
          if (config) {
            return generateCode(config);
          }
        }
        throw new Error(`[Vite] Story config not found for id: ${storyId}`);
      }
      return undefined;
    },
  };
}

/**
 * ViteReactBundlerService provides Vite + React bundling for component rendering.
 *
 * This is the default implementation of BaseBundlerService that uses Vite
 * as the bundler and React as the framework for rendering components.
 *
 * @example
 * ```typescript
 * const service = ViteReactBundlerService.getInstance();
 * await service.startDevServer('apps/my-app');
 * const { url } = await service.serveComponent({
 *   componentPath: '/path/to/Button.stories.tsx',
 *   storyName: 'Primary',
 *   appPath: 'apps/my-app'
 * });
 * ```
 */
export class ViteReactBundlerService extends BaseBundlerService {
  private static instance: ViteReactBundlerService | null = null;

  private server: ViteDevServer | null = null;
  private monorepoRoot: string;
  private serverUrl: string | null = null;
  private serverPort: number | null = null;
  private currentAppPath: string | null = null;
  private storyConfigs = new Map<string, BuildOptions>();
  /** Timestamps for when each story config was created, used for cleanup */
  private storyConfigTimestamps = new Map<string, number>();

  /**
   * Creates a new ViteReactBundlerService instance.
   * Use getInstance() for singleton access.
   * @param config - Service configuration options
   */
  constructor(config: BundlerServiceConfig = {}) {
    super(config);
    this.monorepoRoot = TemplatesManagerService.getWorkspaceRootSync();
  }

  /**
   * Get the singleton instance of ViteReactBundlerService.
   * Singleton pattern ensures only one dev server runs at a time,
   * preventing port conflicts and resource duplication.
   * @returns The singleton ViteReactBundlerService instance
   */
  static getInstance(): ViteReactBundlerService {
    // Create instance only if it doesn't exist (lazy initialization)
    if (!ViteReactBundlerService.instance) {
      ViteReactBundlerService.instance = new ViteReactBundlerService();
    }
    return ViteReactBundlerService.instance;
  }

  /**
   * Reset the singleton instance.
   * This is primarily used in testing to ensure a fresh instance.
   * @example
   * ```typescript
   * afterEach(() => {
   *   ViteReactBundlerService.resetInstance();
   * });
   * ```
   */
  static resetInstance(): void {
    ViteReactBundlerService.instance = null;
  }

  /**
   * Get the bundler identifier.
   * @returns The bundler ID string ('vite')
   */
  getBundlerId(): string {
    return 'vite';
  }

  /**
   * Get the framework identifier.
   * @returns The framework ID string ('react')
   */
  getFrameworkId(): string {
    return 'react';
  }

  /**
   * Get the current server URL.
   * @returns Server URL or null if not running
   */
  getServerUrl(): string | null {
    return this.serverUrl;
  }

  /**
   * Get the current server port.
   * @returns Server port or null if not running
   */
  getServerPort(): number | null {
    return this.serverPort;
  }

  /**
   * Check if the dev server is running.
   * @returns True if server is running
   */
  isServerRunning(): boolean {
    return this.server !== null && this.serverUrl !== null;
  }

  /**
   * Get the current app path being served.
   * @returns App path or null if not running
   */
  getCurrentAppPath(): string | null {
    return this.currentAppPath;
  }

  /**
   * Start a Vite dev server for hot reload and caching.
   * @param appPath - Absolute or relative path to the app directory
   * @returns Promise resolving to server URL and port
   * @throws Error if server fails to start
   */
  async startDevServer(appPath: string): Promise<DevServerResult> {
    const resolvedAppPath = path.isAbsolute(appPath) ? appPath : path.join(this.monorepoRoot, appPath);
    const tmpDir = path.join(resolvedAppPath, '.tmp');

    try {
      await fs.mkdir(tmpDir, { recursive: true });

      const { createServer } = await import('vite');

      this.server = await createServer({
        root: tmpDir,
        base: '/',
        configFile: false,
        plugins: [
          tailwindcss(),
          createStoryEntryPlugin(
            (id) => this.storyConfigs.get(id),
            (opts) => this.generateEntryFile(opts),
          ),
        ],
        resolve: {
          alias: {
            '@': path.join(resolvedAppPath, 'src'),
          },
        },
        esbuild: {
          jsx: 'automatic',
          jsxImportSource: 'react',
        },
        server: {
          strictPort: false,
          open: false,
        },
      });

      // Add middleware to serve HTML from memory
      this.server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
        const url = req.url || '/';
        // Match preview URLs like /preview/{storyId} - captures the storyId parameter
        const match = url.match(/^\/preview\/([^/?]+)/);

        if (match) {
          const storyId = match[1];
          const config = this.storyConfigs.get(storyId);

          if (config) {
            try {
              const htmlTemplate = this.generateHtmlTemplate(`@virtual:story-entry?id=${storyId}`, config.darkMode);
              // Transform HTML using Vite (injects client scripts, HMR, etc.)
              const transformedHtml = await this.server!.transformIndexHtml(url, htmlTemplate);

              res.statusCode = 200;
              res.setHeader('Content-Type', 'text/html');
              res.end(transformedHtml);
              return;
            } catch (e) {
              const err = e as Error;
              log.error(`[ViteMiddleware] Error serving preview: ${err.message}`);
              next(err);
              return;
            }
          }
        }
        next();
      });

      await this.server.listen();

      // httpServer.address() returns AddressInfo object on success, string for pipe/socket, or null on error
      // We need the AddressInfo object to extract the port number
      const address = this.server.httpServer?.address();
      if (!address || typeof address === 'string') {
        throw new Error(
          'Failed to start Vite dev server. Ensure no other process is using the port.',
        );
      }

      const port = address.port;
      const url = `http://localhost:${port}`;
      this.serverUrl = url;
      this.serverPort = port;
      this.currentAppPath = resolvedAppPath;

      log.info(`[ViteReactBundlerService] Vite dev server started at ${url}`);

      return { url, port };
    } catch (error) {
      const err = new Error(
        `Failed to start dev server for ${appPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
      err.cause = error;
      throw err;
    }
  }

  /**
   * Serve a component dynamically through the dev server.
   * @param options - Component rendering options
   * @returns Promise resolving to the component URL and HTML file path
   * @throws Error if dev server is not running or file operations fail
   */
  async serveComponent(options: RenderOptions): Promise<ServeComponentResult> {
    if (!this.isServerRunning()) {
      throw new Error('Dev server is not running. Start it first using startDevServer().');
    }

    const { componentPath, storyName, args = {}, darkMode = false, appPath, cssFiles = [], rootComponent } = options;

    // Validate inputs to prevent code injection
    validateStoryName(storyName);
    validateComponentPath(componentPath);

    const resolvedAppPath = path.isAbsolute(appPath) ? appPath : path.join(this.monorepoRoot, appPath);

    if (this.currentAppPath !== resolvedAppPath) {
      throw new Error(
        `Dev server is running for ${this.currentAppPath} but requested ${resolvedAppPath}.`,
      );
    }

    const tmpDir = path.join(resolvedAppPath, '.tmp');

    try {
      // Clean up stale story configs to prevent memory leaks
      this.cleanupStaleStoryConfigs();

      // Create tmpDir if it doesn't exist
      await fs.mkdir(tmpDir, { recursive: true });

      // Write wrapper CSS with @source directive for Tailwind v4 content scanning
      const wrapperCssPath = path.join(tmpDir, 'tailwind-wrapper.css');
      const wrapperCssContent = this.generateWrapperCss(resolvedAppPath, cssFiles);
      await fs.writeFile(wrapperCssPath, wrapperCssContent, 'utf-8');

      const timestamp = Date.now();
      const storyId = `${timestamp}-${Math.random().toString(36).slice(2)}`;

      // Store config in memory with timestamp for cleanup
      this.storyConfigs.set(storyId, {
        componentPath,
        storyName,
        args,
        appPath: resolvedAppPath,
        darkMode,
        cssFiles,
        rootComponent,
        tmpDir,
      });
      this.storyConfigTimestamps.set(storyId, timestamp);

      const url = `${this.serverUrl}/preview/${storyId}`;
      const htmlContent = this.generateHtmlTemplate(`@virtual:story-entry?id=${storyId}`, darkMode);

      log.info(`[ViteReactBundlerService] Component served at: ${url}`);

      return {
        url,
        htmlContent,
      };
    } catch (error) {
      const err = new Error(
        `Failed to serve component ${storyName}: ${error instanceof Error ? error.message : String(error)}`,
      );
      err.cause = error;
      throw err;
    }
  }

  /**
   * Pre-render a component to a static HTML file.
   * @param options - Component rendering options
   * @returns Promise resolving to the HTML file path
   * @throws Error if build fails
   */
  async prerenderComponent(options: RenderOptions): Promise<PrerenderResult> {
    const { componentPath, storyName, args = {}, darkMode = false, appPath, cssFiles = [], rootComponent } = options;

    // Validate inputs to prevent code injection
    validateStoryName(storyName);
    validateComponentPath(componentPath);

    const resolvedAppPath = path.isAbsolute(appPath) ? appPath : path.join(this.monorepoRoot, appPath);
    const tmpDir = path.join(resolvedAppPath, '.tmp');

    try {
      await fs.mkdir(tmpDir, { recursive: true });

      const htmlFilePath = await this.buildComponent({
        componentPath, storyName, args, appPath: resolvedAppPath, darkMode, cssFiles, rootComponent, tmpDir,
      });

      return { htmlFilePath };
    } catch (error) {
      const err = new Error(
        `Failed to prerender component ${storyName}: ${error instanceof Error ? error.message : String(error)}`,
      );
      err.cause = error;
      throw err;
    }
  }

  /**
   * Clean up server resources and reset state.
   * Closes the Vite dev server if running.
   *
   * Note: Errors during server close are intentionally logged but not re-thrown.
   * This ensures cleanup always completes and state is reset, even if the server
   * is in an unexpected state. Callers should not depend on cleanup failure detection.
   */
  async cleanup(): Promise<void> {
    if (this.server) {
      log.info('[ViteReactBundlerService] Closing Vite dev server...');
      try {
        await this.server.close();
      } catch (error) {
        // Intentionally suppressed - cleanup should always complete
        log.error(`[ViteReactBundlerService] Error closing server: ${error instanceof Error ? error.message : String(error)}`);
      }
      this.server = null;
      this.serverUrl = null;
      this.serverPort = null;
      this.currentAppPath = null;
      // Clear story configs to free memory
      this.storyConfigs.clear();
      this.storyConfigTimestamps.clear();
      log.info('[ViteReactBundlerService] Vite dev server closed');
    }
  }

  /**
   * Clean up stale story configs to prevent memory leaks.
   * Removes configs that are older than STORY_CONFIG_MAX_AGE_MS or
   * when the number of configs exceeds STORY_CONFIG_MAX_COUNT.
   */
  private cleanupStaleStoryConfigs(): void {
    const now = Date.now();
    const entriesToDelete: string[] = [];

    // Find configs that are too old
    for (const [storyId, timestamp] of this.storyConfigTimestamps) {
      if (now - timestamp > STORY_CONFIG_MAX_AGE_MS) {
        entriesToDelete.push(storyId);
      }
    }

    // Delete stale entries
    for (const storyId of entriesToDelete) {
      this.storyConfigs.delete(storyId);
      this.storyConfigTimestamps.delete(storyId);
    }

    if (entriesToDelete.length > 0) {
      log.debug(`[ViteReactBundlerService] Cleaned up ${entriesToDelete.length} stale story configs`);
    }

    // If still over limit, remove oldest entries
    if (this.storyConfigs.size > STORY_CONFIG_MAX_COUNT) {
      const sortedEntries = Array.from(this.storyConfigTimestamps.entries())
        .sort((a, b) => a[1] - b[1]); // Sort by timestamp ascending (oldest first)

      const toRemove = sortedEntries.slice(0, this.storyConfigs.size - STORY_CONFIG_MAX_COUNT);
      for (const [storyId] of toRemove) {
        this.storyConfigs.delete(storyId);
        this.storyConfigTimestamps.delete(storyId);
      }

      log.debug(`[ViteReactBundlerService] Removed ${toRemove.length} oldest story configs to stay under limit`);
    }
  }

  /**
   * Generate a wrapper CSS file with @source directive for Tailwind v4.
   * This tells Tailwind where to scan for class names when building from .tmp directory.
   * @param appPath - Absolute path to the app directory
   * @param cssFiles - Array of CSS file paths to import
   * @returns Generated CSS content with @source directive
   */
  private generateWrapperCss(appPath: string, cssFiles: string[]): string {
    // Generate CSS imports based on path patterns
    const cssImportStatements = cssFiles
      .map((cssFile) => {
        if (cssFile.startsWith('@') || cssFile.startsWith('tailwindcss/')) {
          return `@import '${cssFile}';`;
        }
        if (cssFile.startsWith('packages/') || cssFile.startsWith('apps/')) {
          return `@import '${path.join(this.monorepoRoot, cssFile)}';`;
        }
        return `@import '${path.join(appPath, cssFile)}';`;
      })
      .join('\n');

    // Add @source directive to tell Tailwind v4 where to find component files
    // This is necessary because we're building from .tmp but components are in src/
    return `/* Tailwind v4 source configuration for component scanning */
@source "${path.join(appPath, 'src')}";

${cssImportStatements}
`;
  }

  /**
   * Generate the React entry file content for rendering a story.
   * @param options - Build options including component path and story name
   * @returns Generated TypeScript/JSX entry file content
   */
  private generateEntryFile(options: BuildOptions): string {
    const { componentPath, storyName, args, appPath, darkMode, rootComponent, tmpDir } = options;
    const argsJson = JSON.stringify(args, null, 2);

    // Use absolute path to wrapper CSS with @source directive for Tailwind v4
    // Virtual modules don't have a real location, so relative paths don't work
    const wrapperCssPath = path.join(tmpDir!, 'tailwind-wrapper.css').replace(/\\/g, '/');
    const cssImports = `import '${wrapperCssPath}';`;

    // Import root component wrapper if specified (e.g., theme provider, layout wrapper)
    const rootComponentImport = rootComponent
      ? `import { RootDocument } from '${path.join(appPath, rootComponent).replace(/\\/g, '/')}';`
      : '';

    // Determine wrapper component - use RootDocument if provided, otherwise React.Fragment
    const wrapWithRoot = rootComponent ? 'RootDocument' : 'React.Fragment';
    const wrapperProps = rootComponent ? `{ darkMode: ${darkMode} }` : '{}';

    // Generate the entry file with the following structure:
    // 1. CSS imports for styling
    // 2. React and story imports
    // 3. Story resolution and args merging
    // 4. Element creation (supports both render function and component patterns)
    // 5. Wrapper application and DOM mounting
    return `${cssImports}

import React from 'react';
import { createRoot } from 'react-dom/client';
import * as Stories from '${componentPath}';
${rootComponentImport}

// Extract story metadata and the specific story to render
const meta = Stories.default;
const Story = Stories['${storyName}'];
const storyArgs = Story?.args || {};
// Merge story's default args with any custom args passed in
const args = { ...storyArgs, ...${argsJson} };

// Create the story element - Storybook stories can define rendering in two ways:
// 1. A render() function that receives args and context
// 2. A component reference in meta.component
let element;
if (Story?.render) {
  // Story has custom render function - call it with args and minimal context
  const RenderComponent = () => Story.render(args, { loaded: {}, args });
  element = React.createElement(RenderComponent);
} else {
  // Story uses component from meta - render with merged args as props
  const Component = meta.component;
  element = React.createElement(Component, args);
}

// Wrap element with root component (theme provider, etc.) if specified
const Wrapper = ${wrapWithRoot};
const wrappedElement = React.createElement(Wrapper, ${wrapperProps}, element);

// Mount to DOM
const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');
const root = createRoot(rootEl);
root.render(wrappedElement);
`;
  }

  /**
   * Generate the HTML template for component preview.
   * @param entryFileName - Name of the entry file to include
   * @param darkMode - Whether to add dark mode class to HTML
   * @returns Generated HTML template string
   */
  private generateHtmlTemplate(entryFileName: string, darkMode: boolean): string {
    return `<!DOCTYPE html>
<html class="${darkMode ? 'dark' : ''}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Component Preview</title>
  <style>
    body { margin: 0; padding: 0; }
    #root { display: inline-block; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/${entryFileName}"></script>
</body>
</html>`;
  }

  private async buildComponent(options: BuildOptions): Promise<string> {
    const { appPath, darkMode, tmpDir, cssFiles = [] } = options;
    const timestamp = Date.now();

    try {
      // Write wrapper CSS with @source directive for Tailwind v4 content scanning
      const wrapperCssPath = path.join(tmpDir, 'tailwind-wrapper.css');
      const wrapperCssContent = this.generateWrapperCss(appPath, cssFiles);
      await fs.writeFile(wrapperCssPath, wrapperCssContent, 'utf-8');

      // Use a unique ID for the virtual module in this build
      const storyId = `build-${timestamp}`;
      const virtualModuleId = `@virtual:story-entry?id=${storyId}`;

      // Create a temporary HTML file that points to the virtual module
      // We still need a physical HTML file as the input for Vite's build.rollupOptions.input
      const htmlTemplate = this.generateHtmlTemplate(virtualModuleId, darkMode);
      const htmlTemplateFileName = `index-${timestamp}.html`;
      const htmlTemplatePath = path.join(tmpDir, htmlTemplateFileName);
      await fs.writeFile(htmlTemplatePath, htmlTemplate, 'utf-8');

      const { build } = await import('vite');
      const outDir = path.join(tmpDir, `dist-${timestamp}`);

      // Create a map for this specific build
      const buildStoryConfigs = new Map<string, BuildOptions>();
      buildStoryConfigs.set(storyId, options);

      await build({
        root: tmpDir,
        base: './',
        configFile: false,
        plugins: [
          tailwindcss(),
          viteSingleFile(),
          createStoryEntryPlugin(
            (id) => buildStoryConfigs.get(id),
            (opts) => this.generateEntryFile(opts),
          ),
        ],
        resolve: {
          alias: {
            '@': path.join(appPath, 'src'),
          },
        },
        esbuild: {
          jsx: 'automatic',
          jsxImportSource: 'react',
        },
        build: {
          outDir,
          emptyOutDir: false,
          cssCodeSplit: false,
          rollupOptions: {
            input: htmlTemplatePath,
            output: {
              inlineDynamicImports: true,
            },
          },
        },
      });

      const builtHtmlPath = path.join(outDir, htmlTemplateFileName);
      log.info(`[ViteReactBundlerService] Component built to: ${builtHtmlPath}`);

      // Clean up the input HTML file - non-critical, log debug on failure
      await fs.unlink(htmlTemplatePath).catch((err) => log.debug(`[ViteReactBundlerService] Failed to cleanup temp file: ${err.message}`));

      return builtHtmlPath;
    } catch (error) {
      const err = new Error(
        `Failed to build component: ${error instanceof Error ? error.message : String(error)}`,
      );
      err.cause = error;
      throw err;
    }
  }
}
