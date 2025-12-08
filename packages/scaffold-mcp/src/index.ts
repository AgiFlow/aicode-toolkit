/**
 * @agiflowai/scaffold-mcp - Public API
 *
 * DESIGN PATTERNS:
 * - Barrel export pattern for clean public API
 * - Named exports only (no default exports)
 * - Organized by module type (server, types, transports, tools, services)
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

// Services
export {
  BoilerplateGeneratorService,
  BoilerplateService,
  FileSystemService,
  ScaffoldConfigLoader,
  ScaffoldGeneratorService,
  ScaffoldingMethodsService,
  ScaffoldProcessingService,
  ScaffoldService,
  TemplateService,
  VariableReplacementService,
} from './services/index';
// Tools
export {
  GenerateBoilerplateFileTool,
  GenerateBoilerplateTool,
  GenerateFeatureScaffoldTool,
  ListBoilerplatesTool,
  ListScaffoldingMethodsTool,
  UseBoilerplateTool,
  UseScaffoldMethodTool,
  WriteToFileTool,
} from './tools/index';
export { HttpTransportHandler } from './transports/http';
export { SseTransportHandler } from './transports/sse';
// Transports
export { StdioTransportHandler } from './transports/stdio';
// Types
export type * from './types/index';
