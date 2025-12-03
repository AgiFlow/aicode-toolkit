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
  DECISION_ALLOW,
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
export const preToolUseHook: HookCallback = async (context: HookContext): Promise<HookResponse> => {
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
 * PostToolUse hook callback for Claude Code
 * Tracks file edits after scaffold generation and reminds AI to complete implementation
 *
 * @param context - Normalized hook context
 * @returns Hook response with scaffold completion tracking
 */
export const postToolUseHook: HookCallback = async (
  context: HookContext,
): Promise<HookResponse> => {
  try {
    // Only process file edit/write operations
    if (!context.filePath || (context.operation !== 'edit' && context.operation !== 'write')) {
      return {
        decision: DECISION_SKIP,
        message: 'Not a file edit/write operation',
      };
    }

    // Get the last scaffold execution for this session
    const lastScaffoldExecution = await getLastScaffoldExecution(context.sessionId);

    if (!lastScaffoldExecution) {
      // No scaffold execution found - skip
      return {
        decision: DECISION_SKIP,
        message: 'No scaffold execution found',
      };
    }

    const { filePath: scaffoldKey, generatedFiles } = lastScaffoldExecution;

    // Check if scaffold is already marked as fulfilled
    const fulfilledKey = `scaffold-fulfilled-${scaffoldKey}`;
    const alreadyFulfilled = await ExecutionLogService.hasExecuted(
      context.sessionId,
      fulfilledKey,
      DECISION_ALLOW,
    );

    if (alreadyFulfilled) {
      // Scaffold already completed - skip
      return {
        decision: DECISION_SKIP,
        message: 'Scaffold already fulfilled',
      };
    }

    // Check if the edited file is in the generated files list
    const isScaffoldedFile = generatedFiles.includes(context.filePath);

    if (isScaffoldedFile) {
      // Track this file as edited
      const editKey = `scaffold-edit-${scaffoldKey}-${context.filePath}`;
      const alreadyTracked = await ExecutionLogService.hasExecuted(
        context.sessionId,
        editKey,
        DECISION_ALLOW,
      );

      if (!alreadyTracked) {
        // Log this file as edited
        await ExecutionLogService.logExecution({
          sessionId: context.sessionId,
          filePath: editKey,
          operation: 'scaffold-file-edit',
          decision: DECISION_ALLOW,
        });
      }
    }

    // Check how many files have been edited vs total
    const editedFiles = await getEditedScaffoldFiles(context.sessionId, scaffoldKey);
    const totalFiles = generatedFiles.length;
    const remainingFiles = generatedFiles.filter((f: string) => !editedFiles.includes(f));

    // If all files have been edited, mark scaffold as fulfilled
    if (remainingFiles.length === 0) {
      await ExecutionLogService.logExecution({
        sessionId: context.sessionId,
        filePath: fulfilledKey,
        operation: 'scaffold-fulfilled',
        decision: DECISION_ALLOW,
      });

      return {
        decision: DECISION_ALLOW,
        message: `✅ All scaffold files have been implemented! (${totalFiles}/${totalFiles} files completed)`,
      };
    }

    // There are still unedited files - provide reminder (only if we just edited a scaffolded file)
    if (isScaffoldedFile) {
      const remainingFilesList = remainingFiles.map((f: string) => `  - ${f}`).join('\n');
      const reminderMessage = `
⚠️ **Scaffold Implementation Progress: ${editedFiles.length}/${totalFiles} files completed**

**Remaining files to implement:**
${remainingFilesList}

Don't forget to complete the implementation for all scaffolded files!
      `.trim();

      return {
        decision: DECISION_ALLOW,
        message: reminderMessage,
      };
    }

    // Edited file is outside of scaffold - skip
    return {
      decision: DECISION_SKIP,
      message: 'Edited file not part of last scaffold execution',
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
 * Helper function to get the last scaffold execution for a session
 */
async function getLastScaffoldExecution(
  sessionId: string,
): Promise<{ filePath: string; generatedFiles: string[] } | null> {
  const entries = await (ExecutionLogService as any).loadLog();

  // Search from end (most recent) for efficiency
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];

    if (
      entry.sessionId === sessionId &&
      entry.operation === 'scaffold' &&
      entry.generatedFiles &&
      entry.generatedFiles.length > 0
    ) {
      return {
        filePath: entry.filePath,
        generatedFiles: entry.generatedFiles,
      };
    }
  }

  return null;
}

/**
 * Helper function to get list of edited scaffold files
 */
async function getEditedScaffoldFiles(sessionId: string, scaffoldKey: string): Promise<string[]> {
  const entries = await (ExecutionLogService as any).loadLog();
  const editedFiles: string[] = [];

  for (const entry of entries) {
    if (
      entry.sessionId === sessionId &&
      entry.operation === 'scaffold-file-edit' &&
      entry.filePath.startsWith(`scaffold-edit-${scaffoldKey}-`)
    ) {
      // Extract the file path from the edit key
      const filePath = entry.filePath.replace(`scaffold-edit-${scaffoldKey}-`, '');
      editedFiles.push(filePath);
    }
  }

  return editedFiles;
}
