/**
 * CSSThemeService
 *
 * DESIGN PATTERNS:
 * - Extends BaseThemeService for CSS-based theme extraction
 * - Uses postcss AST parser for robust CSS parsing
 * - Extracts theme names from CSS class selectors
 *
 * CODING STANDARDS:
 * - Implement abstract methods from base class
 * - Use async/await for file operations
 * - Throw descriptive errors with context
 *
 * AVOID:
 * - Hardcoding theme paths
 * - Synchronous file operations
 * - Fragile regex-based CSS parsing
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { log, TemplatesManagerService } from '@agiflowai/aicode-utils';
import postcss from 'postcss';
import { BaseThemeService } from './BaseThemeService';
import type { AvailableThemesResult, ThemeInfo, ThemeServiceConfig } from './types';

/**
 * CSS-based theme service implementation.
 *
 * Extracts themes from CSS files by parsing class selectors that contain
 * CSS custom properties (variables). Each top-level class selector with
 * color variables is treated as a theme.
 *
 * @example
 * ```typescript
 * const service = new CSSThemeService({ themePath: 'apps/my-app/src/styles/colors.css' });
 * const result = await service.listThemes();
 * console.log(result.themes); // [{ name: 'slate', ... }, { name: 'blue', ... }]
 * ```
 */
export class CSSThemeService extends BaseThemeService {
  private monorepoRoot: string;

  /**
   * Creates a new CSSThemeService instance
   * @param config - Theme service configuration with themePath or cssFiles
   */
  constructor(config: ThemeServiceConfig) {
    super(config);
    this.monorepoRoot = TemplatesManagerService.getWorkspaceRootSync();
  }

  /**
   * Get the source identifier for this service
   * @returns 'css-file' identifier
   */
  getSourceId(): 'css-file' {
    return 'css-file';
  }

  /**
   * List available themes by parsing CSS files.
   *
   * Scans the configured CSS files for class selectors that define
   * CSS custom properties (--color-*, etc.) and returns them as themes.
   *
   * @returns Promise resolving to available themes result
   * @throws Error if no theme files are configured or files cannot be read
   */
  async listThemes(): Promise<AvailableThemesResult> {
    const cssFilePaths = this.resolveCSSFilePaths();

    if (cssFilePaths.length === 0) {
      throw new Error(
        'No theme CSS files configured. Set themePath or cssFiles in project.json style-system config.',
      );
    }

    const themes: ThemeInfo[] = [];

    const results = await Promise.allSettled(
      cssFilePaths.map(async (cssFilePath) => {
        await this.validatePath(cssFilePath);
        return this.extractThemesFromCSS(cssFilePath);
      }),
    );
    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        themes.push(...result.value);
      } else {
        log.warn(`[CSSThemeService] Could not process ${cssFilePaths[index]}:`, result.reason);
      }
    }

    // Deduplicate themes by name
    const uniqueThemes = this.deduplicateThemes(themes);

    return {
      themes: uniqueThemes.sort((a, b) => a.name.localeCompare(b.name)),
      activeTheme: uniqueThemes.length > 0 ? uniqueThemes[0].name : undefined,
      source: 'css-file',
    };
  }

  /**
   * Resolve configured CSS file paths to absolute paths.
   * @returns Array of absolute CSS file paths
   */
  private resolveCSSFilePaths(): string[] {
    const paths: string[] = [];

    // Add themePath if configured
    if (this.config.themePath) {
      const themePath = path.isAbsolute(this.config.themePath)
        ? this.config.themePath
        : path.join(this.monorepoRoot, this.config.themePath);
      paths.push(themePath);
    }

    // Add cssFiles if configured
    if (this.config.cssFiles && this.config.cssFiles.length > 0) {
      for (const cssFile of this.config.cssFiles) {
        const cssPath = path.isAbsolute(cssFile) ? cssFile : path.join(this.monorepoRoot, cssFile);
        if (!paths.includes(cssPath)) {
          paths.push(cssPath);
        }
      }
    }

    return paths;
  }

  /**
   * Extract themes from a CSS file by parsing class selectors.
   *
   * Identifies class selectors that contain CSS custom property declarations
   * (--color-*, --primary-*, etc.) and treats each as a theme definition.
   *
   * @param cssFilePath - Absolute path to CSS file
   * @returns Array of ThemeInfo objects
   */
  private async extractThemesFromCSS(cssFilePath: string): Promise<ThemeInfo[]> {
    const content = await fs.readFile(cssFilePath, 'utf-8');
    const fileName = path.basename(cssFilePath);
    const themes: ThemeInfo[] = [];

    try {
      const root = postcss.parse(content);

      // Walk all rules looking for class selectors with color variables
      root.walkRules((rule) => {
        // Only process simple class selectors (e.g., .slate, .blue)
        const selector = rule.selector.trim();
        if (!selector.startsWith('.') || selector.includes(' ') || selector.includes(',')) {
          return;
        }

        // Extract class name (remove leading dot)
        const className = selector.slice(1);

        // Check if this rule has color-related custom properties
        const colorVariables: Record<string, string> = {};
        let hasColorVariables = false;

        rule.walkDecls((decl) => {
          if (decl.prop.startsWith('--color-') || decl.prop.startsWith('--primary-')) {
            colorVariables[decl.prop] = decl.value;
            hasColorVariables = true;
          }
        });

        // Only add as theme if it has color variables
        if (hasColorVariables) {
          themes.push({
            name: className,
            fileName,
            path: cssFilePath,
            colorVariables,
            shadeCount: Object.keys(colorVariables).length,
          });
        }
      });
    } catch (error) {
      throw new Error(
        `Failed to parse CSS file ${cssFilePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    log.info(`[CSSThemeService] Found ${themes.length} themes in ${fileName}`);
    return themes;
  }

  /**
   * Deduplicate themes by name, keeping the first occurrence.
   * @param themes - Array of themes to deduplicate
   * @returns Deduplicated array of themes
   */
  private deduplicateThemes(themes: ThemeInfo[]): ThemeInfo[] {
    const seen = new Set<string>();
    return themes.filter((theme) => {
      if (seen.has(theme.name)) {
        return false;
      }
      seen.add(theme.name);
      return true;
    });
  }
}
