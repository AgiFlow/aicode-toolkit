/**
 * ClaudeCodePostToolUseAdapter - Adapter for Claude Code PostToolUse hook format
 *
 * DESIGN PATTERNS:
 * - Adapter pattern: Converts Claude Code PostToolUse format to normalized format
 * - Parser pattern: Extracts file paths and operations from tool response
 *
 * CODING STANDARDS:
 * - Parse Claude Code JSON stdin format exactly as specified
 * - Format output to match Claude Code PostToolUse hook response schema
 * - Handle missing/optional fields gracefully
 *
 * AVOID:
 * - Assuming all fields are present
 * - Hardcoding tool names (use constants if needed)
 * - Mutating input objects
 */

import { BaseAdapter } from './BaseAdapter';
import type { HookContext, HookResponse } from '../types';

/**
 * Claude Code PostToolUse hook input format
 */
interface ClaudeCodePostToolUseInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode: string;
  hook_event_name: 'PostToolUse';
  tool_name: string;
  tool_input: Record<string, any>;
  tool_response: Record<string, any>;
  tool_use_id: string;
  llm_tool?: string;
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
 * Adapter for Claude Code PostToolUse hook format
 */
export class ClaudeCodePostToolUseAdapter extends BaseAdapter {
  /**
   * Parse Claude Code PostToolUse stdin into normalized HookContext
   *
   * @param stdin - Raw JSON string from Claude Code
   * @returns Normalized hook context
   */
  parseInput(stdin: string): HookContext {
    const input = JSON.parse(stdin) as ClaudeCodePostToolUseInput;

    return {
      toolName: input.tool_name,
      toolInput: input.tool_input,
      filePath: this.extractFilePath(input.tool_name, input.tool_input, input.tool_response),
      operation: this.extractOperation(input.tool_name),
      cwd: input.cwd,
      sessionId: input.session_id,
      llmTool: input.llm_tool,
    };
  }

  /**
   * Format normalized HookResponse into Claude Code PostToolUse output
   *
   * @param response - Normalized hook response
   * @returns JSON string for Claude Code
   */
  formatOutput(response: HookResponse): string {
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

    return JSON.stringify(output, null, 2);
  }

  /**
   * Extract file path from tool input or response
   *
   * @param toolName - Name of the tool
   * @param toolInput - Tool input parameters
   * @param toolResponse - Tool response data
   * @returns File path if this is a file operation
   */
  private extractFilePath(toolName: string, toolInput: any, toolResponse: any): string | undefined {
    // File operations have file_path parameter in input
    if (['Read', 'Write', 'Edit'].includes(toolName)) {
      return toolInput.file_path || toolResponse.filePath;
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
