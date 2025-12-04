/**
 * ReviewCodeChange Hooks for Claude Code
 *
 * DESIGN PATTERNS:
 * - Hook callback pattern: Multiple lifecycle hooks in single file
 * - Fail-open pattern: Errors don't block, just provide warnings
 * - Single responsibility: Each hook handles specific lifecycle stage
 *
 * CODING STANDARDS:
 * - Export named callbacks: preToolUseHook, postToolUseHook
 * - Handle all errors gracefully with fail-open behavior
 * - Format messages clearly for LLM consumption
 *
 * AVOID:
 * - Blocking operations on errors
 * - Complex business logic (delegate to tools/services)
 * - Mutating context object
 */

import type { ClaudeCodeHookInput, HookResponse } from '@agiflowai/hooks-adapter';
import {
  ExecutionLogService,
  DECISION_SKIP,
  DECISION_DENY,
  DECISION_ALLOW,
} from '@agiflowai/hooks-adapter';
import { CLAUDE_CODE, isValidLlmTool, type LlmToolId } from '@agiflowai/coding-agent-bridge';
import { CodeReviewService } from '../../services/CodeReviewService';
import { TemplateFinder } from '../../services/TemplateFinder';
import { ArchitectParser } from '../../services/ArchitectParser';
import { PatternMatcher } from '../../services/PatternMatcher';

/**
 * PreToolUse hook - not applicable for reviewCodeChange
 * This tool is only called after file operations
 */
export const preToolUseHook = async (): Promise<HookResponse> => {
  return {
    decision: DECISION_SKIP,
    message: 'PreToolUse not applicable for reviewCodeChange',
  };
};

/**
 * PostToolUse hook callback for Claude Code
 * Reviews code after file edit/write operations and provides feedback
 *
 * @param context - Normalized hook context
 * @returns Hook response with code review feedback or skip
 */
export const postToolUseHook = async (
  context: ClaudeCodeHookInput,
): Promise<HookResponse> => {
  // Extract file path from tool input
  const filePath = context.tool_input?.file_path;

  // Only process file operations
  if (!filePath) {
    return {
      decision: DECISION_SKIP,
      message: 'Not a file operation',
    };
  }

  try {
    // Check if file was recently reviewed (debounce within 3 seconds)
    const wasRecent = await ExecutionLogService.wasRecentlyReviewed(
      context.session_id,
      filePath,
      3000, // 3 seconds debounce
    );

    if (wasRecent) {
      return {
        decision: DECISION_SKIP,
        message: 'File was recently reviewed (within 3 seconds), skipping to avoid noise',
      };
    }

    // Get matched file patterns for logging
    const templateFinder = new TemplateFinder();
    const architectParser = new ArchitectParser();
    const patternMatcher = new PatternMatcher();

    const templateMapping = await templateFinder.findTemplateForFile(filePath);
    const templateConfig = templateMapping
      ? await architectParser.parseArchitectFile(templateMapping.templatePath)
      : null;
    const globalConfig = await architectParser.parseGlobalArchitectFile();

    const filePatterns = patternMatcher.getMatchedFilePatterns(
      filePath,
      templateConfig,
      globalConfig,
      templateMapping?.projectPath,
    );

    // Get current file metadata for change detection
    const fileMetadata = await ExecutionLogService.getFileMetadata(filePath);

    // Derive operation from tool name
    const operation = extractOperation(context.tool_name);

    // Check if file has changed since last review (skip if unchanged)
    const fileChanged = await ExecutionLogService.hasFileChanged(
      context.session_id,
      filePath,
      DECISION_ALLOW, // Check against last successful review
    );

    if (!fileChanged) {
      return {
        decision: DECISION_SKIP,
        message: 'File unchanged since last review',
      };
    }

    // Execute: Review the code change using service directly
    // Validate and use context.llm_tool if provided, otherwise fallback to CLAUDE_CODE constant
    let llmTool: LlmToolId = CLAUDE_CODE;
    if (context.llm_tool && isValidLlmTool(context.llm_tool)) {
      llmTool = context.llm_tool;
    }

    const service = new CodeReviewService({ llmTool });
    const data = await service.reviewCodeChange(filePath);

    // If fixes are required (must_do or must_not_do violations), block with full response
    if (data.fix_required) {
      await ExecutionLogService.logExecution({
        sessionId: context.session_id,
        filePath: filePath,
        operation: operation,
        decision: DECISION_DENY,
        filePattern: filePatterns,
        fileMtime: fileMetadata?.mtime,
        fileChecksum: fileMetadata?.checksum,
      });

      return {
        decision: DECISION_DENY, // Will map to 'block' in PostToolUse output
        message: JSON.stringify(data, null, 2), // Full AI response
      };
    }

    // Otherwise (no fix required), provide feedback and issues without blocking
    // decision: 'allow' means additionalContext is used, not blocking
    await ExecutionLogService.logExecution({
      sessionId: context.session_id,
      filePath: filePath,
      operation: operation,
      decision: DECISION_ALLOW,
      filePattern: filePatterns,
      fileMtime: fileMetadata?.mtime,
      fileChecksum: fileMetadata?.checksum,
    });

    return {
      decision: DECISION_ALLOW,
      message: JSON.stringify(
        {
          feedback: data.feedback,
          identified_issues: data.identified_issues,
        },
        null,
        2,
      ),
    };
  } catch (error) {
    // Fail open: skip hook and let Claude continue
    return {
      decision: DECISION_SKIP,
      message: `⚠️ Hook error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * Extract operation type from tool name
 */
function extractOperation(toolName: string): string {
  if (toolName === 'Edit' || toolName === 'Update') return 'edit';
  if (toolName === 'Write') return 'write';
  if (toolName === 'Read') return 'read';
  return 'unknown';
}
