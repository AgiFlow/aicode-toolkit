/**
 * Tool Name Parser Utility
 *
 * DESIGN PATTERNS:
 * - Utility function pattern for reusable logic
 * - Single responsibility principle
 *
 * CODING STANDARDS:
 * - Parse tool names that may include server prefix
 * - Support format: {serverName}__{toolName} for disambiguating clashing tools
 * - Return plain tool name when no prefix present
 *
 * AVOID:
 * - Complex regex patterns
 * - Modifying input parameters
 */

export interface ParsedToolName {
  serverName?: string;
  actualToolName: string;
}

/**
 * Parse tool name to extract server and actual tool name
 * Supports both plain tool names and prefixed format: {serverName}__{toolName}
 *
 * @param toolName - The tool name to parse (e.g., "my_tool" or "server__my_tool")
 * @returns Parsed result with optional serverName and actualToolName
 *
 * @example
 * parseToolName("my_tool") // { actualToolName: "my_tool" }
 * parseToolName("server__my_tool") // { serverName: "server", actualToolName: "my_tool" }
 */
export function parseToolName(toolName: string): ParsedToolName {
  const separatorIndex = toolName.indexOf('__');
  if (separatorIndex > 0) {
    return {
      serverName: toolName.substring(0, separatorIndex),
      actualToolName: toolName.substring(separatorIndex + 2),
    };
  }
  return { actualToolName: toolName };
}
