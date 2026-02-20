/**
 * Pagination utility for MCP tools
 * Implements cursor-based pagination following MCP specification
 * Uses simple index-based cursors (e.g., "10", "20")
 */

export interface PaginationResult<T> {
  items: T[];
  nextCursor?: string;
  _meta?: {
    total: number;
    offset: number;
    limit: number;
  };
}

// biome-ignore lint/complexity/noStaticOnlyClass: architectural pattern
export class PaginationHelper {
  /**
   * Default page size for pagination
   */
  static readonly DEFAULT_PAGE_SIZE = 10;

  /**
   * Decodes a cursor string to extract the start index
   * @param cursor - String representing the start index (e.g., "10")
   * @returns Start index or 0 if invalid/undefined
   */
  static decodeCursor(cursor?: string): number {
    if (!cursor) {
      return 0;
    }

    const index = Number.parseInt(cursor, 10);

    // Validate the cursor is a valid non-negative integer
    if (Number.isNaN(index) || index < 0) {
      return 0;
    }

    return index;
  }

  /**
   * Encodes an index into a cursor string
   * @param index - Start index to encode
   * @returns Cursor string (e.g., "10")
   */
  static encodeCursor(index: number): string {
    return index.toString();
  }

  /**
   * Paginates an array of items
   * @param items - All items to paginate
   * @param cursor - Optional cursor representing the start index
   * @param pageSize - Number of items per page (default: 10)
   * @param includeMeta - Whether to include metadata in response (default: true)
   * @returns Paginated result with items and optional nextCursor
   */
  static paginate<T>(
    items: T[],
    cursor?: string,
    pageSize: number = PaginationHelper.DEFAULT_PAGE_SIZE,
    includeMeta: boolean = true,
  ): PaginationResult<T> {
    // Decode cursor to get start index
    const startIndex = PaginationHelper.decodeCursor(cursor);
    const endIndex = startIndex + pageSize;

    // Slice the items for current page
    const paginatedItems = items.slice(startIndex, endIndex);

    // Determine if there's a next page
    const hasNextPage = endIndex < items.length;
    const nextCursor = hasNextPage ? PaginationHelper.encodeCursor(endIndex) : undefined;

    const result: PaginationResult<T> = {
      items: paginatedItems,
      nextCursor,
    };

    // Add metadata if requested
    if (includeMeta) {
      result._meta = {
        total: items.length,
        offset: startIndex,
        limit: pageSize,
      };
    }

    return result;
  }
}
