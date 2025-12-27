/**
 * ComponentRendererService
 *
 * DESIGN PATTERNS:
 * - Service pattern for business logic encapsulation
 * - Service composition (uses BundlerService and ThemeService)
 * - Dependency injection for bundler service (allows custom implementations)
 * - HTML template generation with theme provider wrapping
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
import os from 'node:os';
import path from 'node:path';
import { log, TemplatesManagerService } from '@agiflowai/aicode-utils';
import type { DesignSystemConfig } from '../../config';
import { takeScreenshot } from '../../utils/screenshot';
import type { BaseBundlerService } from '../BundlerService';
import { createDefaultBundlerService } from '../BundlerService';
import type { ComponentInfo } from '../StoriesIndexService';
import { ThemeService } from '../ThemeService';
import type { BundlerFactory, RenderOptions, RenderResult } from './types';

/**
 * ComponentRendererService handles rendering React components to images.
 *
 * Uses BundlerService for building/serving components and ThemeService
 * for theme configuration. Supports both dev server (fast) and static
 * build (fallback) rendering modes.
 *
 * The bundler service can be customized by providing a bundlerFactory
 * to support different bundlers (Vite, Webpack) and frameworks (React, Vue).
 *
 * @example
 * ```typescript
 * // Using default bundler (Vite + React)
 * const service = new ComponentRendererService(designConfig, 'apps/my-app');
 *
 * // Using custom bundler
 * const service = new ComponentRendererService(
 *   designConfig,
 *   'apps/my-app',
 *   { bundlerFactory: () => new MyCustomBundlerService() }
 * );
 *
 * const result = await service.renderComponent(componentInfo, {
 *   storyName: 'Primary',
 *   darkMode: true,
 *   width: 1280,
 *   height: 800
 * });
 * console.log(result.imagePath);
 * ```
 */
export class ComponentRendererService {
  private monorepoRoot: string;
  private tmpDir: string;
  private themeService: ThemeService;
  private appPath: string;
  private bundlerFactory: BundlerFactory;

  /**
   * Creates a new ComponentRendererService instance
   * @param designSystemConfig - Design system configuration
   * @param appPath - Path to the app directory (relative or absolute)
   * @param options - Optional configuration including custom bundler factory
   */
  constructor(
    designSystemConfig: DesignSystemConfig,
    appPath: string,
    options: { bundlerFactory?: BundlerFactory } = {},
  ) {
    if (!appPath) {
      throw new Error('appPath is required for ComponentRendererService');
    }
    this.monorepoRoot = TemplatesManagerService.getWorkspaceRootSync();
    this.appPath = appPath;
    // Use OS temp directory for screenshots (e.g., /tmp on Unix, %TEMP% on Windows)
    this.tmpDir = path.join(os.tmpdir(), 'style-system');
    this.themeService = new ThemeService(designSystemConfig);
    // Use provided bundler factory or default to ViteReactBundlerService
    this.bundlerFactory = options.bundlerFactory ?? createDefaultBundlerService;
  }

  /**
   * Get the bundler service instance.
   * Uses the factory to create/retrieve the bundler.
   * @returns The bundler service instance
   */
  private getBundlerService(): BaseBundlerService {
    return this.bundlerFactory();
  }

