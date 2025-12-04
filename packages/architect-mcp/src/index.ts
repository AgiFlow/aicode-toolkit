/**
 * @agiflowai/architect-mcp - Public API
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

// Types
export type * from './types/index';

// Transports
export { StdioTransportHandler } from './transports/stdio';
export { SseTransportHandler } from './transports/sse';
export { HttpTransportHandler } from './transports/http';

// Tools
export {
  GetFileDesignPatternTool,
  ReviewCodeChangeTool,
  AddDesignPatternTool,
  AddRuleTool,
} from './tools/index';

// Services
export {
  TemplateFinder,
  ArchitectParser,
  CodeReviewService,
  PatternMatcher,
  RuleFinder,
} from './services/index';

// Hooks - Claude Code integration
export { GetFileDesignPatternHook as ClaudeCodeGetFileDesignPatternHook } from './hooks/claudeCode/getFileDesignPattern';
export { ReviewCodeChangeHook as ClaudeCodeReviewCodeChangeHook } from './hooks/claudeCode/reviewCodeChange';

// Hooks - Gemini CLI integration
export { GetFileDesignPatternHook as GeminiCliGetFileDesignPatternHook } from './hooks/geminiCli/getFileDesignPattern';
export { ReviewCodeChangeHook as GeminiCliReviewCodeChangeHook } from './hooks/geminiCli/reviewCodeChange';
