/**
 * Shared TypeScript Types
 *
 * DESIGN PATTERNS:
 * - Type-first development
 * - Interface segregation
 *
 * CODING STANDARDS:
 * - Export all shared types from this file
 * - Use descriptive names for types and interfaces
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Tool definition for MCP
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

/**
 * Base tool interface following MCP SDK patterns
 */
export interface Tool<TInput = any> {
  getDefinition(): ToolDefinition;
  execute(input: TInput): Promise<CallToolResult>;
}
