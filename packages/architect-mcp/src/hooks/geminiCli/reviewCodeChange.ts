/**
 * ReviewCodeChange Hooks for Gemini CLI
 *
 * DESIGN PATTERNS:
 * - Hook callback pattern: Multiple lifecycle hooks in single file
 * - Fail-open pattern: Errors don't block, just provide warnings
 * - Single responsibility: Each hook handles specific lifecycle stage
 *
 * CODING STANDARDS:
 * - Export named callbacks: beforeToolHook, afterToolHook
 * - Handle all errors gracefully with fail-open behavior
 * - Format messages clearly for LLM consumption
 *
 * AVOID:
 * - Blocking operations on errors
 * - Complex business logic (delegate to tools/services)
 * - Mutating context object
 */

import type { HookCallback, HookContext, HookResponse } from '@agiflowai/hooks-adapter';
import {
  ExecutionLogService,
  DECISION_SKIP,
  DECISION_DENY,
  DECISION_ALLOW,
} from '@agiflowai/hooks-adapter';
import { ReviewCodeChangeTool } from '../../tools/ReviewCodeChangeTool';
import { TemplateFinder } from '../../services/TemplateFinder';
import { ArchitectParser } from '../../services/ArchitectParser';
import { PatternMatcher } from '../../services/PatternMatcher';

/**
 * BeforeTool hook - not applicable for reviewCodeChange
 * This tool is only called after file operations
 */
export const beforeToolHook: HookCallback = async (): Promise<HookResponse> => {
  return {
    decision: DECISION_SKIP,
    message: 'BeforeTool not applicable for reviewCodeChange',
  };
};

/**
 * AfterTool hook callback for Gemini CLI
 * Reviews code after file edit/write operations and provides feedback
 *
 * @param context - Normalized hook context
 * @returns Hook response with code review feedback or skip
 */
export const afterToolHook: HookCallback = async (
  context: HookContext,
): Promise<HookResponse> => {
  // Only process file operations
  if (!context.filePath) {
    return {
      decision: DECISION_SKIP,
      message: 'Not a file operation',
    };
  }

  try {
    // Check if file was recently reviewed (debounce within 3 seconds)
    const wasRecent = await ExecutionLogService.wasRecentlyReviewed(
      context.sessionId,
      context.filePath,
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

    const templateMapping = await templateFinder.findTemplateForFile(context.filePath);
    const templateConfig = templateMapping
      ? await architectParser.parseArchitectFile(templateMapping.templatePath)
      : null;
    const globalConfig = await architectParser.parseGlobalArchitectFile();

    const filePatterns = patternMatcher.getMatchedFilePatterns(
      context.filePath,
      templateConfig,
      globalConfig,
      templateMapping?.projectPath,
    );

    // Get current file metadata for change detection
    const fileMetadata = await ExecutionLogService.getFileMetadata(context.filePath);

    // Check if file has changed since last review (skip if unchanged)
    const fileChanged = await ExecutionLogService.hasFileChanged(
      context.sessionId,
      context.filePath,
      DECISION_ALLOW, // Check against last successful review
    );

    if (!fileChanged) {
      return {
        decision: DECISION_SKIP,
        message: 'File unchanged since last review',
      };
    }

    // Execute: Review the code change
    const tool = new ReviewCodeChangeTool({
      llmTool: context.llmTool as any, // Type will be validated by the tool
    });
    const result = await tool.execute({ file_path: context.filePath });

    // Parse result
    const data = JSON.parse(result.content[0].text as string);

    if (result.isError) {
      // Error reviewing code - skip and let Gemini continue
      await ExecutionLogService.logExecution({
        sessionId: context.sessionId,
        filePath: context.filePath,
        operation: context.operation || 'unknown',
        decision: DECISION_SKIP,
        filePattern: filePatterns,
        fileMtime: fileMetadata?.mtime,
        fileChecksum: fileMetadata?.checksum,
      });

      return {
        decision: DECISION_SKIP,
        message: `⚠️ Could not review code: ${data.error}`,
      };
    }

    // If fixes are required (must_do or must_not_do violations), block with full response
    if (data.fix_required) {
      await ExecutionLogService.logExecution({
        sessionId: context.sessionId,
        filePath: context.filePath,
        operation: context.operation || 'unknown',
        decision: DECISION_DENY,
        filePattern: filePatterns,
        fileMtime: fileMetadata?.mtime,
        fileChecksum: fileMetadata?.checksum,
      });

      // For Gemini CLI AfterTool hooks, deny will block and show message
      return {
        decision: DECISION_DENY,
        message: JSON.stringify(data, null, 2), // Full AI response
      };
    }

    // Otherwise (no fix required), provide feedback and issues without blocking
    // decision: 'allow' provides context to Gemini without blocking
    await ExecutionLogService.logExecution({
      sessionId: context.sessionId,
      filePath: context.filePath,
      operation: context.operation || 'unknown',
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
};
