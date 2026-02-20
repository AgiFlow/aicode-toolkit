/**
 * PhantomCodeCheck Hook for Claude Code
 *
 * DESIGN PATTERNS:
 * - Class-based hook pattern: Encapsulates lifecycle hooks in a single class
 * - Fail-open pattern: Errors allow operation to proceed (return DECISION_SKIP)
 * - Marker-based detection: Scans for scaffold marker comments in code files
 *
 * CODING STANDARDS:
 * - Export a class with stop, userPromptSubmit, taskCompleted methods
 * - Handle all errors gracefully with fail-open behavior
 * - Use execFileSync with args array to avoid shell injection
 *
 * AVOID:
 * - Blocking operations on errors
 * - Shell injection via marker parameter
 * - Mutating context object
 */

import { execFileSync } from 'node:child_process';
import type { ClaudeCodeHookInput, HookResponse } from '@agiflowai/hooks-adapter';
import { DECISION_ALLOW, DECISION_DENY, DECISION_SKIP } from '@agiflowai/hooks-adapter';

const EXCLUDED_DIRS = ['node_modules', 'dist', '.git', '.next', 'build', 'coverage', '.claude'];

/**
 * PhantomCodeCheckHook — scans for unimplemented scaffold files containing marker comments.
 *
 * Checks at session boundaries (Stop, UserPromptSubmit, TaskCompleted) whether
 * any generated files still carry the `// <marker>` comment, indicating they
 * have not yet been implemented by the AI agent.
 */
export class PhantomCodeCheckHook {
  private readonly markerComment: string;

  constructor(marker = '@scaffold-generated') {
    this.markerComment = `// ${marker}`;
  }

  /**
   * Scans cwd for files containing the scaffold marker comment.
   * Returns relative file paths. Returns empty array on any error (fail-open).
   */
  private scanForPhantomFiles(cwd: string): string[] {
    try {
      const args = [
        '-rl',
        this.markerComment,
        '--include=*.ts',
        '--include=*.tsx',
        '--include=*.js',
        '--include=*.jsx',
        ...EXCLUDED_DIRS.map((dir) => `--exclude-dir=${dir}`),
        '.',
      ];

      const output = execFileSync('grep', args, {
        cwd,
        timeout: 10_000,
        encoding: 'utf8',
      });

      return output
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((f) => f.replace(/^\.\//, ''));
    } catch (error: unknown) {
      // grep exits with code 1 when no matches found — not an error
      if (
        error instanceof Error &&
        'status' in error &&
        (error as Error & { status?: number }).status === 1
      ) {
        return [];
      }
      // Other errors (timeout, command not found) — fail open
      return [];
    }
  }

  /**
   * Stop hook — blocks session end if phantom files are found.
   * Returns DECISION_DENY to prevent Claude from stopping with unimplemented files.
   */
  async stop(context: ClaudeCodeHookInput): Promise<HookResponse> {
    try {
      const phantomFiles = this.scanForPhantomFiles(context.cwd);
      if (phantomFiles.length === 0) {
        return { decision: DECISION_SKIP, message: 'No phantom scaffold files found' };
      }

      const fileList = phantomFiles.map((f) => `  - ${f}`).join('\n');
      return {
        decision: DECISION_DENY,
        message: `⚠️ ${phantomFiles.length} scaffold file(s) still contain \`${this.markerComment}\` and have not been implemented:\n${fileList}\n\nPlease implement these files and remove the marker comment before ending the session.`,
      };
    } catch {
      return { decision: DECISION_SKIP, message: 'PhantomCodeCheckHook.stop error — skipping' };
    }
  }

  /**
   * UserPromptSubmit hook — warns about phantom files without blocking.
   * Returns DECISION_ALLOW with userMessage written to stderr (visible to user, not LLM).
   */
  async userPromptSubmit(context: ClaudeCodeHookInput): Promise<HookResponse> {
    try {
      const phantomFiles = this.scanForPhantomFiles(context.cwd);
      if (phantomFiles.length === 0) {
        return { decision: DECISION_SKIP, message: 'No phantom scaffold files found' };
      }

      const fileList = phantomFiles.map((f) => `  - ${f}`).join('\n');
      return {
        decision: DECISION_ALLOW,
        message: '',
        userMessage: `⚠️ Reminder: ${phantomFiles.length} scaffold file(s) still contain \`${this.markerComment}\`:\n${fileList}\n\nPlease implement these files and remove the marker comment.`,
      };
    } catch {
      return {
        decision: DECISION_SKIP,
        message: 'PhantomCodeCheckHook.userPromptSubmit error — skipping',
      };
    }
  }

  /**
   * TaskCompleted hook — blocks task completion if phantom files are found.
   * Returns DECISION_DENY with exitCode 2 to signal incomplete scaffolding.
   */
  async taskCompleted(context: ClaudeCodeHookInput): Promise<HookResponse> {
    try {
      const phantomFiles = this.scanForPhantomFiles(context.cwd);
      if (phantomFiles.length === 0) {
        return { decision: DECISION_SKIP, message: 'No phantom scaffold files found' };
      }

      const fileList = phantomFiles.map((f) => `  - ${f}`).join('\n');
      return {
        decision: DECISION_DENY,
        exitCode: 2,
        message: `⚠️ ${phantomFiles.length} scaffold file(s) still contain \`${this.markerComment}\` and have not been implemented:\n${fileList}\n\nTask cannot complete until all scaffold files are implemented.`,
      };
    } catch {
      return {
        decision: DECISION_SKIP,
        message: 'PhantomCodeCheckHook.taskCompleted error — skipping',
      };
    }
  }
}
