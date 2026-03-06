import type { McpToolInfo } from '../types';

export const TOOL_CAPABILITIES_META_KEY = 'agiflowai/capabilities';

export function getToolCapabilities(tool: Pick<McpToolInfo, '_meta'>): string[] {
  const rawCapabilities = tool._meta?.[TOOL_CAPABILITIES_META_KEY];
  if (!Array.isArray(rawCapabilities)) {
    return [];
  }

  return rawCapabilities.filter((value): value is string => typeof value === 'string');
}

export function getUniqueSortedCapabilities(
  tools: Array<Pick<McpToolInfo, '_meta'>>,
): string[] {
  return Array.from(new Set(tools.flatMap((tool) => getToolCapabilities(tool)))).sort();
}
