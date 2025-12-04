/**
 * ReviewCodeChange Hook for Gemini CLI
 *
 * DESIGN PATTERNS:
 * - Class-based hook pattern: Encapsulates lifecycle hooks in a single class
 * - Fail-open pattern: Errors don't block, just provide warnings
 * - Single responsibility: Each hook handles specific lifecycle stage
 *
 * CODING STANDARDS:
 * - Export a class with preToolUse, postToolUse methods
 * - Handle all errors gracefully with fail-open behavior
 * - Format messages clearly for LLM consumption
 *
 * AVOID:
 * - Blocking operations on errors
 * - Complex business logic (delegate to tools/services)
 * - Mutating context object
 */

import type { GeminiCliHookInput, HookResponse } from '@agiflowai/hooks-adapter';
import {
  ExecutionLogService,
  DECISION_SKIP,
  DECISION_DENY,
  DECISION_ALLOW,
} from '@agiflowai/hooks-adapter';
import { isValidLlmTool, type LlmToolId } from '@agiflowai/coding-agent-bridge';
import { CodeReviewService } from '../../services/CodeReviewService';
import { TemplateFinder } from '../../services/TemplateFinder';
import { ArchitectParser } from '../../services/ArchitectParser';
import { PatternMatcher } from '../../services/PatternMatcher';

/**
 * ReviewCodeChange Hook class for Gemini CLI
 *
 * Provides lifecycle hooks for tool execution:
 * - preToolUse: Not applicable for this hook (returns skip)
 * - postToolUse: Reviews code after file edit/write operations
 */
export class ReviewCodeChangeHook {
  /**
   * PreToolUse hook - not applicable for reviewCodeChange
   * This tool is only called after file operations
   *
   * @param _context - Gemini CLI hook input (unused)
   * @returns Hook response with skip decision
   */
  async preToolUse(_context: GeminiCliHookInput): Promise<HookResponse> {
    return {
      decision: DECISION_SKIP,
      message: 'PreToolUse not applicable for reviewCodeChange',
    };
  }

  /**
   * PostToolUse hook for Gemini CLI
   * Reviews code after file edit/write operations and provides feedback
   *
   * @param context - Gemini CLI hook input
   * @returns Hook response with code review feedback or skip
   */
  async postToolUse(context: GeminiCliHookInput): Promise<HookResponse> {
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
      // Create execution log service for this session
      const executionLog = new ExecutionLogService(context.session_id);

      // Check if file was recently reviewed (debounce within 3 seconds)
      const wasRecent = await executionLog.wasRecentlyReviewed(
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
      const fileMetadata = await executionLog.getFileMetadata(filePath);

      // Derive operation from tool name
      const operation = extractOperation(context.tool_name);

      // Check if file has changed since last review (skip if unchanged)
      const fileChanged = await executionLog.hasFileChanged(
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
      // Validate llm_tool from context
      let llmTool: LlmToolId | undefined;
      if (context.llm_tool && isValidLlmTool(context.llm_tool)) {
        llmTool = context.llm_tool;
      }

      const service = new CodeReviewService({ llmTool });
      const data = await service.reviewCodeChange(filePath);

      // If fixes are required (must_do or must_not_do violations), block with full response
      if (data.fix_required) {
        await executionLog.logExecution({
          filePath: filePath,
          operation: operation,
          decision: DECISION_DENY,
          filePattern: filePatterns,
          fileMtime: fileMetadata?.mtime,
          fileChecksum: fileMetadata?.checksum,
        });

        // For Gemini CLI PostToolUse hooks, deny will block and show message
        return {
          decision: DECISION_DENY,
          message: JSON.stringify(data, null, 2), // Full AI response
        };
      }

      // Otherwise (no fix required), provide feedback and issues without blocking
      // decision: 'allow' provides context to Gemini without blocking
      await executionLog.logExecution({
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
      // Fail open: skip hook and let Gemini continue
      return {
        decision: DECISION_SKIP,
        message: `⚠️ Hook error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

/**
 * Extract operation type from tool name
 */
function extractOperation(toolName: string): string {
  const lowerToolName = toolName.toLowerCase();
  if (lowerToolName === 'edit' || lowerToolName === 'update') return 'edit';
  if (lowerToolName === 'write') return 'write';
  if (lowerToolName === 'read') return 'read';
  return 'unknown';
}
