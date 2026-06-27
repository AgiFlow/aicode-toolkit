import path from 'node:path';
import fs from 'node:fs/promises';
import { minimatch } from 'minimatch';

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
 * Globs for new-file write targets that are never scaffoldable source files.
 * Scaffold methods carry no target glob, so the hook cannot tell whether a method
 * applies to a given path. Without this allow-list it denies every new-file write
 * once any method exists, which pushes agents to bypass the hook via Bash heredocs
 * (skipping downstream review hooks). Content files matching these globs are written
 * directly instead.
 */
export const NON_SCAFFOLDABLE_GLOBS = ['**/src/content/**', '**/*.md', '**/*.mdx'];

/**
 * Returns true when an absolute write target is clearly non-scaffoldable content
 * (markdown/MDX docs, or anything under a src/content directory).
 *
 * `dot: true` lets the globs traverse dot-directories (e.g. worktree paths) so a
 * content file nested under one is not misclassified as scaffoldable.
 */
export function isNonScaffoldableTarget(absPath: string): boolean {
  return NON_SCAFFOLDABLE_GLOBS.some((glob) => minimatch(absPath, glob, { dot: true }));
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
