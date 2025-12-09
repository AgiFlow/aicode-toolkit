/**
 * ListWebUiComponentsTool
 *
 * DESIGN PATTERNS:
 * - Tool pattern with getDefinition() and execute() methods
 * - Service delegation for business logic
 * - JSON Schema validation for inputs
 *
 * CODING STANDARDS:
 * - Implement Tool interface from ../types
 * - Use TOOL_NAME constant with snake_case (e.g., 'list_web_ui_components')
 * - Return CallToolResult with content array
 * - Handle errors with isError flag
 * - Delegate complex logic to services
 *
 * AVOID:
 * - Complex business logic in execute method
 * - Unhandled promise rejections
 * - Missing input validation
 */

import { log } from '@agiflowai/aicode-utils';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { StoriesIndexService } from '../services/StoriesIndexService';
import type { Tool, ToolDefinition } from '../types';

interface ListWebUiComponentsInput {
  cursor?: string;
}

export class ListWebUiComponentsTool implements Tool<ListWebUiComponentsInput> {
  static readonly TOOL_NAME = 'list-web-ui-components';
  static readonly PAGE_SIZE = 50; // Components per page

  /**
   * Encode pagination state into an opaque cursor string
   */
  private encodeCursor(offset: number): string {
    return Buffer.from(JSON.stringify({ offset })).toString('base64');
  }

  /**
   * Decode cursor string into pagination state
   */
  private decodeCursor(cursor: string): { offset: number } {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      return { offset: parsed.offset || 0 };
    } catch {
      // Invalid cursor, start from beginning
      return { offset: 0 };
    }
  }

  getDefinition(): ToolDefinition {
    return {
      name: ListWebUiComponentsTool.TOOL_NAME,
      description:
        'List all web UI components available in the design system (filtered by style-system tag in Storybook)',
      inputSchema: {
        type: 'object',
        properties: {
          cursor: {
            type: 'string',
            description: 'Optional pagination cursor to fetch the next page of results. Omit to fetch the first page.',
          },
        },
        additionalProperties: false,
      },
    };
  }

  async execute(input: ListWebUiComponentsInput): Promise<CallToolResult> {
    try {
      const { cursor } = input;

      // Decode cursor to get pagination offset
      const { offset } = cursor ? this.decodeCursor(cursor) : { offset: 0 };

      const storiesIndex = new StoriesIndexService();
      await storiesIndex.initialize();

      // Get components with 'style-system' tag
      const designSystemComponents = storiesIndex.getComponentsByTags(['style-system']);

      // Extract unique component names
      const allComponentNames = designSystemComponents
        .map((component) => component.title.split('/').pop() || component.title)
        .filter((name, index, self) => self.indexOf(name) === index)
        .sort();

      const totalComponents = allComponentNames.length;

      // Apply pagination
      const paginatedComponents = allComponentNames.slice(offset, offset + ListWebUiComponentsTool.PAGE_SIZE);

      // Determine if there are more results
      const hasMore = offset + paginatedComponents.length < totalComponents;

      const result: {
        library: string;
        components: string[];
        pagination: {
          offset: number;
          pageSize: number;
          totalComponents: number;
          hasMore: boolean;
        };
        nextCursor?: string;
      } = {
        library: '@agimonai/web-ui',
        components: paginatedComponents,
        pagination: {
          offset,
          pageSize: ListWebUiComponentsTool.PAGE_SIZE,
          totalComponents,
          hasMore,
        },
      };

      // Add nextCursor if there are more results
      if (hasMore) {
        result.nextCursor = this.encodeCursor(offset + paginatedComponents.length);
      }

      log.info(
        `[ListWebUiComponentsTool] Page ${Math.floor(offset / ListWebUiComponentsTool.PAGE_SIZE) + 1}: ` +
          `Returned ${paginatedComponents.length} of ${totalComponents} total components (hasMore: ${hasMore})`,
      );

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
