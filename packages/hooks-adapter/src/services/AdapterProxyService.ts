/**
 * AdapterProxyService - Routes hook execution to appropriate adapter
 *
 * DESIGN PATTERNS:
 * - Proxy pattern: Routes requests to appropriate handlers
 * - Factory pattern: Creates adapter instances based on agent name
 *
 * CODING STANDARDS:
 * - Use static methods for stateless operations
 * - Provide clear error messages for invalid inputs
 * - Follow TitleCase naming convention for service classes
 *
 * AVOID:
 * - Creating adapter instances unnecessarily
 * - Silently falling back to defaults
 * - Complex conditional logic (use lookup tables)
 */

import { CLAUDE_CODE } from '@agiflowai/coding-agent-bridge';
import { POST_TOOL_USE, type HookType } from '../constants';
import { ClaudeCodeAdapter } from '../adapters/ClaudeCodeAdapter';
import { ClaudeCodePostToolUseAdapter } from '../adapters/ClaudeCodePostToolUseAdapter';
import type { BaseAdapter } from '../adapters/BaseAdapter';
import type { HookCallback } from '../types';

/**
 * Proxy service for routing hook execution
 * Eliminates duplication across commands by centralizing hook routing logic
 */
export class AdapterProxyService {
  /**
   * Execute hook with the appropriate adapter for the agent
   *
   * @param agentName - Agent identifier (e.g., "claude-code")
   * @param hookType - Type of hook ("PreToolUse" or "PostToolUse")
   * @param callback - Hook callback function to execute
   */
  static async execute(
    agentName: string,
    hookType: HookType,
    callback: HookCallback,
  ): Promise<void> {
    const adapter = AdapterProxyService.getAdapter(agentName, hookType);
    await adapter.execute(callback);
  }

  /**
   * Get adapter instance for agent and hook type
   *
   * @param agentName - Name of the AI agent (e.g., "claude-code")
   * @param hookType - Type of hook ("PreToolUse" or "PostToolUse")
   * @returns Adapter instance
   */
  private static getAdapter(agentName: string, hookType: HookType): BaseAdapter {
    switch (agentName) {
      case CLAUDE_CODE:
        if (hookType === POST_TOOL_USE) {
          return new ClaudeCodePostToolUseAdapter();
        }
        return new ClaudeCodeAdapter();
      default:
        throw new Error(`Unknown agent: ${agentName}. Supported: ${CLAUDE_CODE}`);
    }
  }
}
