/**
 * ListThemesTool
 *
 * DESIGN PATTERNS:
 * - Tool pattern with getDefinition() and execute() methods
 * - Service delegation for business logic
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
import type { DesignSystemConfig } from '../config';
import { ThemeService } from '../services/ThemeService';
import type { Tool, ToolDefinition } from '../types';

export class ListThemesTool implements Tool<Record<string, never>> {
  static readonly TOOL_NAME = 'list-themes';

  private themeService: ThemeService;

  constructor(config: DesignSystemConfig) {
    this.themeService = new ThemeService(config);
  }

  getDefinition(): ToolDefinition {
    return {
      name: ListThemesTool.TOOL_NAME,
      description: 'List all available theme configurations from packages/frontend/shared-theme/configs',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    };
  }

  async execute(_input: Record<string, never>): Promise<CallToolResult> {
    try {
      const result = await this.themeService.listAvailableThemes();

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
