import path from 'node:path';
import fs from 'node:fs/promises';
import { minimatch } from 'minimatch';
import { TemplatesManagerService } from '@agiflowai/aicode-utils';

interface ScaffoldMethodSummary {
  name: string;
  description?: string;
  variables_schema?: {
    required?: string[];
  };
}

export const MAX_SCAFFOLD_METHODS_IN_HOOK = 5;
export const MAX_REQUIRED_VARS_IN_HOOK = 3;
export const REQUIRED_VARS_METHOD_LIMIT = 2;

/**
 * Returns true when an absolute write target matches any of the given exclude globs.
 *
 * Scaffold methods carry no target glob, so the hook cannot tell whether a method
 * applies to a given path: once any method exists it denies every new-file write,
 * which pushes agents to bypass the hook via Bash heredocs (skipping downstream
 * review hooks). Exclude globs are the configured escape hatch — matching writes are
 * allowed through directly. Globs come from two sources: workspace-wide
 * (`scaffold-mcp.hook.excludeGlobs` in .toolkit/settings.yaml, see
 * {@link getGlobalExcludeGlobs}) and per-template (`exclude` in scaffold.yaml).
 *
 * `dot: true` lets the globs traverse dot-directories (e.g. worktree paths) so a
 * file nested under one is not misclassified.
 *
 * @param absPath - Absolute path of the new-file write target.
 * @param globs - Glob patterns to match against; empty/undefined matches nothing.
 * @returns True when `absPath` matches at least one glob.
 */
export function matchesExcludeGlob(absPath: string, globs?: string[]): boolean {
  if (!globs || globs.length === 0) {
    return false;
  }
  return globs.some((glob) => minimatch(absPath, glob, { dot: true }));
}

/**
 * Loads the workspace-wide scaffold-enforcement exclude globs from the toolkit
 * config (`scaffold-mcp.hook.excludeGlobs` in .toolkit/settings.yaml).
 *
 * Fails open (returns an empty array) when the config is missing or unreadable so a
 * broken config never blocks writes.
 *
 * @param cwd - Directory to resolve the workspace config from (walks up to the root).
 * @returns The configured exclude globs, or an empty array when none are set.
 */
export async function getGlobalExcludeGlobs(cwd: string): Promise<string[]> {
  try {
    const config = await TemplatesManagerService.readToolkitConfig(cwd);
    const globs = config?.['scaffold-mcp']?.hook?.excludeGlobs;
    return Array.isArray(globs) ? globs : [];
  } catch {
    return [];
  }
}

export async function resolveNewFileWriteTarget(
  cwd: string,
  toolName: string,
  filePath?: string,
): Promise<string | null> {
  if (!filePath || toolName.toLowerCase() !== 'write') {
    return null;
  }

  const absoluteFilePath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  if (!absoluteFilePath.startsWith(cwd + path.sep) && absoluteFilePath !== cwd) {
    return null;
  }

  try {
    await fs.access(absoluteFilePath);
    return null;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return absoluteFilePath;
    }
    throw error;
  }
}

export function formatScaffoldMethodsHookMessage(
  methods: ScaffoldMethodSummary[],
  options?: {
    includeRequiredVars?: boolean;
    maxMethods?: number;
    requiredVarsMethodLimit?: number;
    maxRequiredVars?: number;
  },
): string {
  const maxMethods = options?.maxMethods ?? MAX_SCAFFOLD_METHODS_IN_HOOK;
  const requiredVarsMethodLimit = options?.requiredVarsMethodLimit ?? REQUIRED_VARS_METHOD_LIMIT;
  const maxRequiredVars = options?.maxRequiredVars ?? MAX_REQUIRED_VARS_IN_HOOK;
  const visibleMethods = methods.slice(0, maxMethods);
  const hiddenCount = Math.max(methods.length - visibleMethods.length, 0);

  let message = 'Before writing this new file, use `use-scaffold-method` if any of these fit:\n\n';

  for (const [index, method] of visibleMethods.entries()) {
    message += `- **${method.name}**: ${method.description || 'No description available'}\n`;

    if (options?.includeRequiredVars && index < requiredVarsMethodLimit) {
      const requiredVars = method.variables_schema?.required ?? [];
      if (requiredVars.length > 0) {
        const visibleVars = requiredVars.slice(0, maxRequiredVars);
        const moreCount = Math.max(requiredVars.length - visibleVars.length, 0);
        const suffix = moreCount > 0 ? `, +${moreCount} more` : '';
        message += `  Required: ${visibleVars.join(', ')}${suffix}\n`;
      }
    }
  }

  if (hiddenCount > 0) {
    message += `\n...and ${hiddenCount} more methods. Call \`list-scaffolding-methods\` for the full list.\n`;
  }

  return message.trimEnd();
}
