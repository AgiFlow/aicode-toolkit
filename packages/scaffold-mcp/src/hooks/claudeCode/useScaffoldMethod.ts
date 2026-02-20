/**
 * UseScaffoldMethod Hook for Claude Code
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
  ClaudeCodeHookInput,
  HookResponse,
  ToolResult,
  ScaffoldExecution,
  LogEntry,
  PendingScaffoldLogEntry,
} from '@agiflowai/hooks-adapter';
import {
  ExecutionLogService,
  DECISION_SKIP,
  DECISION_DENY,
  DECISION_ALLOW,
} from '@agiflowai/hooks-adapter';
import { ListScaffoldingMethodsTool } from '../../tools';
import { TemplatesManagerService, ProjectFinderService } from '@agiflowai/aicode-utils';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

/**
 * Scaffold method definition from list-scaffolding-methods tool
 */
interface ScaffoldMethod {
  name: string;
  description?: string;
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
 * Type guard for ScaffoldMethodsResponse
 */
function isScaffoldMethodsResponse(value: unknown): value is ScaffoldMethodsResponse {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if ('methods' in obj && !Array.isArray(obj.methods)) return false;
  if ('nextCursor' in obj && typeof obj.nextCursor !== 'string') return false;
  return true;
}

/**
 * Type guard for PendingScaffoldLogEntry
 */
function isPendingScaffoldLogEntry(value: unknown): value is PendingScaffoldLogEntry {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.scaffoldId === 'string' &&
    Array.isArray(obj.generatedFiles) &&
    typeof obj.projectPath === 'string'
  );
}

/**
 * UseScaffoldMethod Hook class for Claude Code
 *
 * Provides lifecycle hooks for tool execution:
 * - preToolUse: Shows available scaffolding methods before Write operations
 * - postToolUse: Tracks scaffold completion progress after file edits
 */
