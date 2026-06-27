/**
 * UseScaffoldMethod Hook for OpenAI Codex CLI
 *
 * DESIGN PATTERNS:
 * - Class-based hook pattern: Encapsulates lifecycle hooks in a single class
 * - Fail-open pattern: Errors allow operation to proceed with warning
 * - Proactive guidance: Shows available scaffolding methods before tool execution
 *
 * CODEX SPECIFICS:
 * Codex's hook wire format matches Claude Code's (see CodexAdapter), so the
 * input/output handling is shared. The one difference is the file-write tool:
 * Codex creates files via `apply_patch`, whose `tool_input.command` is a patch
 * body containing `*** Add File: <path>` blocks — there is no `tool_input.file_path`.
 * New-file targets are therefore parsed from the patch (see resolveApplyPatchNewFileTargets).
 *
 * AVOID:
 * - Blocking operations on errors
 * - Complex business logic (delegate to tools/services)
 * - Mutating context object
 */

import type {
  CodexHookInput,
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
import { TemplatesManagerService, ProjectFinderService } from '@agiflowai/aicode-utils';
import path from 'node:path';
import {
  formatScaffoldMethodsHookMessage,
  matchesExcludeGlob,
  getGlobalExcludeGlobs,
  resolveApplyPatchNewFileTargets,
  resolveApplyPatchEditedPaths,
} from '../shared';

/**
 * Scaffold method definition from the list-scaffolding-methods tool
 */
interface ScaffoldMethod {
  name: string;
  description?: string;
}

/**
 * Response from the list-scaffolding-methods tool
 */
interface ScaffoldMethodsResponse {
  methods?: ScaffoldMethod[];
  /** Template-level exclude globs from scaffold.yaml (see {@link matchesExcludeGlob}). */
  excludeGlobs?: string[];
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
  if ('methods' in value && !Array.isArray(value.methods)) return false;
  if ('excludeGlobs' in value && !Array.isArray(value.excludeGlobs)) return false;
  if ('nextCursor' in value && typeof value.nextCursor !== 'string') return false;
  return true;
}

/**
 * UseScaffoldMethod Hook class for Codex CLI
 *
 * Provides lifecycle hooks for tool execution:
 * - preToolUse: Shows available scaffolding methods before an apply_patch creates new files
 * - postToolUse: Tracks scaffold completion progress after file edits
 */
export class UseScaffoldMethodHook {
  /**
   * PreToolUse hook for Codex CLI
   * Proactively shows available scaffolding methods and guides the agent to use them
   * when an apply_patch is about to create a new file.
   *
   * @param context - Codex CLI hook input
   * @returns Hook response with scaffolding methods guidance
   */
  async preToolUse(context: CodexHookInput): Promise<HookResponse> {
    try {
      // Guard: only tool-use events carry tool_name and tool_input
      if (!('tool_name' in context)) {
        return { decision: DECISION_SKIP, message: 'Not a tool use event' };
      }

      // Codex creates files via apply_patch; the patch body lives in tool_input.command.
      const command =
        typeof context.tool_input?.command === 'string' ? context.tool_input.command : undefined;
      const newFileTargets = resolveApplyPatchNewFileTargets(
        context.cwd,
        context.tool_name,
        command,
      );
      if (newFileTargets.length === 0) {
        return {
          decision: DECISION_SKIP,
          message: 'Not a new-file apply_patch operation',
        };
      }

      // Workspace-wide excludeGlobs bypass scaffold enforcement. Enforce on the first
      // new file not covered by them; if every new file is excluded, allow directly.
      const globalExcludeGlobs = await getGlobalExcludeGlobs(context.cwd);
      const target = newFileTargets.find((p) => !matchesExcludeGlob(p, globalExcludeGlobs));
      if (!target) {
        return {
          decision: DECISION_ALLOW,
          message: 'New file(s) match configured excludeGlobs - writing directly.',
        };
      }

      // Only prompt once per new-file target per session
      const executionLog = new ExecutionLogService(context.session_id);
      const alreadyShown = await executionLog.hasExecuted({
        filePath: target,
        decision: DECISION_DENY,
      });
      if (alreadyShown) {
        return {
          decision: DECISION_SKIP,
          message: 'Scaffolding methods already provided for this file',
        };
      }

      const templatesPath = await TemplatesManagerService.findTemplatesPath();
      if (!templatesPath) {
        return {
          decision: DECISION_SKIP,
          message: 'Templates folder not found - skipping scaffold method check',
        };
      }
      const tool = new ListScaffoldingMethodsTool(templatesPath, false);

      // Derive project path from the new file by finding the nearest project.json
      const workspaceRoot = await TemplatesManagerService.getWorkspaceRoot(context.cwd);
      const projectFinder = new ProjectFinderService(workspaceRoot);
      const projectConfig = await projectFinder.findProjectForFile(target);
      const projectPath = projectConfig?.root || context.cwd;

      const result = await tool.execute({ projectPath });

      const firstContent = result.content[0];
      if (firstContent?.type !== 'text') {
        return {
          decision: DECISION_SKIP,
          message: '⚠️ Unexpected response type from scaffolding methods tool',
        };
      }
      if (result.isError) {
        return {
          decision: DECISION_SKIP,
          message: `⚠️ Could not load scaffolding methods: ${firstContent.text}`,
        };
      }

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

      // Per-template relaxation: writes matching the template's scaffold.yaml `exclude`
      // globs bypass enforcement even when scaffold methods exist.
      if (matchesExcludeGlob(target, data.excludeGlobs)) {
        return {
          decision: DECISION_ALLOW,
          message: 'File matches template exclude globs - writing directly.',
        };
      }

      if (!data.methods || data.methods.length === 0) {
        await executionLog.logExecution({
          filePath: target,
          operation: 'list-scaffold-methods',
          decision: DECISION_ALLOW,
        });
        return {
          decision: DECISION_ALLOW,
          message:
            'No scaffolding methods are available for this project template. You should write new files directly.',
        };
      }

      const message = formatScaffoldMethodsHookMessage(data.methods);

      // Log that we showed methods for this file (decision: deny)
      await executionLog.logExecution({
        filePath: target,
        operation: 'list-scaffold-methods',
        decision: DECISION_DENY,
      });

      // Return DENY to surface guidance to Codex (does not hard-block apply_patch)
      return {
        decision: DECISION_DENY,
        message,
      };
    } catch (error) {
      // Fail open: skip hook and let Codex continue
      return {
        decision: DECISION_SKIP,
        message: `⚠️ Hook error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * PostToolUse hook for Codex CLI
   * Tracks file edits after scaffold generation and reminds the agent to complete
   * the implementation of all scaffold-generated files.
   *
   * @param context - Codex CLI hook input
   * @returns Hook response with scaffold completion tracking
   */
  async postToolUse(context: CodexHookInput): Promise<HookResponse> {
    try {
      if (!('tool_name' in context)) {
        return { decision: DECISION_SKIP, message: 'Not a tool use event' };
      }

      const executionLog = new ExecutionLogService(context.session_id);

      // A use-scaffold-method execution logs its generated files via the tool itself;
      // just acknowledge it here so progress tracking can pick it up later.
      if (
        context.tool_name === 'use-scaffold-method' ||
        context.tool_input?.toolName === 'use-scaffold-method'
      ) {
        return {
          decision: DECISION_ALLOW,
          message: 'Scaffold execution logged for progress tracking',
        };
      }

      const command =
        typeof context.tool_input?.command === 'string' ? context.tool_input.command : undefined;
      const editedPaths = resolveApplyPatchEditedPaths(context.tool_name, command);
      if (editedPaths.length === 0) {
        return { decision: DECISION_SKIP, message: 'Not a file edit/write operation' };
      }

      const lastScaffoldExecution = await getLastScaffoldExecution(
        executionLog as ExecutionLogServiceWithLoadLog,
      );
      if (!lastScaffoldExecution) {
        return { decision: DECISION_SKIP, message: 'No scaffold execution found' };
      }

      const { scaffoldId, generatedFiles, featureName } = lastScaffoldExecution;

      const fulfilledKey = `scaffold-fulfilled-${scaffoldId}`;
      const alreadyFulfilled = await executionLog.hasExecuted({
        filePath: fulfilledKey,
        decision: DECISION_ALLOW,
      });
      if (alreadyFulfilled) {
        return { decision: DECISION_SKIP, message: 'Scaffold already fulfilled' };
      }

      // Track edited paths that belong to the scaffold's generated files. Match both
      // the raw patch path and its cwd-absolute form (generatedFiles may be either).
      let touchedScaffoldFile = false;
      for (const editedPath of editedPaths) {
        const absoluteEditedPath = path.isAbsolute(editedPath)
          ? editedPath
          : path.join(context.cwd, editedPath);
        const generatedMatch = generatedFiles.find(
          (f: string) => f === editedPath || f === absoluteEditedPath,
        );
        if (!generatedMatch) {
          continue;
        }
        touchedScaffoldFile = true;
        const editKey = `scaffold-edit-${scaffoldId}-${generatedMatch}`;
        const alreadyTracked = await executionLog.hasExecuted({
          filePath: editKey,
          decision: DECISION_ALLOW,
        });
        if (!alreadyTracked) {
          await executionLog.logExecution({
            filePath: editKey,
            operation: 'scaffold-file-edit',
            decision: DECISION_ALLOW,
          });
        }
      }

      const editedFiles = await getEditedScaffoldFiles(
        executionLog as ExecutionLogServiceWithLoadLog,
        scaffoldId,
      );
      const totalFiles = generatedFiles.length;
      const remainingFiles = generatedFiles.filter((f: string) => !editedFiles.includes(f));

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

      if (touchedScaffoldFile) {
        const remainingFilesList = remainingFiles.map((f: string) => `  - ${f}`).join('\n');
        const featureInfo = featureName ? ` for "${featureName}"` : '';
        const reminderMessage = `
⚠️ **Scaffold Implementation Progress${featureInfo}: ${editedFiles.length}/${totalFiles} files completed**

**Remaining files to implement:**
${remainingFilesList}

Don't forget to complete the implementation for all scaffolded files!
        `.trim();
        return { decision: DECISION_ALLOW, message: reminderMessage };
      }

      return {
        decision: DECISION_SKIP,
        message: 'Edited file not part of last scaffold execution',
      };
    } catch (error) {
      // Fail open: skip hook and let Codex continue
      return {
        decision: DECISION_SKIP,
        message: `⚠️ Hook error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

/**
 * Helper function to get the last scaffold execution for a session.
 * Returns null if no scaffold execution found or on error.
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
 * Helper function to get the list of edited scaffold files.
 * Returns an empty array if no files found or on error.
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
