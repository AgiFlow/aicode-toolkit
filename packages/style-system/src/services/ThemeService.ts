/**
 * ThemeService
 *
 * DESIGN PATTERNS:
 * - Service pattern for business logic encapsulation
 * - App-specific theme configuration from project.json
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
import { glob } from 'glob';
import type { DesignSystemConfig } from '../config.js';

export class ThemeService {
  private monorepoRoot: string;
  private config: DesignSystemConfig;

  constructor(config: DesignSystemConfig) {
    this.monorepoRoot = TemplatesManagerService.getWorkspaceRootSync();
    this.config = config;

    log.info(`[ThemeService] Using theme provider: ${this.config.themeProvider}`);
    log.info(`[ThemeService] Design system type: ${this.config.type}`);
  }

  /**
   * Get design system configuration
   */
  getConfig(): DesignSystemConfig {
    return this.config;
  }

  /**
   * Get theme CSS imports from config or common locations
   */
  async getThemeCSS(): Promise<string[]> {
    // If CSS files are specified in config, use those
    if (this.config.cssFiles && this.config.cssFiles.length > 0) {
      return this.config.cssFiles.map((cssFile) =>
        path.isAbsolute(cssFile) ? cssFile : path.join(this.monorepoRoot, cssFile),
      );
    }

    // Otherwise, search for common CSS locations
    const cssPatterns = ['**/packages/frontend/web-theme/src/**/*.css', '**/packages/frontend/shared-theme/**/*.css'];

    const cssFiles: string[] = [];

    for (const pattern of cssPatterns) {
      const files = await glob(pattern, {
        cwd: this.monorepoRoot,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**'],
      });
      cssFiles.push(...files);
    }

    return cssFiles;
  }

  /**
   * Generate theme provider wrapper code
   * Uses default export as specified in config
   */
  generateThemeWrapper(componentCode: string, darkMode = false): string {
    const { themeProvider } = this.config;

    return `
import React from 'react';
import ThemeProvider from '${themeProvider}';

const WrappedComponent = () => {
  return React.createElement(
    ThemeProvider,
    { theme: ${darkMode ? "'dark'" : "'light'"} },
    ${componentCode}
  );
};

export default WrappedComponent;
    `.trim();
  }

  /**
   * Get inline theme styles for SSR
   */
  async getInlineStyles(darkMode = false): Promise<string> {
    const cssFiles = await this.getThemeCSS();

    let styles = '';
    for (const cssFile of cssFiles) {
      try {
        const content = await fs.readFile(cssFile, 'utf-8');
        styles += content + '\n';
      } catch (error) {
        log.warn(`[ThemeService] Could not read CSS file ${cssFile}:`, error);
      }
    }

    // Add dark mode class wrapper if needed
    if (darkMode && styles) {
      styles = `.dark { ${styles} }`;
    }

    return styles;
  }

  /**
   * Get Tailwind CSS classes for theming
   */
  getTailwindClasses(darkMode = false): string[] {
    const baseClasses = ['font-sans', 'antialiased'];

    if (darkMode) {
      return [...baseClasses, 'dark', 'bg-gray-900', 'text-white'];
    }

    return [...baseClasses, 'bg-white', 'text-gray-900'];
  }

  /**
   * Validate that the theme provider path exists
   */
  async validateThemeProvider(): Promise<boolean> {
    try {
      // If it's a node_modules import (starts with @), assume it's valid
      if (this.config.themeProvider.startsWith('@') || !this.config.themeProvider.startsWith('/')) {
        return true;
      }

      // Check if file exists
      const stats = await fs.stat(this.config.themeProvider);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * List all available theme configurations
   */
  async listAvailableThemes(): Promise<{
    themes: Array<{
      name: string;
      fileName: string;
      path: string;
      colors?: Record<string, string>;
    }>;
    activeBrand?: string;
  }> {
    const configsPath = path.join(this.monorepoRoot, 'packages/frontend/shared-theme/configs');

    try {
      const files = await fs.readdir(configsPath);
      const themeFiles = files.filter((file) => file.endsWith('.json'));

      const themes: Array<{
        name: string;
        fileName: string;
        path: string;
        colors?: Record<string, string>;
      }> = [];
      let activeBrand: string | undefined;

      for (const file of themeFiles) {
        const filePath = path.join(configsPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const themeData = JSON.parse(content);

        const themeName = file.replace('.json', '');

        themes.push({
          name: themeName,
          fileName: file,
          path: filePath,
          colors: themeData.colors || themeData,
        });

        // Check if this is the active theme based on common patterns
        if (themeName === 'lightTheme' || themeName === 'agimonTheme') {
          activeBrand = themeName;
        }
      }

      return {
        themes: themes.sort((a, b) => a.name.localeCompare(b.name)),
        activeBrand,
      };
    } catch (error) {
      throw new Error(`Failed to list themes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
