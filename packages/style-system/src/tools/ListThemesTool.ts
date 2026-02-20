/**
 * ListThemesTool
 *
 * DESIGN PATTERNS:
 * - Tool pattern with getDefinition() and execute() methods
 * - Factory pattern for service creation
 * - JSON Schema validation for inputs
 *
 * CODING STANDARDS:
 * - Implement Tool interface from ../types
 * - Use TOOL_NAME constant with snake_case (e.g., 'list_themes')
 * - Return CallToolResult with content array
 * - Handle errors with isError flag
 * - Delegate complex logic to services
 *
 * AVOID:
 * - Complex business logic in execute method
 * - Unhandled promise rejections
 * - Missing input validation
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getAppDesignSystemConfig } from '../config';
import { ThemeServiceFactory } from '../services/ThemeService';
import type { Tool, ToolDefinition } from '../types';

/**
 * Input parameters for ListThemesTool
 */
interface ListThemesInput {
  appPath?: string;
}

/**
 * Tool to list all available theme configurations.
 *
 * Reads themes from CSS files configured in the app's project.json
 * style-system config. Themes are extracted by parsing CSS class selectors
 * that contain color variable definitions.
 *
 * @example
 * ```typescript
 * const tool = new ListThemesTool();
 * const result = await tool.execute({ appPath: 'apps/my-app' });
 * // Returns: { themes: [{ name: 'slate', ... }, { name: 'blue', ... }], source: 'css-file' }
 * ```
 */
export class ListThemesTool implements Tool<ListThemesInput> {
  static readonly TOOL_NAME = 'list_themes';

  private serviceFactory: ThemeServiceFactory;

  constructor() {
    this.serviceFactory = new ThemeServiceFactory();
  }

  getDefinition(): ToolDefinition {
    return {
      name: ListThemesTool.TOOL_NAME,
      description:
        "List all available theme configurations. Reads themes from CSS files configured in the app's project.json style-system config.",
      inputSchema: {
        type: 'object',
        properties: {
          appPath: {
            type: 'string',
            description:
              'App path (relative or absolute) to read theme config from project.json (e.g., "apps/my-app")',
          },
        },
        additionalProperties: false,
      },
    };
  }

  async execute(input: ListThemesInput): Promise<CallToolResult> {
    try {
      // Get config from app's project.json if appPath provided
      let themePath: string | undefined;
      let cssFiles: string[] | undefined;

      if (input.appPath) {
        const appConfig = await getAppDesignSystemConfig(input.appPath);
        themePath = appConfig.themePath;
        cssFiles = appConfig.cssFiles;
      }

      // Create service with resolved config
      const service = await this.serviceFactory.createService({
        themePath,
        cssFiles,
      });

      const result = await service.listThemes();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
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
}
