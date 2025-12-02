/**
 * PreToolUse Hook for Claude Code
 *
 * DESIGN PATTERNS:
 * - Hook callback pattern: Executed before tool invocation
 * - Fail-open pattern: Errors allow operation to proceed with warning
 * - Single responsibility: Only handles design pattern retrieval
 *
 * CODING STANDARDS:
 * - Export named callback function matching HookCallback signature
 * - Handle all errors gracefully with fail-open behavior
 * - Format messages clearly for LLM consumption
 *
 * AVOID:
 * - Blocking operations on errors
 * - Complex business logic (delegate to tools/services)
 * - Mutating context object
 */

import type { HookCallback, HookContext, HookResponse } from '@agiflowai/hooks-adapter';
import { ExecutionLogService } from '@agiflowai/hooks-adapter';
import { GetFileDesignPatternTool } from '../../tools/GetFileDesignPatternTool';

/**
 * PreToolUse hook callback for Claude Code
 * Provides design patterns before file edit/write operations
 *
 * @param context - Normalized hook context
 * @returns Hook response with design patterns or error message
 */
export const preToolUseHook: HookCallback = async (
  context: HookContext,
): Promise<HookResponse> => {
  // Only process file operations
  if (!context.filePath) {
    return {
      decision: 'skip',
      message: 'Not a file operation',
    };
  }

  // Only process Edit/Write operations
  if (!['edit', 'write'].includes(context.operation || '')) {
    return {
      decision: 'skip',
      message: 'Not an edit operation',
    };
  }

  try {
    // Check if we already showed patterns for this file in this session
    const alreadyShown = await ExecutionLogService.hasExecuted(
      context.sessionId,
      context.filePath,
      'deny', // 'deny' means we showed patterns
    );

    if (alreadyShown) {
      // Already showed patterns - skip hook and let Claude continue normally
      await ExecutionLogService.logExecution(
        context.sessionId,
        context.filePath,
        context.operation || 'unknown',
        'skip',
      );

      return {
        decision: 'skip',
        message: 'Design patterns already provided for this file',
      };
    }

    // First edit - get design patterns and deny to show them to Claude
    const tool = new GetFileDesignPatternTool({
      llmTool: context.llmTool as any, // Type will be validated by the tool
    });
    const result = await tool.execute({ file_path: context.filePath });

    // Parse result
    const data = JSON.parse(result.content[0].text as string);

    if (result.isError) {
      // Error getting patterns - skip and let Claude continue
      await ExecutionLogService.logExecution(
        context.sessionId,
        context.filePath,
        context.operation || 'unknown',
        'skip',
      );

      return {
        decision: 'skip',
        message: `⚠️ Could not load design patterns: ${data.error}`,
      };
    }

    // Format patterns for LLM
    let message = 'You must follow these design patterns when editing/writing this file:\n\n';

    if (data.matched_patterns && data.matched_patterns.length > 0) {
      for (const pattern of data.matched_patterns) {
        message += `**${pattern.design_pattern}**\n${pattern.description}\n\n`;
      }
    } else {
      message += 'No specific patterns matched for this file.\n';
    }

    // Log that we showed patterns (decision: deny)
    await ExecutionLogService.logExecution(
      context.sessionId,
      context.filePath,
      context.operation || 'unknown',
      'deny',
    );

    // Return DENY so Claude sees the patterns
    // permissionDecisionReason is shown to Claude when decision is "deny"
    return {
      decision: 'deny',
      message,
    };
  } catch (error) {
    // Fail open: skip hook and let Claude continue
    return {
      decision: 'skip',
      message: `⚠️ Hook error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
