/**
 * TailwindCSSClassesService
 *
 * DESIGN PATTERNS:
 * - Extends BaseCSSClassesService for Tailwind-specific extraction
 * - Uses postcss AST parser for robust CSS variable extraction
 * - Parses CSS variables from theme files to generate utility classes
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
import postcss from 'postcss';
import { BaseCSSClassesService } from './BaseCSSClassesService';
import type { CSSClassCategory, CSSClassesResult, CSSClassValue } from './types';

/**
 * Tailwind CSS class extraction service.
 *
 * Extracts CSS classes from Tailwind theme files by parsing CSS variables
 * using postcss AST and generating corresponding utility class names.
 *
 * @example
 * ```typescript
 * const service = new TailwindCSSClassesService(config);
 * const result = await service.extractClasses('colors', '/path/to/theme.css');
 * console.log(result.classes.colors); // Array of color utility classes
 * ```
 */
export class TailwindCSSClassesService extends BaseCSSClassesService {
  /**
   * Get the CSS framework identifier
   * @returns Framework identifier string 'tailwind'
   */
  getFrameworkId(): string {
    return 'tailwind';
  }

  /**
   * Extract Tailwind CSS classes from a theme file.
   *
   * Uses postcss to parse the CSS AST and safely extract variable declarations,
   * then generates corresponding Tailwind utility classes (e.g., bg-*, text-*, border-*).
   *
   * Note: If an unrecognized category is passed, the method returns a result with
   * empty classes object. Use valid categories: 'colors', 'typography', 'spacing', 'effects', 'all'.
   *
   * @param category - Category filter ('colors', 'typography', 'spacing', 'effects', 'all')
   * @param themePath - Absolute path to the theme CSS file
   * @returns Promise resolving to extracted CSS classes organized by category
   * @throws Error if theme file cannot be read or parsed
   */
  async extractClasses(
    category: CSSClassCategory | string,
    themePath: string,
  ): Promise<CSSClassesResult> {
    try {
      await this.validateThemePath(themePath);

      const resolvedThemePath = path.resolve(themePath);
      const themeContent = await fs.readFile(resolvedThemePath, 'utf-8');
      const variables = await this.extractVariablesWithPostCSS(themeContent);
      const classes = this.generateClassesFromVariables(variables, category);

      return classes;
    } catch (error) {
      throw new Error(
        `Failed to extract classes from theme file ${themePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Extract CSS variables with their values from theme content using postcss AST.
   *
   * Walks the CSS AST to find all custom property declarations (--*),
   * handling multi-line values, comments, and any CSS formatting.
   *
   * @param themeContent - Raw CSS content from theme file
   * @returns Promise resolving to Map of variable names (without --) to their values
   *
   * @example
   * ```typescript
   * // Handles standard declarations
   * // --color-primary: #3b82f6;
   *
   * // Handles multi-line declarations
   * // --shadow-lg:
   * //   0 10px 15px -3px rgba(0, 0, 0, 0.1),
   * //   0 4px 6px -4px rgba(0, 0, 0, 0.1);
   *
   * // Handles compressed CSS
   * // --color-primary:#3b82f6;--color-secondary:#10b981;
   * ```
   */
  private async extractVariablesWithPostCSS(themeContent: string): Promise<Map<string, string>> {
    const variables = new Map<string, string>();

    try {
      const root = postcss.parse(themeContent);

      // Walk all declarations in the AST
      root.walkDecls((decl) => {
        // Check if this is a CSS custom property (starts with --)
        if (decl.prop.startsWith('--')) {
          const varName = decl.prop.slice(2); // Remove leading --
          const varValue = decl.value.trim();

          // Store the first occurrence (light mode values take precedence)
          // Variables in later rules (like .dark) won't overwrite
          if (!variables.has(varName)) {
            variables.set(varName, varValue);
          }
        }
      });
    } catch (error) {
      throw new Error(
        `Failed to parse CSS content: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return variables;
  }

  /**
   * Generate utility classes with actual values from CSS variables.
   *
   * Maps CSS variable naming conventions to Tailwind utility classes:
   * - color-* → bg-*, text-*, border-*, ring-*
   * - sidebar* → bg-*, text-*, border-*
   * - text-* → text-* (typography)
   * - font-* → font-* (typography)
   * - space-* → p-*, m-*, gap-*
   * - shadow-* → shadow-*
   *
   * Note: If the variables Map is empty, returns a result with empty arrays
   * for all requested categories.
   *
   * @param variables - Map of CSS variable names to values
   * @param category - Category filter for which classes to generate
   * @returns CSSClassesResult with organized classes by category
   *
   * @example
   * ```typescript
   * const variables = new Map([
   *   ['color-primary', '#3b82f6'],
   *   ['shadow-md', '0 4px 6px rgba(0,0,0,0.1)']
   * ]);
   * const result = generateClassesFromVariables(variables, 'colors');
   * // Returns:
   * // {
   * //   category: 'colors',
   * //   classes: {
   * //     colors: [
   * //       { class: 'bg-primary', value: '#3b82f6' },
   * //       { class: 'text-primary', value: '#3b82f6' },
   * //       { class: 'border-primary', value: '#3b82f6' },
   * //       { class: 'ring-primary', value: '#3b82f6' }
   * //     ]
   * //   },
   * //   totalClasses: 4
   * // }
   * ```
   */
  private generateClassesFromVariables(
    variables: Map<string, string>,
    category: CSSClassCategory | string,
  ): CSSClassesResult {
    const colorClasses: CSSClassValue[] = [];
    const typographyClasses: CSSClassValue[] = [];
    const spacingClasses: CSSClassValue[] = [];
    const effectsClasses: CSSClassValue[] = [];

    for (const [varName, varValue] of variables.entries()) {
      // Color utilities: --color-* and --sidebar*
      if (category === 'all' || category === 'colors') {
        if (varName.startsWith('color-')) {
          const colorName = varName.replace('color-', '');
          colorClasses.push(
            { class: `bg-${colorName}`, value: varValue },
            { class: `text-${colorName}`, value: varValue },
            { class: `border-${colorName}`, value: varValue },
            { class: `ring-${colorName}`, value: varValue },
          );
        } else if (varName.startsWith('sidebar')) {
          colorClasses.push(
            { class: `bg-${varName}`, value: varValue },
            { class: `text-${varName}`, value: varValue },
            { class: `border-${varName}`, value: varValue },
          );
        }
      }

      // Typography utilities: --text-* and --font-*
      if (category === 'all' || category === 'typography') {
        if (varName.startsWith('text-')) {
          typographyClasses.push({ class: varName, value: varValue });
        }
        if (varName.startsWith('font-')) {
          const fontName = varName.replace('font-', '');
          if (fontName.startsWith('weight-')) {
            typographyClasses.push({
              class: `font-${fontName.replace('weight-', '')}`,
              value: varValue,
            });
          } else {
            typographyClasses.push({ class: `font-${fontName}`, value: varValue });
          }
        }
      }

      // Spacing utilities: --space-* and --spacing
      if (category === 'all' || category === 'spacing') {
        if (varName.startsWith('space-')) {
          const spaceName = varName.replace('space-', '');
          const calcValue = `calc(var(--${varName}) * 1)`;
          spacingClasses.push(
            { class: `p-${spaceName}`, value: calcValue },
            { class: `m-${spaceName}`, value: calcValue },
            { class: `gap-${spaceName}`, value: calcValue },
          );
        } else if (varName === 'spacing') {
          spacingClasses.push({ class: 'space', value: varValue });
        }
      }

      // Effects utilities: --shadow-*
      if (category === 'all' || category === 'effects') {
        if (varName.startsWith('shadow-')) {
          const shadowName = varName.replace('shadow-', '');
          effectsClasses.push({ class: `shadow-${shadowName}`, value: varValue });
        }
      }
    }

    const result: CSSClassesResult = {
      category: category as string,
      classes: {},
      totalClasses:
        colorClasses.length +
        typographyClasses.length +
        spacingClasses.length +
        effectsClasses.length,
    };

    if (category === 'all' || category === 'colors') {
      result.classes.colors = colorClasses;
    }
    if (category === 'all' || category === 'typography') {
      result.classes.typography = typographyClasses;
    }
    if (category === 'all' || category === 'spacing') {
      result.classes.spacing = spacingClasses;
    }
    if (category === 'all' || category === 'effects') {
      result.classes.effects = effectsClasses;
    }

    return result;
  }
}
