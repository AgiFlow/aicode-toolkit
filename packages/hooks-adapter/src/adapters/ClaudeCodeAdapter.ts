/**
 * ClaudeCodeAdapter - Unified adapter for Claude Code hook format (PreToolUse & PostToolUse)
 *
 * DESIGN PATTERNS:
 * - Adapter pattern: Converts Claude Code format to normalized format
 * - Parser pattern: Extracts file paths and operations from tool inputs
 * - State pattern: Stores hook event type to morph behavior between PreToolUse and PostToolUse
 *
 * CODING STANDARDS:
 * - Parse Claude Code JSON stdin format exactly as specified
 * - Format output to match Claude Code hook response schema
 * - Handle missing/optional fields gracefully
 * - Support both PreToolUse and PostToolUse events in one adapter
 *
 * AVOID:
 * - Assuming all fields are present
 * - Hardcoding tool names (use constants if needed)
 * - Mutating input objects
 */

import { BaseAdapter } from './BaseAdapter';
import type { HookContext, HookResponse } from '../types';
import { log } from '@agiflowai/aicode-utils';

/**
 * Claude Code hook input format (PreToolUse)
 */
interface ClaudeCodePreToolUseInput {
  tool_name: string;
  tool_input: Record<string, any>;
  cwd: string;
  session_id: string;
  hook_event_name: 'PreToolUse';
  tool_use_id: string;
  llm_tool?: string;
}

/**
 * Claude Code hook input format (PostToolUse)
 */
interface ClaudeCodePostToolUseInput {
  tool_name: string;
  tool_input: Record<string, any>;
  tool_response: Record<string, any>;
  cwd: string;
  session_id: string;
  hook_event_name: 'PostToolUse';
  tool_use_id: string;
  transcript_path: string;
  permission_mode: string;
  llm_tool?: string;
}

/**
 * Union type for both hook input formats
 */
type ClaudeCodeHookInput = ClaudeCodePreToolUseInput | ClaudeCodePostToolUseInput;

/**
 * Claude Code PreToolUse hook output format
 */
interface ClaudeCodePreToolUseOutput {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse';
    permissionDecision: 'allow' | 'deny' | 'ask';
    permissionDecisionReason: string;
    updatedInput?: Record<string, any>;
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
 * Unified adapter for Claude Code hook format (PreToolUse & PostToolUse)
 */
export class ClaudeCodeAdapter extends BaseAdapter {
  private hookEventName: 'PreToolUse' | 'PostToolUse' = 'PreToolUse';

  /**
   * Parse Claude Code stdin into normalized HookContext
   *
   * @param stdin - Raw JSON string from Claude Code
   * @returns Normalized hook context
   */
  parseInput(stdin: string): HookContext {
    log.debug('ClaudeCodeAdapter: Parsing input', { stdin });

    const input = JSON.parse(stdin) as ClaudeCodeHookInput;

    // Store hook event type for use in formatOutput
    this.hookEventName = input.hook_event_name;

    // Extract tool_response if this is PostToolUse
    const toolResponse =
      this.hookEventName === 'PostToolUse'
        ? (input as ClaudeCodePostToolUseInput).tool_response
        : undefined;

    const context: HookContext = {
      toolName: input.tool_name,
      toolInput: input.tool_input,
      filePath: this.extractFilePath(input.tool_name, input.tool_input, toolResponse),
      operation: this.extractOperation(input.tool_name),
      cwd: input.cwd,
      sessionId: input.session_id,
      llmTool: input.llm_tool,
    };

    log.debug('ClaudeCodeAdapter: Parsed context', {
      hookEventName: this.hookEventName,
      context,
    });

    return context;
  }

  /**
   * Format normalized HookResponse into Claude Code output
   * Morphs output based on hook event type (PreToolUse vs PostToolUse)
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
   * Extract file path from tool input or response
   *
   * @param toolName - Name of the tool
   * @param toolInput - Tool input parameters
   * @param toolResponse - Tool response data (for PostToolUse)
   * @returns File path if this is a file operation
   */
  private extractFilePath(
    toolName: string,
    toolInput: any,
    toolResponse?: any,
  ): string | undefined {
    // File operations have file_path parameter
    if (['Read', 'Write', 'Edit'].includes(toolName)) {
      return toolInput.file_path || toolResponse?.filePath;
    }

    return undefined;
  }

  /**
   * Extract operation type from tool name
   *
   * @param toolName - Name of the tool
   * @returns Operation type if this is a file operation
   */
  private extractOperation(toolName: string): 'read' | 'write' | 'edit' | undefined {
    const operationMap: Record<string, 'read' | 'write' | 'edit'> = {
      Read: 'read',
      Write: 'write',
      Edit: 'edit',
    };

    return operationMap[toolName];
  }
}
