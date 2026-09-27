import { vi } from 'vitest';
import type { IScaffoldConfigLoader } from '../../src/types/interfaces';
import type {
  ArchitectConfig,
  ParsedInclude,
  TemplateValidationResult,
} from '../../src/types/scaffold';

export const createMockScaffoldConfigLoader = (): IScaffoldConfigLoader => ({
  parseArchitectConfig: vi.fn().mockResolvedValue({
    boilerplate: {
      name: 'test-boilerplate',
      description: 'Test boilerplate',
      variables_schema: {
        type: 'object',
        properties: {
          appName: { type: 'string', description: 'App name' },
        },
        required: ['appName'],
        additionalProperties: false,
      },
      includes: ['package.json', 'src/index.ts'],
    },
  } satisfies ArchitectConfig),

  parseIncludeEntry: vi
    .fn()
    .mockImplementation((entry: string, _variables: Record<string, any>): ParsedInclude => {
      const [pathPart, conditionsPart] = entry.split('?');
      const conditions: Record<string, string> = {};

      if (conditionsPart) {
        conditionsPart.split('&').forEach((pair) => {
          const [key, value] = pair.split('=');
          if (key && value) conditions[key.trim()] = value.trim();
        });
      }

      if (pathPart.includes('->')) {
        const [sourcePath, targetPath] = pathPart.split('->').map((p) => p.trim());
        return { sourcePath, targetPath, conditions };
      }

      return {
        sourcePath: pathPart.trim(),
        targetPath: pathPart.trim(),
        conditions,
      };
    }),

  replaceVariablesInPath: vi.fn().mockImplementation((path: string) => path),

  shouldIncludeFile: vi.fn().mockReturnValue(true),

  validateTemplate: vi.fn().mockResolvedValue({
    isValid: true,
    errors: [],
    missingFiles: [],
  } as TemplateValidationResult),
});
