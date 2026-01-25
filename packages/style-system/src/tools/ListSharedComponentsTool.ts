/**
 * ListSharedComponentsTool
 *
 * DESIGN PATTERNS:
 * - Tool pattern with getDefinition() and execute() methods
 * - Service delegation for business logic
 * - JSON Schema validation for inputs
 *
 * CODING STANDARDS:
 * - Implement Tool interface from ../types
 * - Use TOOL_NAME constant with snake_case (e.g., 'list_shared_components')
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
import { getSharedComponentTags } from '../config';
import { StoriesIndexService } from '../services';
import type { Tool, ToolDefinition } from '../types';

/**
 * Input parameters for ListSharedComponentsTool
 */
interface ListSharedComponentsInput {
  /** Optional tags to filter components by. If not provided, uses configured sharedComponentTags from toolkit.yaml */
  tags?: string[];
  /** Optional pagination cursor to fetch the next page of results */
  cursor?: string;
}

/**
 * Result structure for list shared components
 */
interface ListSharedComponentsResult {
  /** Tags used for filtering */
  filteredByTags: string[];
  /** All available tags in the codebase */
  availableTags: string[];
  /** List of component names */
  components: string[];
  /** Pagination info */
  pagination: {
    offset: number;
    pageSize: number;
    totalComponents: number;
    hasMore: boolean;
  };
  /** Cursor for next page (if hasMore is true) */
  nextCursor?: string;
}

export class ListSharedComponentsTool implements Tool<ListSharedComponentsInput> {
  static readonly TOOL_NAME = 'list_shared_components';
  static readonly PAGE_SIZE = 50;
  private static readonly COMPONENT_REUSE_INSTRUCTION =
    'IMPORTANT: Before creating new components, check if a similar component already exists in the list above. Always reuse existing shared components to maintain consistency and reduce code duplication.';

  /**
   * Encode pagination state into an opaque cursor string
   * @param offset - The current offset in the component list
   * @returns Base64 encoded cursor string
   */
  private encodeCursor(offset: number): string {
    return Buffer.from(JSON.stringify({ offset })).toString('base64');
  }

  /**
   * Decode cursor string into pagination state
   * @param cursor - Base64 encoded cursor string
   * @returns Object containing the offset
   */
  private decodeCursor(cursor: string): { offset: number } {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      return { offset: parsed.offset || 0 };
    } catch {
      return { offset: 0 };
    }
  }

  /**
   * Gets the tool definition including name, description, and input schema.
   * @returns Tool definition for MCP registration
   */
  getDefinition(): ToolDefinition {
    return {
      name: ListSharedComponentsTool.TOOL_NAME,
      description:
        'List shared UI components from the design system. Call this tool BEFORE creating new components to check if a similar component already exists. ' +
        'Use the "tags" parameter to filter by specific tags. If no tags provided, uses configured sharedComponentTags from toolkit.yaml (default: style-system). ' +
        'The response includes "availableTags" showing all tags in the codebase for filtering.',
      inputSchema: {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Optional array of tags to filter components by. If not provided, uses configured sharedComponentTags from toolkit.yaml. Pass an empty array [] to list ALL components.',
          },
          cursor: {
            type: 'string',
            description: 'Optional pagination cursor to fetch the next page of results. Omit to fetch the first page.',
          },
        },
        additionalProperties: false,
      },
    };
  }

  /**
   * Lists shared UI components from the design system.
   * @param input - Object containing optional tags filter and cursor for pagination
   * @returns CallToolResult with component list or error
   */
  async execute(input: ListSharedComponentsInput): Promise<CallToolResult> {
    try {
      const { cursor, tags: inputTags } = input;

      // Decode cursor to get pagination offset
      const { offset } = cursor ? this.decodeCursor(cursor) : { offset: 0 };

      // Initialize stories index
      const storiesIndex = new StoriesIndexService();

      // Run independent operations in parallel for better performance
      const [, defaultTags] = await Promise.all([
        storiesIndex.initialize(),
        getSharedComponentTags(),
      ]);

      // Get all available tags first
      const availableTags = storiesIndex.getAllTags();

      // Determine which tags to filter by (use input if provided, otherwise defaults)
      const filterTags = inputTags !== undefined ? inputTags : defaultTags;

      // Get components filtered by tags
      const filteredComponents = storiesIndex.getComponentsByTags(filterTags.length > 0 ? filterTags : undefined);

      // Extract unique component names
      const allComponentNames = filteredComponents
        .map((component) => component.title.split('/').pop() || component.title)
        .filter((name, index, self) => self.indexOf(name) === index)
        .sort();

      const totalComponents = allComponentNames.length;

      // Apply pagination
      const paginatedComponents = allComponentNames.slice(offset, offset + ListSharedComponentsTool.PAGE_SIZE);

      // Determine if there are more results
      const hasMore = offset + paginatedComponents.length < totalComponents;

      const result: ListSharedComponentsResult = {
        filteredByTags: filterTags,
        availableTags,
        components: paginatedComponents,
        pagination: {
          offset,
          pageSize: ListSharedComponentsTool.PAGE_SIZE,
          totalComponents,
          hasMore,
        },
      };

      // Add nextCursor if there are more results
      if (hasMore) {
        result.nextCursor = this.encodeCursor(offset + paginatedComponents.length);
      }

      log.info(
        `[ListSharedComponentsTool] Tags: [${filterTags.join(', ')}], Page ${Math.floor(offset / ListSharedComponentsTool.PAGE_SIZE) + 1}: ` +
          `Returned ${paginatedComponents.length} of ${totalComponents} total components (hasMore: ${hasMore})`,
      );

      return {
        content: [
          {
            type: 'text',
            text: `${ListSharedComponentsTool.COMPONENT_REUSE_INSTRUCTION}\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to list shared components: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
}
