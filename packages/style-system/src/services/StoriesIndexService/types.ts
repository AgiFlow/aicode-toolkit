/**
 * StoriesIndexService Types
 *
 * Type definitions for the StoriesIndexService service.
 */

/**
 * Story meta information from default export
 */
export interface StoryMeta {
  /** Story title (e.g., "Components/Button") */
  title: string;
  /** Reference to the component */
  component?: unknown;
  /** Story tags for filtering */
  tags?: string[];
  /** Story parameters */
  parameters?: Record<string, unknown>;
  /** Arg type definitions */
  argTypes?: Record<string, unknown>;
}

/**
 * Component information extracted from story files
 */
export interface ComponentInfo {
  /** Full title from meta (e.g., "Components/Button") */
  title: string;
  /** Absolute path to story file */
  filePath: string;
  /** SHA256 hash of file content for cache invalidation */
  fileHash: string;
  /** Tags from story meta */
  tags: string[];
  /** Names of exported stories */
  stories: string[];
  /** Full story meta object */
  meta: StoryMeta;
  /** Component description extracted from file header JSDoc or meta.parameters.docs.description */
  description?: string;
}

/**
 * Configuration options for StoriesIndexService
 */
export interface StoriesIndexServiceConfig {
  /**
   * Enable verbose logging
   * @default false
   */
  verbose?: boolean;
}

/**
 * Result returned by StoriesIndexService operations
 */
export interface StoriesIndexServiceResult {
  /**
   * Whether the operation was successful
   */
  success: boolean;

  /**
   * Result data if successful
   */
  data?: unknown;

  /**
   * Error message if failed
   */
  error?: string;
}
