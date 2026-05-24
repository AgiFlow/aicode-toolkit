import { describe, expect, it } from 'vitest';
import { resolveGradient } from '../../src/utils/banner';

function createGradient() {
  return Object.assign(() => 'gradient text', {
    pastel: Object.assign((text: string) => text, {
      multiline: (text: string) => text,
    }),
  });
}

describe('resolveGradient', () => {
  it('resolves direct gradient-string exports', () => {
    const gradient = createGradient();

    expect(resolveGradient(gradient)).toBe(gradient);
  });

  it('resolves nested default exports from CJS wrappers around ESM modules', () => {
    const gradient = createGradient();

    expect(resolveGradient({ default: { default: gradient } })).toBe(gradient);
  });

  it('throws when no gradient-string function can be resolved', () => {
    expect(() => resolveGradient({ default: {} })).toThrow(
      'Unable to resolve gradient-string instance',
    );
  });
});
