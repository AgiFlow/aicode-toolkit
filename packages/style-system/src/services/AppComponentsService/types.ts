/**
 * AppComponentsService Types
 *
 * Type definitions for the AppComponentsService service.
 */

/**
 * Configuration options for AppComponentsService.
 */
export interface AppComponentsServiceConfig {
  /** Page size for pagination @default 50 */
  pageSize?: number;
}

/**
 * Default configuration values.
 */
export const DEFAULT_APP_COMPONENTS_CONFIG: Required<AppComponentsServiceConfig> = {
  pageSize: 50,
};

/**
 * Input parameters for listing app components.
 */
export interface ListAppComponentsInput {
  /** App path (relative or absolute) to list components for */
  appPath: string;
  /** Optional pagination cursor from previous response */
  cursor?: string;
}

/**
 * Pagination state encoded in cursor.
 */
export interface PaginationState {
  offset: number;
}

/**
 * Pagination metadata in the result.
 */
export interface PaginationInfo {
  offset: number;
  pageSize: number;
  totalComponents: number;
  hasMore: boolean;
}

/**
 * Brief component information for list results.
 */
export interface ComponentBrief {
  /** Component name (e.g., "Button") */
  name: string;
  /** Component description from story file JSDoc or parameters.docs.description */
  description?: string;
}

/**
 * Result returned by AppComponentsService.listComponents().
 */
export interface AppComponentsServiceResult {
  /** Name of the app */
  app: string;
  /** Components defined within the app directory */
  appComponents: ComponentBrief[];
  /** Components from workspace dependencies, keyed by package name */
  packageComponents: Record<string, ComponentBrief[]>;
  /** Pagination metadata */
  pagination: PaginationInfo;
  /** Cursor for fetching next page, if more results exist */
  nextCursor?: string;
}
