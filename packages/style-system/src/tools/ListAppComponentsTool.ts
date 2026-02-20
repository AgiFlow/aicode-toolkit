/**
 * ListAppComponentsTool
 *
 * DESIGN PATTERNS:
 * - Tool pattern with getDefinition() and execute() methods
 * - Service delegation for business logic
 * - JSON Schema validation for inputs
 *
 * CODING STANDARDS:
 * - Implement Tool interface from ../types
 * - Use TOOL_NAME constant with snake_case (e.g., 'list_app_components')
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
import { AppComponentsService } from '../services';
import type { Tool, ToolDefinition } from '../types';

/**
 * Input parameters for ListAppComponentsTool.
 */
interface ListAppComponentsInput {
  appPath: string;
  cursor?: string;
}

/**
 * Tool to list app-specific components and package components used by an app.
 *
 * Detects app components by file path (within app directory) and resolves
 * workspace dependencies to find package components from Storybook stories.
 *
 * @example
 * ```typescript
 * const tool = new ListAppComponentsTool();
 * const result = await tool.execute({ appPath: 'apps/my-app' });
 * // Returns: { app: 'my-app', appComponents: ['Button'], packageComponents: {...}, pagination: {...} }
 * ```
 */
export class ListAppComponentsTool implements Tool<ListAppComponentsInput> {
  static readonly TOOL_NAME = 'list_app_components';
  private static readonly COMPONENT_REUSE_INSTRUCTION =
    'IMPORTANT: Before creating new components, check if a similar component already exists in the list above. Always reuse existing components to maintain consistency and reduce code duplication.';

  private service: AppComponentsService;

  constructor() {
    this.service = new AppComponentsService();
  }

  /**
   * Gets the tool definition including name, description, and input schema.
   * @returns Tool definition for MCP registration
   */
  getDefinition(): ToolDefinition {
    return {
      name: ListAppComponentsTool.TOOL_NAME,
      description:
        "List app-specific components and package components used by an app. Call this tool BEFORE creating new components to check if a similar component already exists. Reads the app's package.json to find workspace dependencies and returns components from both the app and its dependent packages.",
      inputSchema: {
        type: 'object',
        properties: {
          appPath: {
            type: 'string',
            description:
              'The app path (relative or absolute) to list components for (e.g., "apps/my-app")',
            minLength: 1,
          },
          cursor: {
            type: 'string',
            description:
              'Optional pagination cursor to fetch the next page of results. Omit to fetch the first page.',
          },
        },
        required: ['appPath'],
        additionalProperties: false,
      },
    };
  }

  /**
   * Lists app-specific and package components for a given application.
   * @param input - Object containing appPath and optional cursor for pagination
   * @returns CallToolResult with component list or error
   */
  async execute(input: ListAppComponentsInput): Promise<CallToolResult> {
    try {
      const result = await this.service.listComponents({
        appPath: input.appPath,
        cursor: input.cursor,
      });

      return {
        content: [
          {
            type: 'text',
            text: `${ListAppComponentsTool.COMPONENT_REUSE_INSTRUCTION}\n\n${JSON.stringify(result, null, 2)}`,
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
