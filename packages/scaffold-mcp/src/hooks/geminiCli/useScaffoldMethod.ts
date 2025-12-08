/**
 * UseScaffoldMethod Hook for Gemini CLI
 *
 * DESIGN PATTERNS:
 * - Class-based hook pattern: Encapsulates lifecycle hooks in a single class
 * - Fail-open pattern: Errors allow operation to proceed with warning
 * - Proactive guidance: Shows available scaffolding methods before tool execution
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

import type {
  GeminiCliHookInput,
  HookResponse,
  ScaffoldExecution,
  LogEntry,
} from '@agiflowai/hooks-adapter';
import {
  ExecutionLogService,
  DECISION_SKIP,
  DECISION_DENY,
  DECISION_ALLOW,
} from '@agiflowai/hooks-adapter';
import { ListScaffoldingMethodsTool } from '../../tools/ListScaffoldingMethodsTool';
import { TemplatesManagerService } from '@agiflowai/aicode-utils';

/**
 * Scaffold method definition from list-scaffolding-methods tool
 */
interface ScaffoldMethod {
  name: string;
  instruction?: string;
  description?: string;
  variables_schema?: {
    required?: string[];
  };
}

/**
 * Response from list-scaffolding-methods tool
 */
interface ScaffoldMethodsResponse {
  methods?: ScaffoldMethod[];
  nextCursor?: string;
}

/**
 * Extended ExecutionLogService interface with loadLog method
 */
interface ExecutionLogServiceWithLoadLog extends ExecutionLogService {
  loadLog(): Promise<LogEntry[]>;
}

/**
 * UseScaffoldMethod Hook class for Gemini CLI
 *
 * Provides lifecycle hooks for tool execution:
 * - preToolUse: Shows available scaffolding methods before operations
 * - postToolUse: Tracks scaffold completion progress after file edits
 */
export class UseScaffoldMethodHook {
  /**
   * PreToolUse hook for Gemini CLI
   * Proactively shows available scaffolding methods and guides AI to use them
   *
   * @param context - Gemini CLI hook input
   * @returns Hook response with scaffolding methods guidance
   */
  async preToolUse(context: GeminiCliHookInput): Promise<HookResponse> {
    try {
      // Create execution log service for this session
      const executionLog = new ExecutionLogService(context.session_id);

      // Check if we already showed scaffold methods in this session
      const sessionKey = `list-scaffold-methods-${context.session_id}`;
      const alreadyShown = await executionLog.hasExecuted({
        filePath: sessionKey,
        decision: DECISION_DENY,
      });

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
      if (!templatesPath) {
        return {
          decision: DECISION_SKIP,
          message: 'Templates folder not found - skipping scaffold method check',
        };
      }
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

      // Validate and parse the result
      const resultText = result.content[0]?.text;
      if (typeof resultText !== 'string') {
        return {
          decision: DECISION_SKIP,
          message: '⚠️ Invalid response format from scaffolding methods tool',
        };
      }

      const data: ScaffoldMethodsResponse = JSON.parse(resultText);

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
  }

  /**
   * PostToolUse hook for Gemini CLI
   * Tracks file edits after scaffold generation and reminds AI to complete implementation
   *
   * @param context - Gemini CLI hook input
   * @returns Hook response with scaffold completion tracking
   */
  async postToolUse(context: GeminiCliHookInput): Promise<HookResponse> {
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
        // For Gemini CLI PostToolUse hook, we skip scaffold ID extraction
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
      const alreadyFulfilled = await executionLog.hasExecuted({
        filePath: fulfilledKey,
        decision: DECISION_ALLOW,
      });

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
        const alreadyTracked = await executionLog.hasExecuted({
          filePath: editKey,
          decision: DECISION_ALLOW,
        });

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

/**
 * Helper function to get the last scaffold execution for a session
 * Returns null if no scaffold execution found or on error
 */
async function getLastScaffoldExecution(
  executionLog: ExecutionLogServiceWithLoadLog,
): Promise<ScaffoldExecution | null> {
  try {
    const entries = await executionLog.loadLog();

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
  } catch (error: unknown) {
    console.error('Error getting last scaffold execution:', error);
    return null;
  }
}

/**
 * Helper function to get list of edited scaffold files
 * Returns empty array if no files found or on error
 */
async function getEditedScaffoldFiles(
  executionLog: ExecutionLogServiceWithLoadLog,
  scaffoldId: string,
): Promise<string[]> {
  try {
    const entries = await executionLog.loadLog();
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
  } catch (error: unknown) {
    console.error(`Error getting edited scaffold files for ${scaffoldId}:`, error);
    return [];
  }
}
