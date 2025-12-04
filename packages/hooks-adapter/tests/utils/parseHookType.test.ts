/**
 * Tests for parseHookType utility
 */

import { describe, it, expect } from 'vitest';
import Chance from 'chance';
import { parseHookType } from '../../src/utils/parseHookType';

/** Seeded random generator for reproducible tests */
const chance = new Chance(12345);

describe('parseHookType', () => {
  describe('valid inputs', () => {
    it('should parse claude-code.preToolUse correctly', () => {
      const result = parseHookType('claude-code.preToolUse');

      expect(result.agent).toBe('claude-code');
      expect(result.hookMethod).toBe('preToolUse');
    });

    it('should parse claude-code.postToolUse correctly', () => {
      const result = parseHookType('claude-code.postToolUse');

      expect(result.agent).toBe('claude-code');
      expect(result.hookMethod).toBe('postToolUse');
    });

    it('should parse gemini-cli.beforeTool correctly', () => {
      const result = parseHookType('gemini-cli.beforeTool');

      expect(result.agent).toBe('gemini-cli');
      expect(result.hookMethod).toBe('beforeTool');
    });

    it('should parse gemini-cli.afterTool correctly', () => {
      const result = parseHookType('gemini-cli.afterTool');

      expect(result.agent).toBe('gemini-cli');
      expect(result.hookMethod).toBe('afterTool');
    });

    it('should handle arbitrary agent and method names', () => {
      const agent = chance.word();
      const method = chance.word();
      const result = parseHookType(`${agent}.${method}`);

      expect(result.agent).toBe(agent);
      expect(result.hookMethod).toBe(method);
    });

    it('should only split on first dot when method contains dots', () => {
      // Note: Current implementation only returns the first segment after the dot
      // This tests the actual behavior of split('.')[1]
      const result = parseHookType('agent.method.extra');

      expect(result.agent).toBe('agent');
      expect(result.hookMethod).toBe('method');
    });
  });

  describe('invalid inputs', () => {
    it('should throw error for missing hook method', () => {
      expect(() => parseHookType('claude-code')).toThrow(
        'Invalid hook type: claude-code. Expected: <agent>.<hookMethod>',
      );
    });

    it('should throw error for missing agent', () => {
      expect(() => parseHookType('.preToolUse')).toThrow(
        'Invalid hook type: .preToolUse. Expected: <agent>.<hookMethod>',
      );
    });

    it('should throw error for empty string', () => {
      expect(() => parseHookType('')).toThrow(
        'Invalid hook type: . Expected: <agent>.<hookMethod>',
      );
    });

    it('should throw error for string with only dot', () => {
      expect(() => parseHookType('.')).toThrow(
        'Invalid hook type: .. Expected: <agent>.<hookMethod>',
      );
    });

    it('should throw error for string without dot separator', () => {
      const invalidInput = chance.word();
      expect(() => parseHookType(invalidInput)).toThrow(
        `Invalid hook type: ${invalidInput}. Expected: <agent>.<hookMethod>`,
      );
    });
  });
});
