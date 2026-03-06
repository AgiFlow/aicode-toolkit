import path from 'node:path';
import fs from 'node:fs/promises';

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
