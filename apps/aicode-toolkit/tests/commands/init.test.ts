import { describe, expect, it } from 'vitest';
import { resolveGeneratedSettingsValues, resolveOra } from '../../src/commands/init';

function createOra() {
  return () => ({
    start: () => undefined,
  });
}

describe('resolveOra', () => {
  it('resolves direct ora exports', () => {
    const ora = createOra();

    expect(resolveOra(ora)).toBe(ora);
  });

  it('resolves nested default exports from CJS wrappers around ESM modules', () => {
    const ora = createOra();

    expect(resolveOra({ default: { default: ora } })).toBe(ora);
  });

  it('throws when no ora function can be resolved', () => {
    expect(() => resolveOra({ default: {} })).toThrow('Unable to resolve ora instance');
  });
});

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
