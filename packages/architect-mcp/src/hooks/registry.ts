/**
 * Hook Callback Registry
 *
 * DESIGN PATTERNS:
 * - Registry pattern: Centralized registration of hook callbacks
 *
 * CODING STANDARDS:
 * - Export single registry object
 * - Use "AgentName.HookName" as keys
 *
 * AVOID:
 * - Mutating the registry after initialization
 */

import type { HookCallbackRegistry } from '@agiflowai/hooks-adapter';
import { preToolUseHook } from './claudeCode/preToolUse';
import { postToolUseHook } from './claudeCode/postToolUse';

/**
 * Registry of all hook callbacks for architect-mcp
 */
export const hookRegistry: HookCallbackRegistry = {
  'ClaudeCode.PreToolUse': preToolUseHook,
  'ClaudeCode.PostToolUse': postToolUseHook,
};
