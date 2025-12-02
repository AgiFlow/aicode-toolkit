/**
 * AdapterProxyService - Routes hook execution to appropriate adapter and callback
 *
 * DESIGN PATTERNS:
 * - Proxy pattern: Routes requests to appropriate handlers
 * - Factory pattern: Creates adapter instances based on agent name
 * - Registry pattern: Accepts callback registry for extensibility
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

import { ClaudeCodeAdapter } from '../adapters/ClaudeCodeAdapter';
import { ClaudeCodePostToolUseAdapter } from '../adapters/ClaudeCodePostToolUseAdapter';
import type { BaseAdapter } from '../adapters/BaseAdapter';
import type { HookCallback } from '../types';

/**
 * Hook callback registry
 * Maps "AgentName.HookName" to callback function
 */
export type HookCallbackRegistry = Record<string, HookCallback>;

/**
 * Proxy service for routing hook execution
 * Eliminates duplication across commands by centralizing hook routing logic
 */
export class AdapterProxyService {
  /**
   * Execute hook mode: parse format, select adapter, select callback, execute
   *
   * @param hookFormat - Format: "AgentName.HookName" (e.g., "ClaudeCode.PreToolUse")
   * @param callbackRegistry - Registry of hook callbacks
   */
  static async execute(hookFormat: string, callbackRegistry: HookCallbackRegistry): Promise<void> {
    const [agentName, hookName] = hookFormat.split('.');

    if (!agentName || !hookName) {
      throw new Error('Invalid hook format. Use: AgentName.HookName (e.g., ClaudeCode.PreToolUse)');
    }

    // Select adapter based on agent name and hook type
    const adapter = AdapterProxyService.getAdapter(agentName, hookName);

    // Select hook callback from registry
    const callback = callbackRegistry[hookFormat];
    if (!callback) {
      throw new Error(
        `No callback registered for ${hookFormat}. Available: ${Object.keys(callbackRegistry).join(', ')}`,
      );
    }

    // Execute (reads stdin, calls callback, writes stdout)
    await adapter.execute(callback);
  }

  /**
   * Get adapter instance for agent and hook
   *
   * @param agentName - Name of the AI agent (e.g., "ClaudeCode")
   * @param hookName - Name of the hook (e.g., "PreToolUse", "PostToolUse")
   * @returns Adapter instance
   */
  private static getAdapter(agentName: string, hookName: string): BaseAdapter {
    const agentLower = agentName.toLowerCase();

    switch (agentLower) {
      case 'claudecode':
        // Use different adapters for different hooks
        if (hookName === 'PostToolUse') {
          return new ClaudeCodePostToolUseAdapter();
        }
        return new ClaudeCodeAdapter();
      default:
        throw new Error(`Unknown agent: ${agentName}. Supported: ClaudeCode`);
    }
  }
}