  /**
   * Render a component to an image
   * @param componentInfo - Component metadata from StoriesIndexService
   * @param options - Render options (story name, args, dimensions, etc.)
   * @returns Rendered image path, HTML content, and component info
   * @throws Error if rendering fails
   */
  async renderComponent(componentInfo: ComponentInfo, options: RenderOptions = {}): Promise<RenderResult> {
    const {
      storyName = componentInfo.stories[0] || 'Default',
      args = {},
      darkMode = false,
      width = 1280,
      height = 800,
    } = options;

    try {
      log.info(`[ComponentRendererService] Rendering ${componentInfo.title} - ${storyName}`);

      // Ensure tmp directory exists
      await fs.mkdir(this.tmpDir, { recursive: true });

      // Get theme configuration
      const designSystemConfig = this.themeService.getConfig();
      log.info(`[ComponentRendererService] Using theme provider: ${designSystemConfig.themeProvider}`);
      log.info(`[ComponentRendererService] Design system type: ${designSystemConfig.type}`);

      // Validate theme provider
      const isValid = await this.themeService.validateThemeProvider();
      if (!isValid) {
        log.warn(`[ComponentRendererService] Theme provider path may not exist: ${designSystemConfig.themeProvider}`);
      }

      // Get the bundler service instance via factory
      // Note: Factory is expected to return a singleton instance for dev server management
      const bundlerService = this.getBundlerService();

      let componentUrl: string;
      let htmlFilePath: string | undefined;

      // Check if dev server is running and use it for faster rendering
      if (bundlerService.isServerRunning()) {
        log.info('[ComponentRendererService] Using dev server for fast rendering');

        try {
          const result = await bundlerService.serveComponent({
            componentPath: componentInfo.filePath,
            storyName,
            args,
            themePath: designSystemConfig.themeProvider,
            darkMode,
            appPath: this.appPath,
            cssFiles: designSystemConfig.cssFiles || [],
            rootComponent: designSystemConfig.rootComponent,
          });

          componentUrl = result.url;
          htmlFilePath = result.htmlFilePath;
          log.info(`[ComponentRendererService] Component served at: ${componentUrl}`);
        } catch (devServerError) {
          // Fall back to static build if dev server fails
          log.warn(
            `[ComponentRendererService] Dev server failed, falling back to static build: ${devServerError instanceof Error ? devServerError.message : String(devServerError)}`,
          );

          const result = await bundlerService.prerenderComponent({
            componentPath: componentInfo.filePath,
            storyName,
            args,
            themePath: designSystemConfig.themeProvider,
            darkMode,
            appPath: this.appPath,
            cssFiles: designSystemConfig.cssFiles || [],
            rootComponent: designSystemConfig.rootComponent,
          });

          componentUrl = `file://${result.htmlFilePath}`;
          htmlFilePath = result.htmlFilePath;
          log.info(`[ComponentRendererService] HTML built to: ${htmlFilePath}`);
        }
      } else {
        // No dev server running, use static build
        log.info('[ComponentRendererService] No dev server running, using static build');

        const result = await bundlerService.prerenderComponent({
          componentPath: componentInfo.filePath,
          storyName,
          args,
          themePath: designSystemConfig.themeProvider,
          darkMode,
          appPath: this.appPath,
          cssFiles: designSystemConfig.cssFiles || [],
          rootComponent: designSystemConfig.rootComponent,
        });

        componentUrl = `file://${result.htmlFilePath}`;
        htmlFilePath = result.htmlFilePath;
        log.info(`[ComponentRendererService] HTML built to: ${htmlFilePath}`);
      }

      // Render to image using browser-screenshot
      const timestamp = Date.now();
      const imageName = `component-${componentInfo.title.split('/').pop()}-${timestamp}.png`;
      const imagePath = path.join(this.tmpDir, imageName);

      await takeScreenshot({
        url: componentUrl,
        output: imagePath,
        width,
        height,
        fullPage: true, // Capture full page without selector
        browser: 'chromium',
        waitTime: 2000,
        darkMode,
        mobile: false,
        generateThumbnail: true,
        thumbnailWidth: 900,
        thumbnailQuality: 80,
        base64: false,
      });

      log.info(`[ComponentRendererService] Screenshot saved to: ${imagePath}`);

      // Read HTML content for return
      let html = '';
      if (htmlFilePath) {
        html = await fs.readFile(htmlFilePath, 'utf-8');
        log.info(`[ComponentRendererService] HTML file kept at: ${htmlFilePath}`);
      } else {
        log.warn('[ComponentRendererService] No HTML file path available, returning empty HTML content');
      }

      return {
        imagePath,
        html,
        componentInfo,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to render component ${componentInfo.title} (${storyName}): ${errorMessage}`,
      );
    }
  }

  /**
   * Maximum number of screenshot files to keep in temp directory.
   * Prevents disk space issues on long-running servers.
   */
  private static readonly MAX_TEMP_FILES = 100;

  /**
   * Clean up old rendered files.
   * Removes files older than the specified duration and enforces a max file count.
   * @param olderThanMs - Remove files older than this duration (default: 1 hour)
   */
  async cleanup(olderThanMs: number = 3600000): Promise<void> {
    try {
      const files = await fs.readdir(this.tmpDir);
      const now = Date.now();
      const componentFiles: Array<{ name: string; path: string; mtime: number }> = [];

      // Collect component files with their modification times in parallel
      const componentFileNames = files.filter((f) => f.startsWith('component-'));
      const statResults = await Promise.allSettled(
        componentFileNames.map(async (file) => {
          const filePath = path.join(this.tmpDir, file);
          const stats = await fs.stat(filePath);
          return { name: file, path: filePath, mtime: stats.mtimeMs };
        }),
      );
      for (const result of statResults) {
        if (result.status === 'fulfilled') {
          componentFiles.push(result.value);
        }
        // Silently skip files that may have been deleted
      }

      // Delete files older than threshold in parallel
      const oldFiles = componentFiles.filter((f) => now - f.mtime > olderThanMs);
      await Promise.all(
        oldFiles.map((file) =>
          fs.unlink(file.path).catch((err) => log.warn('[ComponentRendererService] Failed to delete file:', file.path, err)),
        ),
      );
      let deletedCount = oldFiles.length;

      // Enforce max file count by removing oldest files
      const remainingFiles = componentFiles.filter((f) => now - f.mtime <= olderThanMs);
      if (remainingFiles.length > ComponentRendererService.MAX_TEMP_FILES) {
        // Sort by mtime ascending (oldest first)
        remainingFiles.sort((a, b) => a.mtime - b.mtime);
        const toDelete = remainingFiles.slice(0, remainingFiles.length - ComponentRendererService.MAX_TEMP_FILES);

        // Delete excess files in parallel
        await Promise.all(
          toDelete.map((file) =>
            fs.unlink(file.path).catch((err) => log.warn('[ComponentRendererService] Failed to delete file:', file.path, err)),
          ),
        );
        deletedCount += toDelete.length;
      }

      if (deletedCount > 0) {
        log.info(`[ComponentRendererService] Cleaned up ${deletedCount} temp files`);
      }
    } catch (error) {
      log.error('[ComponentRendererService] Cleanup error:', error);
    }
  }

  /**
   * Cleanup bundler server and temp files.
   * Called on service shutdown.
   */
  async dispose(): Promise<void> {
    try {
      // Clean up temp files on dispose
      await this.cleanup(0); // Remove all temp files

      const bundlerService = this.getBundlerService();

      // Only cleanup if it's a static build server (not the shared dev server)
      // The shared dev server should persist across component renders
      if (!bundlerService.isServerRunning()) {
        await bundlerService.cleanup();
      }
    } catch (error) {
      log.error('[ComponentRendererService] Dispose error:', error);
    }
  }
}
