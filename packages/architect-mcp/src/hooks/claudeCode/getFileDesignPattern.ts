/**
 * GetFileDesignPattern Hook for Claude Code
 *
 * DESIGN PATTERNS:
 * - Class-based hook pattern: Encapsulates lifecycle hooks in a single class
 * - Fail-open pattern: Errors allow operation to proceed with warning
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

import type { ClaudeCodeHookInput, HookResponse } from '@agiflowai/hooks-adapter';
import { ExecutionLogService, DECISION_SKIP, DECISION_ALLOW } from '@agiflowai/hooks-adapter';
import { isValidLlmTool } from '@agiflowai/coding-agent-bridge';
import { GetFileDesignPatternTool } from '../../tools/GetFileDesignPatternTool';
import { TemplateFinder } from '../../services/TemplateFinder';
import { ArchitectParser } from '../../services/ArchitectParser';
import { PatternMatcher } from '../../services/PatternMatcher';
import path from 'node:path';

/**
 * GetFileDesignPattern Hook class for Claude Code
 *
 * Provides lifecycle hooks for tool execution:
 * - preToolUse: Provides design patterns before file edit/write operations
 * - postToolUse: Not applicable for this hook (returns skip)
 */
export class GetFileDesignPatternHook {
  /**
   * PreToolUse hook for Claude Code
   * Provides design patterns before file edit/write operations
   *
   * @param context - Claude Code hook input
   * @returns Hook response with design patterns or error message
   */
  async preToolUse(context: ClaudeCodeHookInput): Promise<HookResponse> {
    // Extract file path from tool input
    const filePath = context.tool_input.file_path;

    // Only process file operations
    if (!filePath || !['Read', 'Write', 'Edit'].includes(context.tool_name)) {
      return {
        decision: DECISION_SKIP,
        message: 'Not a file operation',
      };
    }

    // Only block files within the working directory
    const absoluteFilePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(context.cwd, filePath);

    if (!absoluteFilePath.startsWith(context.cwd + path.sep) && absoluteFilePath !== context.cwd) {
      return {
        decision: DECISION_SKIP,
        message: 'File is outside working directory - skipping design pattern check',
      };
    }

    try {
      // Create execution log service for this session
      const executionLog = new ExecutionLogService(context.session_id);

      // Get matched file patterns early for logging
      const templateFinder = new TemplateFinder();
      const architectParser = new ArchitectParser();
      const patternMatcher = new PatternMatcher();

      const templateMapping = await templateFinder.findTemplateForFile(filePath);
      const [templateConfig, globalConfig] = await Promise.all([
        templateMapping
          ? architectParser.parseArchitectFile(templateMapping.templatePath)
          : Promise.resolve(null),
        architectParser.parseGlobalArchitectFile(),
      ]);

      const filePatterns = patternMatcher.getMatchedFilePatterns(
        filePath,
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
      const projectPath = templateMapping?.projectPath;
      const alreadyShown = await executionLog.hasExecuted({
        filePath,
        decision: DECISION_ALLOW, // 'allow' means we showed patterns
        filePattern: filePatterns,
        projectPath,
      });

      if (alreadyShown) {
        // Already showed patterns - skip hook and let Claude continue normally
        await executionLog.logExecution({
          filePath: filePath,
          operation: context.tool_name.toLowerCase() as 'read' | 'write' | 'edit',
          decision: DECISION_SKIP,
          filePattern: filePatterns,
          projectPath,
        });

        return {
          decision: DECISION_SKIP,
          message: 'Design patterns already provided for this file',
        };
      }

      // First edit - get design patterns and deny to show them to Claude
      // Validate llm_tool before passing to tool constructor
      const llmTool = context.llm_tool && isValidLlmTool(context.llm_tool) ? context.llm_tool : undefined;
      const tool = new GetFileDesignPatternTool({
        llmTool,
        toolConfig: context.tool_config,
      });
      const result = await tool.execute({ file_path: filePath });

      // Parse result
      const firstContent = result.content[0];
      if (firstContent.type !== 'text') {
        return {
          decision: DECISION_SKIP,
          message: '⚠️ Unexpected response type from design pattern tool',
        };
      }
      const data = JSON.parse(firstContent.text);

      if (result.isError) {
        // Error getting patterns - skip and let Claude continue
        await executionLog.logExecution({
          filePath: context.tool_input?.file_path,
          operation: context.tool_name || 'unknown',
          decision: DECISION_SKIP,
          filePattern: filePatterns,
          projectPath,
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
      let message = 'The hook is blocked only once to provide guidelines for this file. You must follow these design patterns when editing/writing this file:\n\n';
      message += `**Matched file patterns:** ${filePatterns}\n\n`;

      for (const pattern of data.matched_patterns) {
        message += `**${pattern.design_pattern}**\n${pattern.description}\n\n`;
      }

      // Log that we showed patterns (decision: allow)
      await executionLog.logExecution({
        filePath: context.tool_input?.file_path,
        operation: context.tool_name || 'unknown',
        decision: DECISION_ALLOW,
        filePattern: filePatterns,
        projectPath,
      });

      // Return ALLOW with additionalContext so Claude sees the patterns
      // additionalContext is shown to Claude when decision is "allow"
      return {
        decision: DECISION_ALLOW,
        message,
      };
    } catch (error) {
      // Fail open: skip hook and let Claude continue
      return {
        decision: DECISION_SKIP,
        message: `⚠️ Hook error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * PostToolUse hook - not applicable for getFileDesignPattern
   * This tool is only called before file operations
   *
   * @param _context - Claude Code hook input (unused)
   * @returns Hook response with skip decision
   */
  async postToolUse(_context: ClaudeCodeHookInput): Promise<HookResponse> {
    return {
      decision: DECISION_SKIP,
      message: 'PostToolUse not applicable for getFileDesignPattern',
    };
  }
}