export class UseScaffoldMethodHook {
  /**
   * PreToolUse hook for Claude Code
   * Proactively shows available scaffolding methods and guides AI to use them
   *
   * @param context - Claude Code hook input
   * @returns Hook response with scaffolding methods guidance
   */
  async preToolUse(context: ClaudeCodeHookInput): Promise<HookResponse> {
    try {
      // Guard: only PreToolUse/PostToolUse events carry tool_name and tool_input
      if (!('tool_name' in context)) {
        return { decision: DECISION_SKIP, message: 'Not a tool use event' };
      }

      // Only intercept Write operations with a file path
      const filePath = context.tool_input?.file_path;

      if (!filePath || context.tool_name !== 'Write') {
        return {
          decision: DECISION_SKIP,
          message: 'Not a file write operation',
        };
      }

      // Only block files within the working directory
      const absoluteFilePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(context.cwd, filePath);

      if (
        !absoluteFilePath.startsWith(context.cwd + path.sep) &&
        absoluteFilePath !== context.cwd
      ) {
        return {
          decision: DECISION_SKIP,
          message: 'File is outside working directory - skipping scaffold method check',
        };
      }

      // Create execution log service for this session
      const executionLog = new ExecutionLogService(context.session_id);

      // Check if we already showed scaffold methods for this file path
      const alreadyShown = await executionLog.hasExecuted({ filePath, decision: DECISION_DENY });

      if (alreadyShown) {
        return {
          decision: DECISION_SKIP,
          message: 'Scaffolding methods already provided for this file',
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

      // Derive project path from file path by finding the nearest project.json
      const workspaceRoot = await TemplatesManagerService.getWorkspaceRoot(context.cwd);
      const projectFinder = new ProjectFinderService(workspaceRoot);

      const projectConfig = await projectFinder.findProjectForFile(absoluteFilePath);

      // If project found, use its root; otherwise use cwd
      const projectPath = projectConfig?.root || context.cwd;

      // Execute the tool to get scaffolding methods
      const result = await tool.execute({ projectPath });

      // Validate response type first
      const firstContent = result.content[0];
      if (firstContent?.type !== 'text') {
        return {
          decision: DECISION_SKIP,
          message: '⚠️ Unexpected response type from scaffolding methods tool',
        };
      }

      if (result.isError) {
        // Error getting methods - skip and let Claude continue
        return {
          decision: DECISION_SKIP,
          message: `⚠️ Could not load scaffolding methods: ${firstContent.text}`,
        };
      }

      // Validate and parse the result
      const resultText = firstContent.text;
      if (typeof resultText !== 'string') {
        return {
          decision: DECISION_SKIP,
          message: '⚠️ Invalid response format from scaffolding methods tool',
        };
      }

      const parsed: unknown = JSON.parse(resultText);
      if (!isScaffoldMethodsResponse(parsed)) {
        return {
          decision: DECISION_SKIP,
          message: '⚠️ Unexpected response shape from scaffolding methods tool',
        };
      }
      const data = parsed;

      if (!data.methods || data.methods.length === 0) {
        // No methods available - allow with guidance
        await executionLog.logExecution({
          filePath: filePath,
          operation: 'list-scaffold-methods',
          decision: DECISION_ALLOW,
        });

        return {
          decision: DECISION_ALLOW,
          message:
            'No scaffolding methods are available for this project template. You should write new files directly using the Write tool.',
        };
      }

      // Format available methods as a concise list (name + description only)
      let message =
        'Before writing new files, use `use-scaffold-method` if any of these match your needs:\n\n';

      for (const method of data.methods) {
        message += `- **${method.name}**: ${method.description || 'No description available'}\n`;
      }

      if (data.nextCursor) {
        message += `\n_More methods available (cursor: "${data.nextCursor}")._\n`;
      }

      // Log that we showed methods for this file path (decision: deny)
      await executionLog.logExecution({
        filePath: filePath,
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
  }

  /**
   * PostToolUse hook for Claude Code
   * Tracks file edits after scaffold generation and reminds AI to complete implementation
   *
   * @param context - Claude Code hook input
   * @returns Hook response with scaffold completion tracking
   */
  async postToolUse(context: ClaudeCodeHookInput): Promise<HookResponse> {
    try {
      // Guard: only PreToolUse/PostToolUse events carry tool_name and tool_input
      if (!('tool_name' in context)) {
        return { decision: DECISION_SKIP, message: 'Not a tool use event' };
      }

      // Create execution log service for this session
      const executionLog = new ExecutionLogService(context.session_id);

      // Extract actual tool name (handle both direct calls and MCP proxy calls)
      const filePath = context.tool_input?.file_path;

      const actualToolName =
        context.tool_name === 'mcp__one-mcp__use_tool'
          ? context.tool_input?.toolName
          : context.tool_name;

      // Check if this is a use-scaffold-method tool execution
      if (actualToolName === 'use-scaffold-method') {
        // Extract scaffold ID from tool result (only available in PostToolUse)
        if (context.hook_event_name === 'PostToolUse') {
          const scaffoldId = extractScaffoldId(context.tool_response);
          if (scaffoldId) {
            await processPendingScaffoldLogs(context.session_id, scaffoldId);
          }
        }
        return {
          decision: DECISION_ALLOW,
          message: 'Scaffold execution logged for progress tracking',
        };
      }

      // Only process file edit/write operations
      if (
        !filePath ||
        (context.tool_name !== 'Edit' &&
          context.tool_name !== 'Write' &&
          context.tool_name !== 'Update')
      ) {
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
      // Fail open: skip hook and let Claude continue
      return {
        decision: DECISION_SKIP,
        message: `⚠️ Hook error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

/**
 * Extract scaffold ID from tool result
 */
function extractScaffoldId(toolResult: ToolResult | null): string | null {
  try {
    if (!toolResult || !toolResult.content) return null;

    // Look for SCAFFOLD_ID in content array
    for (const item of toolResult.content) {
      if (item.type === 'text' && typeof item.text === 'string') {
        const match = item.text.match(/^SCAFFOLD_ID:([a-z0-9]+)$/);
        if (match) {
          return match[1];
        }
      }
    }

    return null;
  } catch (error) {
    // Parsing errors are non-fatal; absence of scaffold ID is handled by the caller
    console.error('extractScaffoldId: failed to parse tool result:', error);
    return null;
  }
}

/**
 * Helper function to get the last scaffold execution for a session
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
  } catch (error) {
    console.error('getLastScaffoldExecution: failed to load log:', error);
    return null;
  }
}

/**
 * Helper function to get list of edited scaffold files
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
  } catch (error) {
    console.error('getEditedScaffoldFiles: failed to load log:', error);
    return [];
  }
}

/**
 * Process pending scaffold logs from temp file and copy to ExecutionLogService
 * Called when use-scaffold-method tool is executed
 */
async function processPendingScaffoldLogs(sessionId: string, scaffoldId: string): Promise<void> {
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
          const parsed: unknown = JSON.parse(line);
          if (!isPendingScaffoldLogEntry(parsed)) {
            console.error('processPendingScaffoldLogs: skipping malformed entry:', line);
            continue;
          }

          // Log to ExecutionLogService with sessionId from hook context
          // Use scaffoldId as unique key instead of projectPath to support multiple scaffolds per project
          await executionLog.logExecution({
            filePath: `scaffold-${parsed.scaffoldId}`,
            operation: 'scaffold',
            decision: DECISION_ALLOW,
            generatedFiles: parsed.generatedFiles,
            scaffoldId: parsed.scaffoldId,
            projectPath: parsed.projectPath,
            featureName: parsed.featureName,
          });
        } catch (parseError) {
          console.error('processPendingScaffoldLogs: failed to parse line:', parseError);
        }
      }
    } finally {
      // Always clean up temp log file, even if processing fails
      try {
        await fs.unlink(tempLogFile);
      } catch (unlinkError: unknown) {
        // ENOENT means file was already deleted — safe to ignore; log unexpected errors
        if (
          !(
            unlinkError instanceof Error &&
            'code' in unlinkError &&
            unlinkError.code === 'ENOENT'
          )
        ) {
          console.error('processPendingScaffoldLogs: failed to delete temp log file:', unlinkError);
        }
      }
    }
  } catch (error: unknown) {
    // File doesn't exist or read error - this is fine, just means no pending logs
    if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
      console.error('Error processing pending scaffold logs:', error);
    }
  }
}
