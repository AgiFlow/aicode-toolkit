/**
 * GetCSSClassesTool
 *
 * DESIGN PATTERNS:
 * - Tool pattern with getDefinition() and execute() methods
 * - Service delegation for business logic via factory pattern
 * - JSON Schema validation for inputs
 *
 * CODING STANDARDS:
 * - Implement Tool interface from ../types
 * - Use TOOL_NAME constant with snake_case (e.g., 'get_css_classes')
 * - Return CallToolResult with content array
 * - Handle errors with isError flag
 * - Delegate complex logic to services
 *
 * AVOID:
 * - Complex business logic in execute method
 * - Unhandled promise rejections
 * - Missing input validation
 */

import path from 'node:path';
import { TemplatesManagerService } from '@agiflowai/aicode-utils';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getAppDesignSystemConfig } from '../config';
import type { BaseCSSClassesService, CSSClassCategory } from '../services/CssClasses';
import { CSSClassesServiceFactory } from '../services/CssClasses';
import type { Tool, ToolDefinition } from '../types';

/**
 * Valid CSS class category values
 */
const VALID_CATEGORIES = ['colors', 'typography', 'spacing', 'effects', 'all'] as const;

/**
 * Input parameters for GetCSSClassesTool
 */
interface GetCSSClassesInput {
  category?: string;
  appPath?: string;
}

/**
 * Type guard to validate category input
 * @param value - Value to check
 * @returns True if value is a valid CSSClassCategory
 */
function isValidCategory(value: string): value is CSSClassCategory {
  return VALID_CATEGORIES.includes(value as CSSClassCategory);
}

/**
 * MCP Tool for extracting CSS classes from theme files.
 *
 * Uses the CSSClassesServiceFactory to create the appropriate service
 * based on configuration, supporting Tailwind and custom CSS frameworks.
 *
 * @example
 * ```typescript
 * const tool = new GetCSSClassesTool();
 * const result = await tool.execute({ category: 'colors' });
 * ```
 */
export class GetCSSClassesTool implements Tool<GetCSSClassesInput> {
  static readonly TOOL_NAME = 'get_css_classes';
  private static readonly CSS_REUSE_INSTRUCTION =
    'IMPORTANT: Always reuse these existing CSS classes from the theme as much as possible instead of creating custom styles. This ensures design consistency and reduces CSS bloat.';

  private serviceFactory: CSSClassesServiceFactory;
  private service: BaseCSSClassesService | null = null;
  private defaultThemePath: string;

  /**
   * Creates a new GetCSSClassesTool instance
   * @param defaultThemePath - Default path to theme CSS file (relative to workspace root)
   */
  constructor(defaultThemePath: string = 'packages/frontend/web-theme/src/agimon-theme.css') {
    this.serviceFactory = new CSSClassesServiceFactory();
    this.defaultThemePath = defaultThemePath;
  }

  /**
   * Returns the tool definition for MCP registration
   * @returns Tool definition with name, description, and input schema
   */
  getDefinition(): ToolDefinition {
    return {
      name: GetCSSClassesTool.TOOL_NAME,
      description:
        'Extract and return all supported CSS classes from the theme file. Call this tool BEFORE writing any component styles or class names to ensure you use existing theme classes.',
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['colors', 'typography', 'spacing', 'effects', 'all'],
            description: "Category filter: 'colors', 'typography', 'spacing', 'effects', 'all' (default)",
          },
          appPath: {
            type: 'string',
            description:
              'Optional app path (relative or absolute) to read theme path from project.json style-system config (e.g., "apps/agiflow-app")',
          },
        },
        additionalProperties: false,
      },
    };
  }

  /**
   * Executes the CSS class extraction
   * @param input - Tool input parameters
   * @returns CallToolResult with extracted CSS classes or error
   */
  async execute(input: GetCSSClassesInput): Promise<CallToolResult> {
    try {
      // Validate and normalize category input
      const category = input.category || 'all';
      if (!isValidCategory(category)) {
        throw new Error(
          `Invalid category: '${category}'. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
        );
      }

      // Resolve theme path from config or use default
      const themePath = await this.resolveThemePath(input.appPath);

      // Initialize service lazily using factory
      if (!this.service) {
        this.service = await this.serviceFactory.createService();
      }

      // Delegate extraction to service
      const result = await this.service.extractClasses(category, themePath);

      return {
        content: [
          {
            type: 'text',
            text: `${GetCSSClassesTool.CSS_REUSE_INSTRUCTION}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Resolves the theme file path based on app configuration or defaults.
   *
   * Resolution strategy:
   * 1. If appPath provided, read themePath from project.json style-system config
   * 2. Fall back to default theme path if not configured
   *
   * @param appPath - Optional app path to read config from
   * @returns Absolute path to the theme file
   */
  private async resolveThemePath(appPath?: string): Promise<string> {
    const workspaceRoot = TemplatesManagerService.getWorkspaceRootSync();

    if (appPath) {
      // Read theme path from app's project.json style-system config
      const config = await getAppDesignSystemConfig(appPath);
      if (config.themePath) {
        return path.resolve(workspaceRoot, config.themePath);
      }
    }

    // Use default theme path
    return path.resolve(workspaceRoot, this.defaultThemePath);
  }
}
