/**
 * Shared type definitions for MCP tools
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
    additionalProperties: boolean;
  };
  _meta?: Record<string, unknown>;
}
