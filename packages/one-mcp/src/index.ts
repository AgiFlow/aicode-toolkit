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

// Tools - Add tool exports here as you create them
// Example: export { MyTool } from './tools/MyTool.js';

// Services - Add service exports here as you create them
// Example: export { MyService } from './services/MyService.js';

// Prompts - Add prompt exports here as you create them
// Example: export { MyPrompt } from './prompts/MyPrompt.js';

// Utils - Add utility exports here as you create them
// Example: export { formatHelper } from './utils/formatHelper.js';
