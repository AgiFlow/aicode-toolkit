/**
 * CodexAdapter - Adapter for OpenAI Codex CLI hook format
 *
 * DESIGN PATTERNS:
 * - Adapter pattern: Converts Codex CLI hook format to normalized format
 * - Reuse over duplication: Codex's hook wire contract matches Claude Code's, so
 *   this extends ClaudeCodeAdapter rather than re-implementing the same I/O
 *
 * WHY THIS MIRRORS CLAUDE CODE:
 * Codex CLI's hook system uses the same event names (PreToolUse, PostToolUse,
 * Stop, UserPromptSubmit), the same stdin fields (cwd, session_id, tool_name,
 * tool_input, tool_use_id, permission_mode, hook_event_name), and the same stdout
 * shape (`hookSpecificOutput.permissionDecision: 'allow' | 'deny' | 'ask'`).
 * The differences are payload-level, not wire-level: Codex adds turn_id/model and
 * creates files via the `apply_patch` tool (the patch lives in tool_input.command),
 * which the scaffold-mcp hook handles — not this adapter.
 *
 * AVOID:
 * - Re-implementing parsing/formatting that ClaudeCodeAdapter already provides
 */

import { ClaudeCodeAdapter } from './ClaudeCodeAdapter';
import type { ClaudeCodeHookInput } from './ClaudeCodeAdapter';

/**
 * Codex CLI hook input. Structurally identical to the Claude Code hook input on the
 * wire (Codex additionally sends `turn_id`/`model`, which the scaffold hook does not
 * read), so it reuses {@link ClaudeCodeHookInput}.
 */
export type CodexHookInput = ClaudeCodeHookInput;

/**
 * Adapter for OpenAI Codex CLI hooks. Codex's hook stdin/stdout contract matches
 * Claude Code's, so parsing and response formatting are inherited verbatim from
 * {@link ClaudeCodeAdapter}.
 */
export class CodexAdapter extends ClaudeCodeAdapter {}
