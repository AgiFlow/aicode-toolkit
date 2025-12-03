/**
 * ListScaffoldMethods Hooks for Claude Code
 *
 * DESIGN PATTERNS:
 * - Hook callback pattern: Multiple lifecycle hooks in single file
 * - Fail-open pattern: Errors allow operation to proceed with warning
 * - Proactive guidance: Shows available scaffolding methods before tool execution
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

import type { HookCallback, HookContext, HookResponse } from '@agiflowai/hooks-adapter';
import {
  ExecutionLogService,
  DECISION_SKIP,
  DECISION_DENY,
} from '@agiflowai/hooks-adapter';
import { ListScaffoldingMethodsTool } from '../../tools/ListScaffoldingMethodsTool';
import { TemplatesManagerService } from '@agiflowai/aicode-utils';

/**
 * PreToolUse hook callback for Claude Code
 * Proactively shows available scaffolding methods and guides AI to use them
 *
 * @param context - Normalized hook context
 * @returns Hook response with scaffolding methods guidance
 */
export const preToolUseHook: HookCallback = async (
  context: HookContext,
): Promise<HookResponse> => {
  try {
    // Check if we already showed scaffold methods in this session
    const sessionKey = `list-scaffold-methods-${context.sessionId}`;
    const alreadyShown = await ExecutionLogService.hasExecuted(
      context.sessionId,
      sessionKey,
      DECISION_DENY, // 'deny' means we showed the methods
    );

    if (alreadyShown) {
      // Already showed methods - skip hook and let Claude continue normally
      await ExecutionLogService.logExecution({
        sessionId: context.sessionId,
        filePath: sessionKey,
        operation: 'list-scaffold-methods',
        decision: DECISION_SKIP,
      });

      return {
        decision: DECISION_SKIP,
        message: 'Scaffolding methods already provided in this session',
      };
    }

    // Get templates path and create tool
    const templatesPath = await TemplatesManagerService.findTemplatesPath();
    const tool = new ListScaffoldingMethodsTool(templatesPath, false);

    // Execute the tool to get scaffolding methods
    const result = await tool.execute(context.toolInput || {});

    if (result.isError) {
      // Error getting methods - skip and let Claude continue
      await ExecutionLogService.logExecution({
        sessionId: context.sessionId,
        filePath: sessionKey,
        operation: 'list-scaffold-methods',
        decision: DECISION_SKIP,
      });

      return {
        decision: DECISION_SKIP,
        message: `⚠️ Could not load scaffolding methods: ${result.content[0].text}`,
      };
    }

    // Parse the result
    const data = JSON.parse(result.content[0].text as string);

    if (!data.methods || data.methods.length === 0) {
      // No methods available - still deny to guide AI
      await ExecutionLogService.logExecution({
        sessionId: context.sessionId,
        filePath: sessionKey,
        operation: 'list-scaffold-methods',
        decision: DECISION_DENY,
      });

      return {
        decision: DECISION_DENY,
        message:
          'No scaffolding methods are available for this project template. You should write new files directly using the Write tool.',
      };
    }

    // Format all available methods for LLM guidance
    let message = '🎯 **Scaffolding Methods Available**\n\n';
    message +=
      'Before writing new files, check if any of these scaffolding methods match your needs:\n\n';

    for (const method of data.methods) {
      message += `**${method.name}**\n`;
      message += `${method.instruction || method.description || 'No description available'}\n`;

      if (method.variables_schema?.required && method.variables_schema.required.length > 0) {
        message += `Required: ${method.variables_schema.required.join(', ')}\n`;
      }
      message += '\n';
    }

    if (data.nextCursor) {
      message += `\n_Note: More methods available. Use cursor "${data.nextCursor}" to see more._\n\n`;
    }

    message += '\n**Instructions:**\n';
    message +=
      '1. If one of these scaffold methods matches what you need to create, use the `use-scaffold-method` MCP tool instead of writing files manually\n';
    message +=
      '2. If none of these methods are relevant to your task, proceed to write new files directly using the Write tool\n';
    message +=
      '3. Using scaffold methods ensures consistency with project patterns and includes all necessary boilerplate\n';

    // Log that we showed methods (decision: deny)
    await ExecutionLogService.logExecution({
      sessionId: context.sessionId,
      filePath: sessionKey,
      operation: 'list-scaffold-methods',
      decision: DECISION_DENY,
    });

    // Always return DENY to show guidance to Claude
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

/**
 * PostToolUse hook - not applicable for listScaffoldMethods
 * This is a read-only operation that doesn't require post-processing
 */
export const postToolUseHook: HookCallback = async (): Promise<HookResponse> => {
  return {
    decision: DECISION_SKIP,
    message: 'PostToolUse not applicable for listScaffoldMethods',
  };
};
