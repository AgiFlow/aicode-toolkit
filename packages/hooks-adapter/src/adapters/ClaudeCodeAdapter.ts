/**
 * ClaudeCodeAdapter - Unified adapter for Claude Code hook format
 *
 * DESIGN PATTERNS:
 * - Adapter pattern: Converts Claude Code format to normalized format
 * - Parser pattern: Extracts file paths and operations from tool inputs
 * - State pattern: Stores hook event type to morph behavior between hook events
 *
 * CODING STANDARDS:
 * - Parse Claude Code JSON stdin format exactly as specified
 * - Format output to match Claude Code hook response schema
 * - Handle missing/optional fields gracefully
 * - Support PreToolUse, PostToolUse, Stop, UserPromptSubmit, TaskCompleted events
 *
 * AVOID:
 * - Assuming all fields are present
 * - Hardcoding tool names (use constants if needed)
 * - Mutating input objects
 */

import { BaseAdapter } from './BaseAdapter';
import type { HookResponse } from '../types';
import { log } from '@agiflowai/aicode-utils';

/**
 * Common fields shared by all Claude Code hook inputs
 */
interface ClaudeCodeCommonFields {
  cwd: string;
  session_id: string;
  transcript_path: string;
  permission_mode: string;
}

/**
 * Claude Code hook input format (PreToolUse)
 */
export interface ClaudeCodePreToolUseInput extends ClaudeCodeCommonFields {
  hook_event_name: 'PreToolUse';
  tool_name: string;
  tool_input: Record<string, any>;
  tool_use_id: string;
  llm_tool?: string;
  tool_config?: Record<string, unknown>;
}

/**
 * Claude Code hook input format (PostToolUse)
 */
export interface ClaudeCodePostToolUseInput extends ClaudeCodeCommonFields {
  hook_event_name: 'PostToolUse';
  tool_name: string;
  tool_input: Record<string, any>;
  tool_response: Record<string, any>;
  tool_use_id: string;
  llm_tool?: string;
  tool_config?: Record<string, unknown>;
}

/**
 * Claude Code hook input format (Stop)
 */
export interface ClaudeCodeStopInput extends ClaudeCodeCommonFields {
  hook_event_name: 'Stop';
  stop_hook_active: boolean;
  last_assistant_message: string;
}

/**
 * Claude Code hook input format (UserPromptSubmit)
 */
export interface ClaudeCodeUserPromptSubmitInput extends ClaudeCodeCommonFields {
  hook_event_name: 'UserPromptSubmit';
  prompt: string;
}

/**
 * Claude Code hook input format (TaskCompleted)
 */
export interface ClaudeCodeTaskCompletedInput extends ClaudeCodeCommonFields {
  hook_event_name: 'TaskCompleted';
  task_id: string;
  task_subject: string;
  task_description: string;
}

/**
 * Union type for all hook input formats
 */
export type ClaudeCodeHookInput =
  | ClaudeCodePreToolUseInput
  | ClaudeCodePostToolUseInput
  | ClaudeCodeStopInput
  | ClaudeCodeUserPromptSubmitInput
  | ClaudeCodeTaskCompletedInput;

/**
 * Claude Code PreToolUse hook output format
 */
interface ClaudeCodePreToolUseOutput {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse';
    permissionDecision: 'allow' | 'deny' | 'ask';
    permissionDecisionReason: string;
    updatedInput?: Record<string, any>;
    additionalContext?: string;
  };
}

/**
 * Claude Code PostToolUse hook output format
 */
interface ClaudeCodePostToolUseOutput {
  decision?: 'block';
  reason?: string;
  hookSpecificOutput: {
    hookEventName: 'PostToolUse';
    additionalContext?: string;
  };
}

/**
 * Claude Code blockable hook output format (Stop, UserPromptSubmit, TaskCompleted)
 */
interface ClaudeCodeBlockableOutput {
  decision?: 'block';
  reason?: string;
}

/**
 * Blockable hook event names
 */
const BLOCKABLE_EVENTS = new Set(['Stop', 'UserPromptSubmit', 'TaskCompleted']);

