/**
 * GetFileDesignPattern Hooks for Gemini CLI
 *
 * DESIGN PATTERNS:
 * - Hook callback pattern: Multiple lifecycle hooks in single file
 * - Fail-open pattern: Errors allow operation to proceed with warning
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
import { ExecutionLogService, DECISION_SKIP, DECISION_DENY } from '@agiflowai/hooks-adapter';
import { GetFileDesignPatternTool } from '../../tools/GetFileDesignPatternTool';
import { TemplateFinder } from '../../services/TemplateFinder';
import { ArchitectParser } from '../../services/ArchitectParser';
import { PatternMatcher } from '../../services/PatternMatcher';

/**
 * BeforeTool hook callback for Gemini CLI
 * Provides design patterns before file edit/write operations
 *
 * @param context - Normalized hook context
 * @returns Hook response with design patterns or skip decision
 */
export const beforeToolHook: HookCallback = async (
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
      // Already showed patterns - skip hook and let Gemini continue normally
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

    // First edit - get design patterns and deny to show them to Gemini
    const tool = new GetFileDesignPatternTool({
      llmTool: context.llmTool as any, // Type will be validated by the tool
    });
    const result = await tool.execute({ file_path: context.filePath });

    // Parse result
    const data = JSON.parse(result.content[0].text as string);

    if (result.isError) {
      // Error getting patterns - skip and let Gemini continue
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

    // If no patterns matched, skip and let Gemini continue normally
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

    // Return DENY so Gemini sees the patterns
    // In Gemini CLI, this will block the tool and show the message to the LLM
    return {
      decision: DECISION_DENY,
      message,
    };
  } catch (error) {
    // Fail open: skip hook and let Gemini continue
    return {
      decision: DECISION_SKIP,
      message: `⚠️ Hook error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

/**
 * AfterTool hook - not applicable for getFileDesignPattern
 * This tool is only called before file operations
 */
export const afterToolHook: HookCallback = async (): Promise<HookResponse> => {
  return {
    decision: DECISION_SKIP,
    message: 'AfterTool not applicable for getFileDesignPattern',
  };
};
