/**
 * Tests for ClaudeCodeAdapter
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { ClaudeCodeAdapter } from '../../src/adapters/ClaudeCodeAdapter';

describe('ClaudeCodeAdapter', () => {
  let adapter: ClaudeCodeAdapter;

  beforeEach(() => {
    adapter = new ClaudeCodeAdapter();
  });

  describe('parseInput', () => {
    test('parses Claude Code stdin format with all fields', () => {
      const input = JSON.stringify({
        tool_name: 'Read',
        tool_input: { file_path: '/test/file.ts', limit: 100 },
        cwd: '/workspace',
        session_id: 'session-123',
        llm_tool: 'claude-code',
      });

      const context = adapter.parseInput(input);

      expect(context).toEqual({
        toolName: 'Read',
        toolInput: { file_path: '/test/file.ts', limit: 100 },
        filePath: '/test/file.ts',
        operation: 'read',
        cwd: '/workspace',
        sessionId: 'session-123',
        llmTool: 'claude-code',
      });
    });

    test.each([
      ['Write', 'write', { file_path: '/test/file.ts', content: 'test' }],
      ['Edit', 'edit', { file_path: '/test/file.ts', old_string: 'old', new_string: 'new' }],
      ['Read', 'read', { file_path: '/test/file.ts' }],
    ])('parses %s tool with operation %s', (toolName, operation, toolInput) => {
      const input = JSON.stringify({
        tool_name: toolName,
        tool_input: toolInput,
        cwd: '/workspace',
        session_id: 'session-test',
      });

      const context = adapter.parseInput(input);

      expect(context.toolName).toBe(toolName);
      expect(context.filePath).toBe('/test/file.ts');
      expect(context.operation).toBe(operation);
    });

    test('parses non-file tools without filePath or operation', () => {
      const input = JSON.stringify({
        tool_name: 'Bash',
        tool_input: { command: 'ls -la' },
        cwd: '/workspace',
        session_id: 'session-999',
      });

      const context = adapter.parseInput(input);

      expect(context.toolName).toBe('Bash');
      expect(context.filePath).toBeUndefined();
      expect(context.operation).toBeUndefined();
    });

    test('handles missing optional llm_tool field', () => {
      const input = JSON.stringify({
        tool_name: 'Read',
        tool_input: { file_path: '/test/file.ts' },
        cwd: '/workspace',
        session_id: 'session-111',
      });

      const context = adapter.parseInput(input);

      expect(context.llmTool).toBeUndefined();
    });

    test('throws error on invalid JSON', () => {
      expect(() => adapter.parseInput('invalid json')).toThrow();
    });
  });

  describe('formatOutput', () => {
    test.each([
      ['allow', 'Operation allowed'],
      ['deny', 'Operation denied'],
      ['ask', 'User confirmation needed'],
    ])('formats %s decision', (decision, message) => {
      const response = {
        decision: decision as 'allow' | 'deny' | 'ask',
        message,
      };

      const output = adapter.formatOutput(response);
      const parsed = JSON.parse(output);

      expect(parsed.hookSpecificOutput.permissionDecision).toBe(decision);
      expect(parsed.hookSpecificOutput.permissionDecisionReason).toBe(message);
      expect(parsed.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    });

    test('formats skip decision as empty object', () => {
      const response = {
        decision: 'skip' as const,
        message: '',
      };

      const output = adapter.formatOutput(response);
      const parsed = JSON.parse(output);

      expect(parsed).toEqual({});
    });

    test('includes updatedInput when provided', () => {
      const response = {
        decision: 'allow' as const,
        message: 'Updated parameters',
        updatedInput: { file_path: '/updated/file.ts', content: 'new content' },
      };

      const output = adapter.formatOutput(response);
      const parsed = JSON.parse(output);

      expect(parsed.hookSpecificOutput.updatedInput).toEqual({
        file_path: '/updated/file.ts',
        content: 'new content',
      });
    });

    test('excludes updatedInput when not provided', () => {
      const response = {
        decision: 'allow' as const,
        message: 'No updates',
      };

      const output = adapter.formatOutput(response);
      const parsed = JSON.parse(output);

      expect(parsed.hookSpecificOutput.updatedInput).toBeUndefined();
    });
  });
});
