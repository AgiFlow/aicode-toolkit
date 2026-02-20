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
import type { DesignSystemConfig } from '../../config';
import type { AvailableThemesResult, ThemeInfo } from './types';

/**
 * ThemeService handles theme configuration and CSS generation.
 *
 * Provides methods for accessing theme CSS, generating theme wrappers,
 * and listing available theme configurations.
 *
 * @example
 * ```typescript
 * const service = new ThemeService(designConfig);
 * const cssFiles = await service.getThemeCSS();
 * const themes = await service.listAvailableThemes();
 * ```
 */
export class ThemeService {
  private monorepoRoot: string;
  private config: DesignSystemConfig;

  /**
   * Creates a new ThemeService instance
   * @param config - Design system configuration
   */
  constructor(config: DesignSystemConfig) {
    this.monorepoRoot = TemplatesManagerService.getWorkspaceRootSync();
    this.config = config;

    log.info(`[ThemeService] Using theme provider: ${this.config.themeProvider}`);
    log.info(`[ThemeService] Design system type: ${this.config.type}`);
  }

  /**
   * Get design system configuration
   * @returns Current design system configuration
   */
  getConfig(): DesignSystemConfig {
    return this.config;
  }

  /**
   * Get theme CSS imports from config or common locations
   * @returns Array of absolute paths to CSS files
   */
  async getThemeCSS(): Promise<string[]> {
    // If CSS files are specified in config, use those
    if (this.config.cssFiles && this.config.cssFiles.length > 0) {
      return this.config.cssFiles.map((cssFile) =>
        path.isAbsolute(cssFile) ? cssFile : path.join(this.monorepoRoot, cssFile),
      );
    }

    // Otherwise, search for common CSS locations
    const cssPatterns = [
      '**/packages/frontend/web-theme/src/**/*.css',
      '**/packages/frontend/shared-theme/**/*.css',
    ];

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
   * @param componentCode - Component code to wrap
   * @param darkMode - Whether to use dark mode theme
   * @returns Generated wrapper code string
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
   * @param darkMode - Whether to use dark mode styles
   * @returns Combined CSS content as string
   */
  async getInlineStyles(darkMode = false): Promise<string> {
    const cssFiles = await this.getThemeCSS();

    // Read all CSS files in parallel for better performance
    const contents = await Promise.all(
      cssFiles.map(async (cssFile) => {
        try {
          return await fs.readFile(cssFile, 'utf-8');
        } catch (error) {
          log.warn(`[ThemeService] Could not read CSS file ${cssFile}:`, error);
          return '';
        }
      }),
    );

    let styles = contents.filter(Boolean).join('\n');

    // Add dark mode class wrapper if needed
    if (darkMode && styles) {
      styles = `.dark { ${styles} }`;
    }

    return styles;
  }

  /**
   * Get Tailwind CSS classes for theming
   * @param darkMode - Whether to use dark mode classes
   * @returns Array of Tailwind class names
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
   * @returns True if theme provider is valid
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
   * @returns Object containing themes array and active brand
   * @throws Error if themes directory cannot be read
   */
  async listAvailableThemes(): Promise<AvailableThemesResult> {
    const configsPath = path.join(this.monorepoRoot, 'packages/frontend/shared-theme/configs');

    try {
      const files = await fs.readdir(configsPath);
      const themeFiles = files.filter((file) => file.endsWith('.json'));

      const themes: ThemeInfo[] = [];
      let activeBrand: string | undefined;

      // Process all theme files in parallel
      const results = await Promise.allSettled(
        themeFiles.map(async (file) => {
          const filePath = path.join(configsPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const themeData = JSON.parse(content);
          const themeName = file.replace('.json', '');
          return {
            name: themeName,
            fileName: file,
            path: filePath,
            colors: themeData.colors || themeData,
          };
        }),
      );
      for (const [index, result] of results.entries()) {
        if (result.status === 'fulfilled') {
          themes.push(result.value);
          // Check if this is the active theme based on common patterns
          if (result.value.name === 'lightTheme' || result.value.name === 'agimonTheme') {
            activeBrand = result.value.name;
          }
        } else {
          log.warn(
            `[ThemeService] Failed to process theme file ${themeFiles[index]}:`,
            result.reason,
          );
        }
      }

      return {
        themes: themes.sort((a, b) => a.name.localeCompare(b.name)),
        activeBrand,
      };
    } catch (error) {
      throw new Error(
        `Failed to list themes: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
