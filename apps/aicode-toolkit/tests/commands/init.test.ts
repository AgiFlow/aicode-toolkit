import { describe, expect, it } from 'vitest';
import { resolveGeneratedSettingsValues } from '../../src/commands/init';

describe('resolveGeneratedSettingsValues', () => {
  it('defaults templatesPath to templates when init skips template setup', () => {
    expect(
      resolveGeneratedSettingsValues({
        workspaceRoot: '/tmp/workspace',
      }),
    ).toEqual({
      relativeTemplatesPath: 'templates',
      sourceTemplate: undefined,
    });
  });

  it('uses the first selected template when available', () => {
    expect(
      resolveGeneratedSettingsValues({
        workspaceRoot: '/tmp/workspace',
        templatesPath: '/tmp/workspace/custom/templates',
        selectedTemplates: ['nextjs-15-drizzle', 'typescript-lib'],
      }),
    ).toEqual({
      relativeTemplatesPath: 'custom/templates',
      sourceTemplate: 'nextjs-15-drizzle',
    });
  });
});
