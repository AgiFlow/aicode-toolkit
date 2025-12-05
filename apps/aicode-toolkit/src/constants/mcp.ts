/**
 * MCP (Model Context Protocol) Server Constants
 *
 * DESIGN PATTERNS:
 * - Centralized constants for MCP server configuration
 * - Enum pattern for type-safe MCP server selection
 *
 * CODING STANDARDS:
 * - Use UPPER_CASE for constant values
 * - Document each constant with JSDoc comments
 */

/**
 * Available MCP servers
 */
export enum MCPServer {
  ONE_MCP = 'one-mcp',
  ARCHITECT = 'architect-mcp',
  SCAFFOLD = 'scaffold-mcp',
}

/**
 * MCP server configuration files
 * Maps each MCP server to its specific configuration files
 *
 * - one-mcp: Unified MCP server that includes all functionality
 * - architect-mcp: Only needs RULES.yaml and architect.yaml
 * - scaffold-mcp: Needs all other template files (excluding architect files)
 */
export const MCP_CONFIG_FILES = {
  [MCPServer.ONE_MCP]: [], // All files (same as scaffold-mcp + architect-mcp)
  [MCPServer.ARCHITECT]: ['RULES.yaml', 'architect.yaml'],
  [MCPServer.SCAFFOLD]: [], // All files except architect files
} as const;

/**
 * MCP server display names and descriptions for user prompts
 */
export const MCP_SERVER_INFO = {
  [MCPServer.ONE_MCP]: {
    name: 'One MCP (Recommended)',
    description: 'Progressive disclosed MCP that is token efficient and customizable',
  },
  [MCPServer.ARCHITECT]: {
    name: 'Architect MCP',
    description: 'Code review, design patterns, and coding standards enforcement',
  },
  [MCPServer.SCAFFOLD]: {
    name: 'Scaffold MCP',
    description: 'Project scaffolding, boilerplates, and feature generation',
  },
} as const;
