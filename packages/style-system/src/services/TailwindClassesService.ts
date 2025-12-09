/**
 * TailwindClassesService
 *
 * DESIGN PATTERNS:
 * - Service pattern for business logic encapsulation
 * - Uses Tailwind CSS compiler to generate actual CSS output
 * - Parses compiled CSS to extract utility classes and values
 *
 * CODING STANDARDS:
 * - Use async/await for asynchronous operations
 * - Throw descriptive errors for error cases
 * - Keep methods focused and well-named
 * - Document complex logic with comments
 * - Clean up temporary files after processing
 *
 * AVOID:
 * - Mixing concerns (keep focused on single domain)
 * - Direct tool implementation (services should be tool-agnostic)
 * - Leaving temporary files on disk
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

interface TailwindClassValue {
  class: string;
  value: string;
}

interface TailwindClasses {
  category: string;
  classes: {
    colors?: TailwindClassValue[];
    typography?: TailwindClassValue[];
    spacing?: TailwindClassValue[];
    effects?: TailwindClassValue[];
    sidebar?: TailwindClassValue[];
    icons?: TailwindClassValue[];
    grid?: TailwindClassValue[];
    animations?: TailwindClassValue[];
  };
  totalClasses?: number;
}

export class TailwindClassesService {
  /**
   * Extract Tailwind classes from a theme CSS file using Tailwind's compiler
   */
  async extractClasses(category: string = 'all', themePath: string): Promise<TailwindClasses> {
    try {
      const resolvedThemePath = path.resolve(themePath);

      // Read theme to extract CSS variables and their values
      const themeContent = await fs.readFile(resolvedThemePath, 'utf-8');
      const variables = this.extractVariables(themeContent);

      // Generate utility classes with actual values from theme
      const classes = this.generateClassesFromVariables(variables, category);

      return classes;
    } catch (error) {
      throw new Error(`Failed to extract Tailwind classes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract CSS variables with their values from theme content
   */
  private extractVariables(themeContent: string): Map<string, string> {
    const variables = new Map<string, string>();
    const variableRegex = /--([a-zA-Z0-9-]+):\s*([^;]+);/g;
    let match;

    while ((match = variableRegex.exec(themeContent)) !== null) {
      const varName = match[1];
      const varValue = match[2].trim();
      // Store the first occurrence (light mode values take precedence)
      if (!variables.has(varName)) {
        variables.set(varName, varValue);
      }
    }

    return variables;
  }

  /**
   * Generate utility classes with actual values from CSS variables
   */
  private generateClassesFromVariables(variables: Map<string, string>, category: string): TailwindClasses {
    const colorClasses: TailwindClassValue[] = [];
    const typographyClasses: TailwindClassValue[] = [];
    const spacingClasses: TailwindClassValue[] = [];
    const effectsClasses: TailwindClassValue[] = [];

    for (const [varName, varValue] of variables.entries()) {
      // Color utilities
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

      // Typography utilities
      if (category === 'all' || category === 'typography') {
        if (varName.startsWith('text-')) {
          typographyClasses.push({ class: varName, value: varValue });
        }
        if (varName.startsWith('font-')) {
          const fontName = varName.replace('font-', '');
          if (fontName.startsWith('weight-')) {
            typographyClasses.push({ class: `font-${fontName.replace('weight-', '')}`, value: varValue });
          } else {
            typographyClasses.push({ class: `font-${fontName}`, value: varValue });
          }
        }
      }

      // Spacing utilities
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

      // Effects utilities
      if (category === 'all' || category === 'effects') {
        if (varName.startsWith('shadow-')) {
          const shadowName = varName.replace('shadow-', '');
          effectsClasses.push({ class: `shadow-${shadowName}`, value: varValue });
        }
      }
    }

    const result: TailwindClasses = {
      category,
      classes: {},
      totalClasses: colorClasses.length + typographyClasses.length + spacingClasses.length + effectsClasses.length,
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