/**
 * Unified adapter for Claude Code hook format
 */
export class ClaudeCodeAdapter extends BaseAdapter<ClaudeCodeHookInput> {
  private hookEventName: string = 'PreToolUse';

  /**
   * Parse Claude Code stdin into ClaudeCodeHookInput
   *
   * @param stdin - Raw JSON string from Claude Code
   * @returns ClaudeCodeHookInput
   */
  parseInput(stdin: string): ClaudeCodeHookInput {
    log.debug('ClaudeCodeAdapter: Parsing input', { stdin });

    const input = JSON.parse(stdin) as ClaudeCodeHookInput;

    // Store hook event type for use in formatOutput
    this.hookEventName = input.hook_event_name;

    log.debug('ClaudeCodeAdapter: Parsed input', {
      hookEventName: this.hookEventName,
      input,
    });

    return input;
  }

  /**
   * Format normalized HookResponse into Claude Code output
   * Morphs output based on hook event type
   *
   * @param response - Normalized hook response
   * @returns JSON string for Claude Code
   */
  formatOutput(response: HookResponse): string {
    log.debug('ClaudeCodeAdapter: Formatting output', {
      hookEventName: this.hookEventName,
      response,
    });

    // If decision is 'skip', return empty object (hook has nothing to say)
    if (response.decision === 'skip') {
      const emptyOutput = JSON.stringify({}, null, 2);
      log.debug('ClaudeCodeAdapter: Skip decision, returning empty output');
      return emptyOutput;
    }

    // Route to blockable output for Stop/UserPromptSubmit/TaskCompleted
    if (BLOCKABLE_EVENTS.has(this.hookEventName)) {
      return this.formatBlockableOutput(response);
    }

    // Format based on hook event type
    if (this.hookEventName === 'PostToolUse') {
      return this.formatPostToolUseOutput(response);
    }

    return this.formatPreToolUseOutput(response);
  }

  /**
   * Format PreToolUse output
   */
  private formatPreToolUseOutput(response: HookResponse): string {
    const output: ClaudeCodePreToolUseOutput = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: response.decision as 'allow' | 'deny' | 'ask',
        permissionDecisionReason: response.message,
      },
    };

    // Add updated input if provided
    if (response.updatedInput) {
      output.hookSpecificOutput.updatedInput = response.updatedInput;
    }

    // Include additional context if we want to provide feedback without blocking
    if (response.decision === 'allow' && response.message) {
      output.hookSpecificOutput.additionalContext = response.message;
    }

    const formattedOutput = JSON.stringify(output, null, 2);
    log.debug('ClaudeCodeAdapter: Formatted PreToolUse output', { output: formattedOutput });

    return formattedOutput;
  }

  /**
   * Format PostToolUse output
   */
  private formatPostToolUseOutput(response: HookResponse): string {
    const output: ClaudeCodePostToolUseOutput = {
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
      },
    };

    // Only include decision and reason if decision is 'deny' (maps to 'block' for PostToolUse)
    if (response.decision === 'deny') {
      output.decision = 'block';
      output.reason = response.message;
    }

    // Include additional context if we want to provide feedback without blocking
    if (response.decision === 'allow' && response.message) {
      output.hookSpecificOutput.additionalContext = response.message;
    }

    const formattedOutput = JSON.stringify(output, null, 2);
    log.debug('ClaudeCodeAdapter: Formatted PostToolUse output', { output: formattedOutput });

    return formattedOutput;
  }

  /**
   * Format blockable output for Stop, UserPromptSubmit, and TaskCompleted hooks
   * Maps 'deny' decision to 'block', otherwise returns empty object
   */
  formatBlockableOutput(response: HookResponse): string {
    const output: ClaudeCodeBlockableOutput = {};

    if (response.decision === 'deny') {
      output.decision = 'block';
      output.reason = response.message;
    }

    const formattedOutput = JSON.stringify(output, null, 2);
    log.debug(`ClaudeCodeAdapter: Formatted ${this.hookEventName} output`, {
      output: formattedOutput,
    });

    return formattedOutput;
  }
}
