/**
 * @agiflowai/one-mcp - Public API
 *
 * DESIGN PATTERNS:
 * - Barrel export pattern for clean public API
 * - Named exports only (no default exports)
 * - Organized by module type (server, types, transports)
 *
 * CODING STANDARDS:
 * - Export only public-facing interfaces and classes
 * - Group related exports with comments
 * - Use explicit named exports (no wildcard exports)
 * - Keep in sync with module structure
 *
 * AVOID:
 * - Default exports (use named exports)
 * - Wildcard exports (be explicit)
 * - Exporting internal implementation details
 * - Mixing CLI and library concerns
 */

// Server
export { createServer, createSessionServer, initializeSharedServices } from './server';
export type { ServerOptions, SharedServices } from './server';

// Types
export type * from './types';
export { TRANSPORT_MODE } from './types';

// Transports
export {
  HttpTransportHandler,
  SseTransportHandler,
  StdioHttpTransportHandler,
  StdioTransportHandler,
} from './transports';

// Tools - Exported for library usage (e.g., Clawdbot plugin)
export { DescribeToolsTool, SearchListToolsTool, UseToolTool } from './tools';

// Services - Exported for library usage (e.g., Clawdbot plugin)
export {
  ConfigFetcherService,
  DefinitionsCacheService,
  McpClientManagerService,
  RuntimeStateService,
  StopServerService,
  SkillService,
} from './services';
export type { StopServerRequest, StopServerResult } from './services';

// Utils
export { findConfigFile, generateServerId } from './utils';
