/**
 * ClaudeCodeAdapter - Adapter for Claude Code hook format
 *
 * DESIGN PATTERNS:
 * - Adapter pattern: Converts Claude Code format to normalized format
 * - Parser pattern: Extracts file paths and operations from tool inputs
 *
 * CODING STANDARDS:
 * - Parse Claude Code JSON stdin format exactly as specified
 * - Format output to match Claude Code hook response schema
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
 * Claude Code hook input format
 */
interface ClaudeCodeHookInput {
  tool_name: string;
  tool_input: Record<string, any>;
  cwd: string;
  session_id: string;
  llm_tool?: string;
}

/**
 * Claude Code hook output format
 */
interface ClaudeCodeHookOutput {
  hookSpecificOutput: {
    hookEventName: string;
    permissionDecision: 'allow' | 'deny' | 'ask';
    permissionDecisionReason: string;
    updatedInput?: Record<string, any>;
  };
}

/**
 * Adapter for Claude Code hook format
 */
export class ClaudeCodeAdapter extends BaseAdapter {
  /**
   * Parse Claude Code stdin into normalized HookContext
   *
   * @param stdin - Raw JSON string from Claude Code
   * @returns Normalized hook context
   */
  parseInput(stdin: string): HookContext {
    const input = JSON.parse(stdin) as ClaudeCodeHookInput;

    return {
      toolName: input.tool_name,
      toolInput: input.tool_input,
      filePath: this.extractFilePath(input.tool_name, input.tool_input),
      operation: this.extractOperation(input.tool_name),
      cwd: input.cwd,
      sessionId: input.session_id,
      llmTool: input.llm_tool,
    };
  }

  /**
   * Format normalized HookResponse into Claude Code output
   *
   * @param response - Normalized hook response
   * @returns JSON string for Claude Code
   */
  formatOutput(response: HookResponse): string {
    // If decision is 'skip', return empty object (hook has nothing to say)
    if (response.decision === 'skip') {
      return JSON.stringify({}, null, 2);
    }

    const output: ClaudeCodeHookOutput = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: response.decision,
        permissionDecisionReason: response.message,
      },
    };

    // Add updated input if provided
    if (response.updatedInput) {
      output.hookSpecificOutput.updatedInput = response.updatedInput;
    }

    return JSON.stringify(output, null, 2);
  }

  /**
   * Extract file path from tool input
   *
   * @param toolName - Name of the tool
   * @param toolInput - Tool input parameters
   * @returns File path if this is a file operation
   */
  private extractFilePath(toolName: string, toolInput: any): string | undefined {
    // File operations have file_path parameter
    if (['Read', 'Write', 'Edit'].includes(toolName)) {
      return toolInput.file_path;
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
