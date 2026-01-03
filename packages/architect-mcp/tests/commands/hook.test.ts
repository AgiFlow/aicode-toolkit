/**
 * Hook Command Tests
 *
 * TESTING PATTERNS:
 * - Test toolConfig JSON parsing and validation
 * - Test isRecordObject type guard
 * - Test error handling for invalid inputs
 *
 * CODING STANDARDS:
 * - Use describe blocks to group related tests
 * - Use test or it for individual test cases
 * - Test both success and error cases
 * - Use test.each for parameterized tests
 */

import { describe, test, expect } from 'vitest';
import { isValidLlmTool } from '@agiflowai/coding-agent-bridge';

/**
 * Type guard to validate parsed JSON is a record object
 * (Duplicated from hook.ts for isolated unit testing)
 */
function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parse toolConfig JSON string
 * (Duplicated from hook.ts for isolated unit testing)
 */
function parseToolConfig(toolConfigStr: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(toolConfigStr);
  if (!isRecordObject(parsed)) {
    throw new Error('--tool-config must be a JSON object, not an array or primitive value');
  }
  return parsed;
}

describe('hook command toolConfig', () => {
  describe('isRecordObject type guard', () => {
    test('returns true for plain objects', () => {
      expect(isRecordObject({})).toBe(true);
      expect(isRecordObject({ key: 'value' })).toBe(true);
      expect(isRecordObject({ model: 'gemini-3-flash-preview' })).toBe(true);
      expect(isRecordObject({ nested: { key: 'value' } })).toBe(true);
    });

    test('returns false for arrays', () => {
      expect(isRecordObject([])).toBe(false);
      expect(isRecordObject([1, 2, 3])).toBe(false);
      expect(isRecordObject(['a', 'b'])).toBe(false);
      expect(isRecordObject([{ key: 'value' }])).toBe(false);
    });

    test('returns false for null', () => {
      expect(isRecordObject(null)).toBe(false);
    });

    test('returns false for primitives', () => {
      expect(isRecordObject('string')).toBe(false);
      expect(isRecordObject(123)).toBe(false);
      expect(isRecordObject(true)).toBe(false);
      expect(isRecordObject(undefined)).toBe(false);
    });
  });

  describe('parseToolConfig', () => {
    test('parses valid JSON object', () => {
      const result = parseToolConfig('{"model":"gemini-3-flash-preview"}');
      expect(result).toEqual({ model: 'gemini-3-flash-preview' });
    });

    test('parses nested JSON object', () => {
      const result = parseToolConfig('{"config":{"model":"gpt-4","temperature":0.7}}');
      expect(result).toEqual({ config: { model: 'gpt-4', temperature: 0.7 } });
    });

    test('parses empty object', () => {
      const result = parseToolConfig('{}');
      expect(result).toEqual({});
    });

    test('throws error for JSON array', () => {
      expect(() => parseToolConfig('["a","b"]')).toThrow(
        '--tool-config must be a JSON object, not an array or primitive value',
      );
    });

    test('throws error for JSON primitive string', () => {
      expect(() => parseToolConfig('"just a string"')).toThrow(
        '--tool-config must be a JSON object, not an array or primitive value',
      );
    });

    test('throws error for JSON primitive number', () => {
      expect(() => parseToolConfig('123')).toThrow(
        '--tool-config must be a JSON object, not an array or primitive value',
      );
    });

    test('throws error for JSON null', () => {
      expect(() => parseToolConfig('null')).toThrow(
        '--tool-config must be a JSON object, not an array or primitive value',
      );
    });

    test('throws error for invalid JSON', () => {
      expect(() => parseToolConfig('not valid json')).toThrow();
    });

    test('throws error for malformed JSON', () => {
      expect(() => parseToolConfig('{"key": value}')).toThrow();
    });
  });

  describe('toolConfig integration scenarios', () => {
    test.each([
      ['{"model":"gemini-3-flash-preview"}', { model: 'gemini-3-flash-preview' }],
      ['{"model":"gpt-4","temperature":0.5}', { model: 'gpt-4', temperature: 0.5 }],
      ['{"timeout":30000}', { timeout: 30000 }],
      ['{"features":{"streaming":true}}', { features: { streaming: true } }],
    ])('parseToolConfig(%s) returns %o', (input, expected) => {
      expect(parseToolConfig(input)).toEqual(expected);
    });

    test.each([
      ['[]', 'array'],
      ['[1,2,3]', 'array with numbers'],
      ['"string"', 'string primitive'],
      ['123', 'number primitive'],
      ['true', 'boolean primitive'],
      ['null', 'null'],
    ])('parseToolConfig(%s) throws for %s', (input) => {
      expect(() => parseToolConfig(input)).toThrow(
        '--tool-config must be a JSON object, not an array or primitive value',
      );
    });
  });
});

describe('hook command llmTool', () => {
  describe('isValidLlmTool validation', () => {
    test('returns true for valid LLM tools', () => {
      expect(isValidLlmTool('claude-code')).toBe(true);
      expect(isValidLlmTool('gemini-cli')).toBe(true);
    });

    test('returns false for invalid LLM tools', () => {
      expect(isValidLlmTool('invalid-tool')).toBe(false);
      expect(isValidLlmTool('gpt-4')).toBe(false);
      expect(isValidLlmTool('')).toBe(false);
      expect(isValidLlmTool('Claude-Code')).toBe(false); // case sensitive
      expect(isValidLlmTool('CLAUDE_CODE')).toBe(false);
    });

    test('returns false for non-string values', () => {
      expect(isValidLlmTool(null as unknown as string)).toBe(false);
      expect(isValidLlmTool(undefined as unknown as string)).toBe(false);
      expect(isValidLlmTool(123 as unknown as string)).toBe(false);
      expect(isValidLlmTool({} as unknown as string)).toBe(false);
    });
  });

  describe('llmTool integration scenarios', () => {
    test.each([
      ['claude-code', true],
      ['gemini-cli', true],
      ['invalid', false],
      ['openai', false],
      ['', false],
    ])('isValidLlmTool(%s) returns %s', (input, expected) => {
      expect(isValidLlmTool(input)).toBe(expected);
    });
  });
});
