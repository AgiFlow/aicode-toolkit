/**
 * LLM Tools Constants
 *
 * DESIGN PATTERNS:
 * - Strongly-typed constant exports for compile-time safety
 * - Organized by logical grouping using const objects
 * - Immutable by default (as const assertions)
 *
 * CODING STANDARDS:
 * - Primitive constants: UPPER_SNAKE_CASE
 * - Object constants: PascalCase with 'as const'
 * - Always include JSDoc with purpose and usage
 *
 * AVOID:
 * - Mutable exports (let, var)
 * - Magic numbers without explanation
 * - Mixing unrelated constants
 */

/**
 * Supported LLM tool identifiers for invokeAsLlm functionality
 * These are CLI tools that can be used as LLM backends
 */
export const LLM_TOOL_CLAUDE_CODE = 'claude-code';
export const LLM_TOOL_CODEX = 'codex';
export const LLM_TOOL_GEMINI_CLI = 'gemini-cli';
export const LLM_TOOL_GITHUB_COPILOT = 'github-copilot';

/**
 * Array of all supported LLM tools
 */
export const SUPPORTED_LLM_TOOLS = [
  LLM_TOOL_CLAUDE_CODE,
  LLM_TOOL_CODEX,
  LLM_TOOL_GEMINI_CLI,
  LLM_TOOL_GITHUB_COPILOT,
] as const;

/**
 * Union type of all supported LLM tool identifiers
 */
export type LlmToolId = (typeof SUPPORTED_LLM_TOOLS)[number];

/**
 * Configuration for each LLM tool
 */
export const LlmToolConfig = {
  [LLM_TOOL_CLAUDE_CODE]: {
    id: LLM_TOOL_CLAUDE_CODE,
    displayName: 'Claude Code',
    description: 'Anthropic Claude Code CLI',
    installCommand: 'npm install -g @anthropic-ai/claude-code',
  },
  [LLM_TOOL_CODEX]: {
    id: LLM_TOOL_CODEX,
    displayName: 'Codex',
    description: 'OpenAI Codex CLI',
    installCommand: 'npm install -g @openai/codex',
  },
  [LLM_TOOL_GEMINI_CLI]: {
    id: LLM_TOOL_GEMINI_CLI,
    displayName: 'Gemini CLI',
    description: 'Google Gemini CLI',
    installCommand: 'npm install -g @anthropic-ai/gemini-cli',
  },
  [LLM_TOOL_GITHUB_COPILOT]: {
    id: LLM_TOOL_GITHUB_COPILOT,
    displayName: 'GitHub Copilot',
    description: 'GitHub Copilot CLI',
    installCommand: 'npm install -g @github/copilot',
  },
} as const;

/**
 * Check if a string is a valid LLM tool identifier
 */
export function isValidLlmTool(tool: string): tool is LlmToolId {
  return SUPPORTED_LLM_TOOLS.includes(tool as LlmToolId);
}
