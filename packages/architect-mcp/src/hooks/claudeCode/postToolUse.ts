/**
 * PostToolUse Hook for Claude Code
 *
 * DESIGN PATTERNS:
 * - Hook callback pattern: Executed after tool invocation
 * - Fail-open pattern: Errors don't block, just provide warnings
 * - Single responsibility: Only handles code review after edits
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
import { ReviewCodeChangeTool } from '../../tools/ReviewCodeChangeTool';

/**
 * PostToolUse hook callback for Claude Code
 * Reviews code after file edit/write operations and provides feedback
 *
 * @param context - Normalized hook context
 * @returns Hook response with code review feedback or skip
 */
export const postToolUseHook: HookCallback = async (
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
    // Execute: Review the code change
    const tool = new ReviewCodeChangeTool({
      llmTool: context.llmTool as any, // Type will be validated by the tool
    });
    const result = await tool.execute({ file_path: context.filePath });

    // Parse result
    const data = JSON.parse(result.content[0].text as string);

    if (result.isError) {
      // Error reviewing code - skip and let Claude continue
      return {
        decision: 'skip',
        message: `⚠️ Could not review code: ${data.error}`,
      };
    }

    // If fixes are required (must_do or must_not_do violations), block with full response
    if (data.fix_required) {
      return {
        decision: 'deny', // Will map to 'block' in PostToolUse output
        message: JSON.stringify(data, null, 2), // Full AI response
      };
    }

    // Otherwise (no fix required), provide feedback and issues without blocking
    // decision: 'allow' means additionalContext is used, not blocking
    return {
      decision: 'allow',
      message: JSON.stringify({
        feedback: data.review_feedback,
        identified_issues: data.issues_found,
      }, null, 2),
    };
  } catch (error) {
    // Fail open: skip hook and let Claude continue
    return {
      decision: 'skip',
      message: `⚠️ Hook error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
