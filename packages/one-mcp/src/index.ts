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
export { createServer } from './server';
export type { ServerOptions } from './server';

// Types
export type * from './types';

// Transports
export { StdioTransportHandler } from './transports/stdio';
export { SseTransportHandler } from './transports/sse';
export { HttpTransportHandler } from './transports/http';

// Tools - Exported for library usage (e.g., Clawdbot plugin)
export { DescribeToolsTool } from './tools/DescribeToolsTool';
export { UseToolTool } from './tools/UseToolTool';

// Services - Exported for library usage (e.g., Clawdbot plugin)
export { ConfigFetcherService } from './services/ConfigFetcherService';
export { McpClientManagerService } from './services/McpClientManagerService';
export { SkillService } from './services/SkillService';
