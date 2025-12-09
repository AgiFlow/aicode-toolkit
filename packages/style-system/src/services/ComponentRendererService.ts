/**
 * ComponentRendererService
 *
 * DESIGN PATTERNS:
 * - Service pattern for business logic encapsulation
 * - Service composition (uses VitejsService and ThemeService)
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
import path from 'node:path';
import { log, TemplatesManagerService } from '@agiflowai/aicode-utils';
import type { DesignSystemConfig } from '../config.js';
import type { ComponentInfo } from './StoriesIndexService.js';
import { ThemeService } from './ThemeService.js';
import { VitejsService } from './VitejsService.js';
import { takeScreenshot } from '../utils/screenshot.js';

export interface RenderOptions {
  storyName?: string;
  args?: Record<string, any>;
  darkMode?: boolean;
  width?: number;
  height?: number;
}

export interface RenderResult {
  imagePath: string;
  html: string;
  componentInfo: ComponentInfo;
}

export class ComponentRendererService {
  private monorepoRoot: string;
  private tmpDir: string;
  private themeService: ThemeService;
  private appPath: string;

  constructor(designSystemConfig: DesignSystemConfig, appPath: string) {
    this.monorepoRoot = TemplatesManagerService.getWorkspaceRootSync();
    this.appPath = appPath;
    const resolvedAppPath = path.isAbsolute(appPath) ? appPath : path.join(this.monorepoRoot, appPath);
    this.tmpDir = path.join(resolvedAppPath, '.tmp');
    this.themeService = new ThemeService(designSystemConfig);
  }

  /**
   * Render a component to an image
   */
  async renderComponent(componentInfo: ComponentInfo, options: RenderOptions = {}): Promise<RenderResult> {
    const {
      storyName = componentInfo.stories[0] || 'Default',
      args = {},
      darkMode = false,
      width = 1280,
      height = 800,
    } = options;

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

    // Get the singleton VitejsService instance
    const vitejsService = VitejsService.getInstance();

    let componentUrl: string;
    let htmlFilePath: string;

    // Check if dev server is running and use it for faster rendering
    if (vitejsService.isServerRunning()) {
      log.info('[ComponentRendererService] Using dev server for fast rendering');

      try {
        const result = await vitejsService.serveComponent({
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

        const result = await vitejsService.prerenderComponent({
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

      const result = await vitejsService.prerenderComponent({
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
    const html = await fs.readFile(htmlFilePath, 'utf-8');

    // Keep HTML file for debugging
    log.info(`[ComponentRendererService] HTML file kept at: ${htmlFilePath}`);

    return {
      imagePath,
      html,
      componentInfo,
    };
  }

  /**
   * Clean up old rendered files
   */
  async cleanup(olderThanMs: number = 3600000): Promise<void> {
    try {
      const files = await fs.readdir(this.tmpDir);
      const now = Date.now();

      for (const file of files) {
        if (file.startsWith('component-')) {
          const filePath = path.join(this.tmpDir, file);
          const stats = await fs.stat(filePath);

          if (now - stats.mtimeMs > olderThanMs) {
            await fs.unlink(filePath).catch(() => {});
          }
        }
      }
    } catch (error) {
      log.error('[ComponentRendererService] Cleanup error:', error);
    }
  }

  /**
   * Cleanup Vite server (only if not using shared dev server)
   */
  async dispose(): Promise<void> {
    const vitejsService = VitejsService.getInstance();

    // Only cleanup if it's a static build server (not the shared dev server)
    // The shared dev server should persist across component renders
    if (!vitejsService.isServerRunning()) {
      await vitejsService.cleanup();
    }
  }
}
