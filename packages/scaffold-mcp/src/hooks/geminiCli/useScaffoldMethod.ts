/**
 * UseScaffoldMethod Hooks for Gemini CLI
 *
 * DESIGN PATTERNS:
 * - Hook callback pattern: Multiple lifecycle hooks in single file
 * - Fail-open pattern: Errors allow operation to proceed with warning
 * - Proactive guidance: Shows available scaffolding methods before tool execution
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

import type { GeminiCliHookInput, HookResponse } from '@agiflowai/hooks-adapter';
import {
  ExecutionLogService,
  DECISION_SKIP,
  DECISION_DENY,
  DECISION_ALLOW,
} from '@agiflowai/hooks-adapter';
import { ListScaffoldingMethodsTool } from '../../tools/ListScaffoldingMethodsTool';
import { TemplatesManagerService } from '@agiflowai/aicode-utils';

/**
 * BeforeTool hook callback for Gemini CLI
 * Proactively shows available scaffolding methods and guides AI to use them
 *
 * @param context - Normalized hook context
 * @returns Hook response with scaffolding methods guidance
 */
export const beforeToolHook = async (context: GeminiCliHookInput): Promise<HookResponse> => {
  try {
    // Create execution log service for this session
    const executionLog = new ExecutionLogService(context.session_id);

    // Check if we already showed scaffold methods in this session
    const sessionKey = `list-scaffold-methods-${context.session_id}`;
    const alreadyShown = await executionLog.hasExecuted(sessionKey, DECISION_DENY);

    if (alreadyShown) {
      // Already showed methods - skip hook and let Gemini continue normally
      await executionLog.logExecution({
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
    const result = await tool.execute(context.tool_input || {});

    if (result.isError) {
      // Error getting methods - skip and let Gemini continue
      await executionLog.logExecution({
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
      await executionLog.logExecution({
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
    await executionLog.logExecution({
      filePath: sessionKey,
      operation: 'list-scaffold-methods',
      decision: DECISION_DENY,
    });

    // Always return DENY to show guidance to Gemini
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
 * AfterTool hook callback for Gemini CLI
 * Tracks file edits after scaffold generation and reminds AI to complete implementation
 *
 * @param context - Normalized hook context
 * @returns Hook response with scaffold completion tracking
 */
export const afterToolHook = async (context: GeminiCliHookInput): Promise<HookResponse> => {
  try {
    // Create execution log service for this session
    const executionLog = new ExecutionLogService(context.session_id);

    // Extract file path from tool input
    const filePath = context.tool_input?.file_path;

    // Extract actual tool name (handle both direct calls and MCP proxy calls)
    const actualToolName =
      context.tool_name === 'mcp__one-mcp__use_tool'
        ? context.tool_input?.toolName
        : context.tool_name;

    // Check if this is a use-scaffold-method tool execution
    if (actualToolName === 'use-scaffold-method') {
      // For Gemini CLI AfterTool hook, we skip scaffold ID extraction
      // as tool_result is not available in the GeminiCliHookInput type
      return {
        decision: DECISION_ALLOW,
        message: 'Scaffold execution logged for progress tracking',
      };
    }

    // Derive operation from tool name
    const operation = extractOperation(actualToolName);

    // Only process file edit/write operations
    if (!filePath || (operation !== 'edit' && operation !== 'write')) {
      return {
        decision: DECISION_SKIP,
        message: 'Not a file edit/write operation',
      };
    }

    // Get the last scaffold execution for this session
    const lastScaffoldExecution = await getLastScaffoldExecution(executionLog);

    if (!lastScaffoldExecution) {
      // No scaffold execution found - skip
      return {
        decision: DECISION_SKIP,
        message: 'No scaffold execution found',
      };
    }

    const { scaffoldId, generatedFiles, featureName } = lastScaffoldExecution;

    // Check if scaffold is already marked as fulfilled
    const fulfilledKey = `scaffold-fulfilled-${scaffoldId}`;
    const alreadyFulfilled = await executionLog.hasExecuted(fulfilledKey, DECISION_ALLOW);

    if (alreadyFulfilled) {
      // Scaffold already completed - skip
      return {
        decision: DECISION_SKIP,
        message: 'Scaffold already fulfilled',
      };
    }

    // Check if the edited file is in the generated files list
    const isScaffoldedFile = generatedFiles.includes(filePath);

    if (isScaffoldedFile) {
      // Track this file as edited
      const editKey = `scaffold-edit-${scaffoldId}-${filePath}`;
      const alreadyTracked = await executionLog.hasExecuted(editKey, DECISION_ALLOW);

      if (!alreadyTracked) {
        // Log this file as edited
        await executionLog.logExecution({
          filePath: editKey,
          operation: 'scaffold-file-edit',
          decision: DECISION_ALLOW,
        });
      }
    }

    // Check how many files have been edited vs total
    const editedFiles = await getEditedScaffoldFiles(executionLog, scaffoldId);
    const totalFiles = generatedFiles.length;
    const remainingFiles = generatedFiles.filter((f: string) => !editedFiles.includes(f));

    // If all files have been edited, mark scaffold as fulfilled
    if (remainingFiles.length === 0) {
      await executionLog.logExecution({
        filePath: fulfilledKey,
        operation: 'scaffold-fulfilled',
        decision: DECISION_ALLOW,
      });

      const featureInfo = featureName ? ` for "${featureName}"` : '';
      return {
        decision: DECISION_ALLOW,
        message: `✅ All scaffold files${featureInfo} have been implemented! (${totalFiles}/${totalFiles} files completed)`,
      };
    }

    // There are still unedited files - provide reminder (only if we just edited a scaffolded file)
    if (isScaffoldedFile) {
      const remainingFilesList = remainingFiles.map((f: string) => `  - ${f}`).join('\n');
      const featureInfo = featureName ? ` for "${featureName}"` : '';
      const reminderMessage = `
⚠️ **Scaffold Implementation Progress${featureInfo}: ${editedFiles.length}/${totalFiles} files completed**

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
    // Fail open: skip hook and let Gemini continue
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
  const lowerToolName = toolName.toLowerCase();
  if (lowerToolName === 'edit' || lowerToolName === 'update') return 'edit';
  if (lowerToolName === 'write') return 'write';
  if (lowerToolName === 'read') return 'read';
  return 'unknown';
}

/**
 * Extract scaffold ID from tool result
 */
function extractScaffoldId(toolResult: any): string | null {
  try {
    if (!toolResult || !toolResult.content) return null;

    // Look for SCAFFOLD_ID in content array
    for (const item of toolResult.content) {
      if (item.type === 'text' && typeof item.text === 'string') {
        const match = item.text.match(/^SCAFFOLD_ID:([a-z0-9]+)$/m);
        if (match) {
          return match[1];
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Helper function to get the last scaffold execution for a session
 */
async function getLastScaffoldExecution(
  executionLog: ExecutionLogService,
): Promise<{ scaffoldId: string; generatedFiles: string[]; featureName?: string } | null> {
  const entries = await (executionLog as any).loadLog();

  // Search from end (most recent) for efficiency
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];

    if (
      entry.operation === 'scaffold' &&
      entry.scaffoldId &&
      entry.generatedFiles &&
      entry.generatedFiles.length > 0
    ) {
      return {
        scaffoldId: entry.scaffoldId,
        generatedFiles: entry.generatedFiles,
        featureName: entry.featureName,
      };
    }
  }

  return null;
}

/**
 * Helper function to get list of edited scaffold files
 */
async function getEditedScaffoldFiles(
  executionLog: ExecutionLogService,
  scaffoldId: string,
): Promise<string[]> {
  const entries = await (executionLog as any).loadLog();
  const editedFiles: string[] = [];

  for (const entry of entries) {
    if (
      entry.operation === 'scaffold-file-edit' &&
      entry.filePath.startsWith(`scaffold-edit-${scaffoldId}-`)
    ) {
      // Extract the file path from the edit key
      const filePath = entry.filePath.replace(`scaffold-edit-${scaffoldId}-`, '');
      editedFiles.push(filePath);
    }
  }

  return editedFiles;
}

/**
 * Process pending scaffold logs from temp file and copy to ExecutionLogService
 * Called when use-scaffold-method tool is executed
 */
async function processPendingScaffoldLogs(sessionId: string, scaffoldId: string): Promise<void> {
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');

  const tempLogFile = path.join(os.tmpdir(), `scaffold-mcp-pending-${scaffoldId}.jsonl`);

  try {
    // Read temp log file
    const content = await fs.readFile(tempLogFile, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    // Create execution log service for this session
    const executionLog = new ExecutionLogService(sessionId);

    try {
      // Process each pending log entry
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);

          // Log to ExecutionLogService with sessionId from hook context
          // Use scaffoldId as unique key instead of projectPath to support multiple scaffolds per project
          await executionLog.logExecution({
            filePath: `scaffold-${entry.scaffoldId}`,
            operation: 'scaffold',
            decision: DECISION_ALLOW,
            generatedFiles: entry.generatedFiles,
            scaffoldId: entry.scaffoldId,
            projectPath: entry.projectPath,
            featureName: entry.featureName,
          });
        } catch (parseError) {
          // Skip malformed entries
          console.error('Failed to parse pending scaffold log entry:', parseError);
        }
      }
    } finally {
      // Always clean up temp log file, even if processing fails
      try {
        await fs.unlink(tempLogFile);
      } catch (unlinkError) {
        // Ignore unlink errors - file might already be deleted
      }
    }
  } catch (error: any) {
    // File doesn't exist or read error - this is fine, just means no pending logs
    if (error.code !== 'ENOENT') {
      console.error('Error processing pending scaffold logs:', error);
    }
  }
}
