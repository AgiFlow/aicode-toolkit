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
import { ExecutionLogService } from '@agiflowai/hooks-adapter';
import { ReviewCodeChangeTool } from '../../tools/ReviewCodeChangeTool';
import { TemplateFinder } from '../../services/TemplateFinder';
import { ArchitectParser } from '../../services/ArchitectParser';
import { PatternMatcher } from '../../services/PatternMatcher';

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

  try {
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
      'allow', // Check against last successful review
    );

    if (!fileChanged) {
      return {
        decision: 'skip',
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
      // Error reviewing code - skip and let Claude continue
      await ExecutionLogService.logExecution({
        sessionId: context.sessionId,
        filePath: context.filePath,
        operation: context.operation || 'unknown',
        decision: 'skip',
        filePattern: filePatterns,
        fileMtime: fileMetadata?.mtime,
        fileChecksum: fileMetadata?.checksum,
      });

      return {
        decision: 'skip',
        message: `⚠️ Could not review code: ${data.error}`,
      };
    }

    // If fixes are required (must_do or must_not_do violations), block with full response
    if (data.fix_required) {
      await ExecutionLogService.logExecution({
        sessionId: context.sessionId,
        filePath: context.filePath,
        operation: context.operation || 'unknown',
        decision: 'deny',
        filePattern: filePatterns,
        fileMtime: fileMetadata?.mtime,
        fileChecksum: fileMetadata?.checksum,
      });

      return {
        decision: 'deny', // Will map to 'block' in PostToolUse output
        message: JSON.stringify(data, null, 2), // Full AI response
      };
    }

    // Otherwise (no fix required), provide feedback and issues without blocking
    // decision: 'allow' means additionalContext is used, not blocking
    await ExecutionLogService.logExecution({
      sessionId: context.sessionId,
      filePath: context.filePath,
      operation: context.operation || 'unknown',
      decision: 'allow',
      filePattern: filePatterns,
      fileMtime: fileMetadata?.mtime,
      fileChecksum: fileMetadata?.checksum,
    });

    return {
      decision: 'allow',
      message: JSON.stringify({
        feedback: data.feedback,
        identified_issues: data.identified_issues,
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
