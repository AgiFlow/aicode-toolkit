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
import {
  ExecutionLogService,
  DECISION_SKIP,
  DECISION_DENY,
} from '@agiflowai/hooks-adapter';
import { GetFileDesignPatternTool } from '../../tools/GetFileDesignPatternTool';
import { TemplateFinder } from '../../services/TemplateFinder';
import { ArchitectParser } from '../../services/ArchitectParser';
import { PatternMatcher } from '../../services/PatternMatcher';

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
      decision: DECISION_SKIP,
      message: 'Not a file operation',
    };
  }

  try {
    // Get matched file patterns early for logging
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

    // If no patterns match, skip early
    if (!filePatterns) {
      return {
        decision: DECISION_SKIP,
        message: 'No design patterns configured for this file',
      };
    }

    // Check if we already showed patterns for this file in this session
    const alreadyShown = await ExecutionLogService.hasExecuted(
      context.sessionId,
      context.filePath,
      DECISION_DENY, // 'deny' means we showed patterns
    );

    if (alreadyShown) {
      // Already showed patterns - skip hook and let Claude continue normally
      await ExecutionLogService.logExecution({
        sessionId: context.sessionId,
        filePath: context.filePath,
        operation: context.operation || 'unknown',
        decision: DECISION_SKIP,
        filePattern: filePatterns,
      });

      return {
        decision: DECISION_SKIP,
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
      await ExecutionLogService.logExecution({
        sessionId: context.sessionId,
        filePath: context.filePath,
        operation: context.operation || 'unknown',
        decision: DECISION_SKIP,
        filePattern: filePatterns,
      });

      return {
        decision: DECISION_SKIP,
        message: `⚠️ Could not load design patterns: ${data.error}`,
      };
    }

    // If no patterns matched, skip and let Claude continue normally
    if (!data.matched_patterns || data.matched_patterns.length === 0) {
      return {
        decision: DECISION_SKIP,
        message: 'No specific patterns matched for this file',
      };
    }

    // Format patterns for LLM
    let message = 'You must follow these design patterns when editing/writing this file:\n\n';
    message += `**Matched file patterns:** ${filePatterns}\n\n`;

    for (const pattern of data.matched_patterns) {
      message += `**${pattern.design_pattern}**\n${pattern.description}\n\n`;
    }

    // Log that we showed patterns (decision: deny)
    await ExecutionLogService.logExecution({
      sessionId: context.sessionId,
      filePath: context.filePath,
      operation: context.operation || 'unknown',
      decision: DECISION_DENY,
      filePattern: filePatterns,
    });

    // Return DENY so Claude sees the patterns
    // permissionDecisionReason is shown to Claude when decision is "deny"
    return {
      decision: DECISION_DENY,
      message,
    };
  } catch (error) {
    // Fail open: skip hook and let Claude continue
    return {
      decision: DECISION_SKIP,
      message: `⚠️ Hook error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
