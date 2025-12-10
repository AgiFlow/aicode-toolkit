/**
 * style-system-mcp - Public API
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

// Services
export { ComponentRendererService } from './services/ComponentRendererService';
export { StoriesIndexService } from './services/StoriesIndexService';
export { ThemeService } from './services/ThemeService';
export { VitejsService } from './services/VitejsService';

// CSS Classes services
export {
  BaseCSSClassesService,
  CSSClassesServiceFactory,
  DEFAULT_STYLE_SYSTEM_CONFIG,
  TailwindCSSClassesService,
} from './services/CssClasses';
export type { CSSClassCategory, CSSClassesResult, CSSClassValue, StyleSystemConfig } from './services/CssClasses';

// Tools
export { GetCSSClassesTool } from './tools/GetCSSClassesTool';
export { GetComponentVisualTool } from './tools/GetComponentVisualTool';
export { ListAppComponentsTool } from './tools/ListAppComponentsTool';
export { ListThemesTool } from './tools/ListThemesTool';
export { ListSharedComponentsTool } from './tools/ListSharedComponentsTool';
// Transports
export { StdioTransportHandler } from './transports/stdio';
// Types
export type * from './types';
