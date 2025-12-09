/**
 * VitejsService
 *
 * DESIGN PATTERNS:
 * - Service pattern for business logic encapsulation
 * - Programmatic Vite build for component SSR
 *
 * CODING STANDARDS:
 * - Use async/await for asynchronous operations
 * - Throw descriptive errors for error cases
 * - Keep methods focused and well-named
 * - Document complex logic with comments
 *
 * AVOID:
 * - Mixing concerns (keep focused on single domain)
 * - Direct tool implementation (services should be tool-agnostic)
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { log, TemplatesManagerService } from '@agiflowai/aicode-utils';
import tailwindcss from '@tailwindcss/vite';
import type { ViteDevServer } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export interface PreRenderOptions {
  componentPath: string;
  storyName: string;
  args?: Record<string, any>;
  themePath?: string;
  darkMode?: boolean;
  appPath: string;
  cssFiles?: string[];
  rootComponent?: string;
}

export class VitejsService {
  private static instance: VitejsService | null = null;

  private server: ViteDevServer | null = null;
  private monorepoRoot: string;
  private serverUrl: string | null = null;
  private serverPort: number | null = null;
  private currentAppPath: string | null = null;

  private constructor() {
    this.monorepoRoot = TemplatesManagerService.getWorkspaceRootSync();
  }

  /**
   * Get the singleton instance of VitejsService
   */
  static getInstance(): VitejsService {
    if (!VitejsService.instance) {
      VitejsService.instance = new VitejsService();
    }
    return VitejsService.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    VitejsService.instance = null;
  }

  getServerUrl(): string | null {
    return this.serverUrl;
  }

  getServerPort(): number | null {
    return this.serverPort;
  }

  isServerRunning(): boolean {
    return this.server !== null && this.serverUrl !== null;
  }

  getCurrentAppPath(): string | null {
    return this.currentAppPath;
  }

  /**
   * Start a Vite dev server for hot reload and caching
   *
   * @param appPath - Absolute or relative path to the app directory
   * @returns Promise resolving to server URL and port
   * @throws Error if server fails to start or port cannot be determined
   *
   * @example
   * ```typescript
   * const service = new VitejsService();
   * const { url, port } = await service.startDevServer('apps/agiflow-app');
   * console.log(`Server running at ${url}`);
   * ```
   */
  async startDevServer(appPath: string): Promise<{ url: string; port: number }> {
    const resolvedAppPath = path.isAbsolute(appPath) ? appPath : path.join(this.monorepoRoot, appPath);
    const tmpDir = path.join(resolvedAppPath, '.tmp');

    // Ensure tmp directory exists
    await fs.mkdir(tmpDir, { recursive: true });

    const { createServer } = await import('vite');

    this.server = await createServer({
      root: tmpDir,
      base: './',
      configFile: false,
      plugins: [tailwindcss()],
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
        strictPort: false, // Allow Vite to find an available port
        open: false,
      },
    });

    await this.server.listen();

    const address = this.server.httpServer?.address();
    if (!address || typeof address === 'string') {
      throw new Error(
        'Failed to start Vite dev server. Ensure no other process is using the port or check if the app path is valid.',
      );
    }

    const port = address.port;
    const url = `http://localhost:${port}`;
    this.serverUrl = url;
    this.serverPort = port;
    this.currentAppPath = resolvedAppPath;

    log.info(`[VitejsService] Vite dev server started at ${url}`);
    log.info(`[VitejsService] Serving app: ${resolvedAppPath}`);

    return { url, port };
  }

  /**
   * Serve a component dynamically through the dev server
   *
   * @param options - Component rendering options
   * @returns Promise resolving to the component URL and HTML file path
   * @throws Error if dev server is not running
   *
   * @example
   * ```typescript
   * const service = VitejsService.getInstance();
   * await service.startDevServer('apps/agiflow-app');
   * const { url } = await service.serveComponent({
   *   componentPath: 'packages/frontend/web-ui/src/Button.stories.tsx',
   *   storyName: 'Playground',
   *   appPath: 'apps/agiflow-app'
   * });
   * // Use url for screenshot: http://localhost:5173/entry-123456.html
   * ```
   */
  async serveComponent(options: PreRenderOptions): Promise<{ url: string; htmlFilePath: string }> {
    if (!this.isServerRunning()) {
      throw new Error(
        'Dev server is not running. Start the dev server first using startDevServer() or fall back to prerenderComponent().',
      );
    }

    const { componentPath, storyName, args = {}, darkMode = false, appPath, cssFiles = [], rootComponent } = options;

    // Resolve app path
    const resolvedAppPath = path.isAbsolute(appPath) ? appPath : path.join(this.monorepoRoot, appPath);

    // Verify we're serving the same app
    if (this.currentAppPath !== resolvedAppPath) {
      throw new Error(
        `Dev server is running for ${this.currentAppPath} but component requested for ${resolvedAppPath}. Restart the dev server with the correct app path.`,
      );
    }

    const tmpDir = path.join(resolvedAppPath, '.tmp');

    // Ensure tmp directory exists
    await fs.mkdir(tmpDir, { recursive: true });

    const timestamp = Date.now();
    const entryFileName = `entry-${timestamp}.tsx`;
    const entryFilePath = path.join(tmpDir, entryFileName);

    const argsJson = JSON.stringify(args, null, 2);

    // Generate CSS imports
    const cssImports = cssFiles
      .map((cssFile) => {
        if (cssFile.startsWith('@') || cssFile.startsWith('tailwindcss/')) {
          return `import '${cssFile}';`;
        }
        if (cssFile.startsWith('packages/')) {
          return `import '${path.join(this.monorepoRoot, cssFile)}';`;
        }
        return `import '${path.join(resolvedAppPath, cssFile)}';`;
      })
      .join('\n');

    const rootComponentImport = rootComponent
      ? `import { RootDocument } from '${path.join(resolvedAppPath, rootComponent).replace(/\\/g, '/')}';`
      : '';

    const wrapWithRoot = rootComponent ? 'RootDocument' : 'React.Fragment';
    const wrapperProps = rootComponent ? `{ darkMode: ${darkMode} }` : '{}';

    // Entry file content
    const entryContent = `${cssImports}

import React from 'react';
import { createRoot } from 'react-dom/client';
import * as Stories from '${componentPath}';
${rootComponentImport}

const meta = Stories.default;
const Story = Stories['${storyName}'];
const storyArgs = Story?.args || {};
const args = { ...storyArgs, ...${argsJson} };

let element;
if (Story?.render) {
  const RenderComponent = () => Story.render(args, { loaded: {}, args });
  element = React.createElement(RenderComponent);
} else {
  const Component = meta.component;
  element = React.createElement(Component, args);
}

const Wrapper = ${wrapWithRoot};
const wrappedElement = React.createElement(Wrapper, ${wrapperProps}, element);

const root = createRoot(document.getElementById('root')!);
root.render(wrappedElement);
`;

    // Write entry file
    await fs.writeFile(entryFilePath, entryContent, 'utf-8');

    // Create index.html template
    const htmlTemplate = `<!DOCTYPE html>
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

    const htmlTemplateFileName = `entry-${timestamp}.html`;
    const htmlTemplatePath = path.join(tmpDir, htmlTemplateFileName);
    await fs.writeFile(htmlTemplatePath, htmlTemplate, 'utf-8');

    // Return the dev server URL for this component
    const url = `${this.serverUrl}/${htmlTemplateFileName}`;

    log.info(`[VitejsService] Component served at: ${url}`);

    return { url, htmlFilePath: htmlTemplatePath };
  }

  /**
   * Build a component to a static HTML file using Vite
   */
  async prerenderComponent(options: PreRenderOptions): Promise<{ htmlFilePath: string }> {
    const { componentPath, storyName, args = {}, darkMode = false, appPath, cssFiles = [], rootComponent } = options;

    // Resolve app path
    const resolvedAppPath = path.isAbsolute(appPath) ? appPath : path.join(this.monorepoRoot, appPath);
    const tmpDir = path.join(resolvedAppPath, '.tmp');

    // Ensure tmp directory exists
    await fs.mkdir(tmpDir, { recursive: true });

    // Build the component to a static bundle
    const htmlFilePath = await this.buildComponent({
      componentPath,
      storyName,
      args,
      appPath: resolvedAppPath,
      darkMode,
      cssFiles,
      rootComponent,
      tmpDir,
    });

    return { htmlFilePath };
  }

  /**
   * Build a component to a static HTML file using Vite build
   */
  private async buildComponent(options: {
    componentPath: string;
    storyName: string;
    args: Record<string, any>;
    appPath: string;
    darkMode: boolean;
    cssFiles: string[];
    rootComponent?: string;
    tmpDir: string;
  }): Promise<string> {
    const { componentPath, storyName, args, appPath, darkMode, cssFiles, rootComponent, tmpDir } = options;
    const timestamp = Date.now();

    // Create entry file for the component
    const entryFileName = `entry-${timestamp}.tsx`;
    const entryFilePath = path.join(tmpDir, entryFileName);

    const argsJson = JSON.stringify(args, null, 2);

    // Generate CSS imports
    const cssImports = cssFiles
      .map((cssFile) => {
        if (cssFile.startsWith('@') || cssFile.startsWith('tailwindcss/')) {
          return `import '${cssFile}';`;
        }
        if (cssFile.startsWith('packages/')) {
          return `import '${path.join(this.monorepoRoot, cssFile)}';`;
        }
        return `import '${path.join(appPath, cssFile)}';`;
      })
      .join('\n');

    const rootComponentImport = rootComponent
      ? `import { RootDocument } from '${path.join(appPath, rootComponent).replace(/\\/g, '/')}';`
      : '';

    const wrapWithRoot = rootComponent ? 'RootDocument' : 'React.Fragment';
    const wrapperProps = rootComponent ? `{ darkMode: ${darkMode} }` : '{}';

    // Entry file content
    const entryContent = `${cssImports}

import React from 'react';
import { createRoot } from 'react-dom/client';
import * as Stories from '${componentPath}';
${rootComponentImport}

const meta = Stories.default;
const Story = Stories['${storyName}'];
const storyArgs = Story?.args || {};
const args = { ...storyArgs, ...${argsJson} };

let element;
if (Story?.render) {
  const RenderComponent = () => Story.render(args, { loaded: {}, args });
  element = React.createElement(RenderComponent);
} else {
  const Component = meta.component;
  element = React.createElement(Component, args);
}

const Wrapper = ${wrapWithRoot};
const wrappedElement = React.createElement(Wrapper, ${wrapperProps}, element);

const root = createRoot(document.getElementById('root')!);
root.render(wrappedElement);
`;

    // Write entry file
    await fs.writeFile(entryFilePath, entryContent, 'utf-8');

    // Create index.html template
    const htmlTemplate = `<!DOCTYPE html>
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

    const htmlTemplateFileName = `index-${timestamp}.html`;
    const htmlTemplatePath = path.join(tmpDir, htmlTemplateFileName);
    await fs.writeFile(htmlTemplatePath, htmlTemplate, 'utf-8');

    // Build with Vite using viteSingleFile plugin to inline everything
    const { build } = await import('vite');
    const outDir = path.join(tmpDir, `dist-${timestamp}`);

    await build({
      root: tmpDir,
      base: './',
      configFile: false,
      plugins: [tailwindcss(), viteSingleFile()],
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

    // The plugin creates a single inlined HTML file
    const builtHtmlPath = path.join(outDir, htmlTemplateFileName);
    log.info(`[VitejsService] Component built to: ${builtHtmlPath}`);

    // Clean up temporary entry and template files (keep the built HTML)
    await fs.unlink(entryFilePath).catch((err) => {
      log.warn(`[VitejsService] Failed to clean up entry file: ${err.message}`);
    });
    await fs.unlink(htmlTemplatePath).catch((err) => {
      log.warn(`[VitejsService] Failed to clean up template file: ${err.message}`);
    });

    return builtHtmlPath;
  }

  /**
   * Clean up Vite server
   */
  async cleanup(): Promise<void> {
    if (this.server) {
      log.info('[VitejsService] Closing Vite dev server...');
      await this.server.close();
      this.server = null;
      this.serverUrl = null;
      this.serverPort = null;
      this.currentAppPath = null;
      log.info('[VitejsService] Vite dev server closed');
    }
  }
}
