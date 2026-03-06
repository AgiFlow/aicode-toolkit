import { describe, expect, it } from 'vitest';
import { resolveFallbackConfig } from '../../src/utils/fallbacks';

describe('resolveFallbackConfig', () => {
  it('prefers singular fallback settings over the fallback list', () => {
    expect(
      resolveFallbackConfig({
        fallbackTool: 'gemini-cli',
        fallbackToolConfig: { model: 'gemini-2.0-flash' },
        fallbacks: [{ tool: 'codex', config: { model: 'gpt-5.2-mini' } }],
      }),
    ).toEqual({
      tool: 'gemini-cli',
      config: { model: 'gemini-2.0-flash' },
    });
  });

  it('returns the first valid fallback from an ordered list', () => {
    expect(
      resolveFallbackConfig({
        fallbacks: [
          { tool: '', config: { model: 'ignore-me' } },
          { tool: 'codex', config: { model: 'gpt-5.2-mini' } },
          { tool: 'gemini-cli', config: { model: 'gemini-2.0-flash' } },
        ],
      }),
    ).toEqual({
      tool: 'codex',
      config: { model: 'gpt-5.2-mini' },
    });
  });

  it('supports hook-style fallback keys', () => {
    expect(
      resolveFallbackConfig({
        'fallback-tool': 'gemini-cli',
        'fallback-tool-config': { model: 'gemini-2.0-flash' },
      }),
    ).toEqual({
      tool: 'gemini-cli',
      config: { model: 'gemini-2.0-flash' },
    });
  });
});
