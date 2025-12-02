/**
 * Tests for ClaudeCodePostToolUseAdapter
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { ClaudeCodePostToolUseAdapter } from '../../src/adapters/ClaudeCodePostToolUseAdapter';

describe('ClaudeCodePostToolUseAdapter', () => {
  let adapter: ClaudeCodePostToolUseAdapter;

  beforeEach(() => {
    adapter = new ClaudeCodePostToolUseAdapter();
  });

  describe('parseInput', () => {
    test('parses complete PostToolUse input', () => {
      const input = JSON.stringify({
        session_id: 'session-123',
        transcript_path: '/path/to/transcript.txt',
        cwd: '/workspace',
        permission_mode: 'ask',
        hook_event_name: 'PostToolUse',
        tool_name: 'Read',
        tool_input: { file_path: '/test/file.ts', limit: 100 },
        tool_response: { content: 'file content' },
        tool_use_id: 'tool-use-456',
        llm_tool: 'claude-code',
      });

      const context = adapter.parseInput(input);

      expect(context.toolName).toBe('Read');
      expect(context.toolInput).toEqual({ file_path: '/test/file.ts', limit: 100 });
      expect(context.filePath).toBe('/test/file.ts');
      expect(context.operation).toBe('read');
      expect(context.cwd).toBe('/workspace');
      expect(context.sessionId).toBe('session-123');
      expect(context.llmTool).toBe('claude-code');
    });

    test.each([
      ['Write', 'write'],
      ['Edit', 'edit'],
      ['Read', 'read'],
    ])('extracts %s operation as %s', (toolName, operation) => {
      const input = JSON.stringify({
        session_id: 'session-test',
        transcript_path: '/path/to/transcript.txt',
        cwd: '/workspace',
        permission_mode: 'ask',
        hook_event_name: 'PostToolUse',
        tool_name: toolName,
        tool_input: { file_path: '/test/file.ts' },
        tool_response: {},
        tool_use_id: 'tool-use-123',
      });

      const context = adapter.parseInput(input);

      expect(context.operation).toBe(operation);
    });

    test('extracts filePath from tool_input', () => {
      const input = JSON.stringify({
        session_id: 'session-789',
        transcript_path: '/path/to/transcript.txt',
        cwd: '/workspace',
        permission_mode: 'ask',
        hook_event_name: 'PostToolUse',
        tool_name: 'Read',
        tool_input: { file_path: '/test/input-file.ts' },
        tool_response: {},
        tool_use_id: 'tool-use-789',
      });

      const context = adapter.parseInput(input);

      expect(context.filePath).toBe('/test/input-file.ts');
    });

    test('extracts filePath from tool_response when not in tool_input', () => {
      const input = JSON.stringify({
        session_id: 'session-789',
        transcript_path: '/path/to/transcript.txt',
        cwd: '/workspace',
        permission_mode: 'ask',
        hook_event_name: 'PostToolUse',
        tool_name: 'Read',
        tool_input: {},
        tool_response: { filePath: '/test/response-file.ts' },
        tool_use_id: 'tool-use-789',
      });

      const context = adapter.parseInput(input);

      expect(context.filePath).toBe('/test/response-file.ts');
    });

    test('returns undefined for non-file tool operations', () => {
      const input = JSON.stringify({
        session_id: 'session-999',
        transcript_path: '/path/to/transcript.txt',
        cwd: '/workspace',
        permission_mode: 'ask',
        hook_event_name: 'PostToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'ls -la' },
        tool_response: { output: 'file1.txt' },
        tool_use_id: 'tool-use-999',
      });

      const context = adapter.parseInput(input);

      expect(context.filePath).toBeUndefined();
      expect(context.operation).toBeUndefined();
    });

    test('handles missing llm_tool field', () => {
      const input = JSON.stringify({
        session_id: 'session-111',
        transcript_path: '/path/to/transcript.txt',
        cwd: '/workspace',
        permission_mode: 'ask',
        hook_event_name: 'PostToolUse',
        tool_name: 'Read',
        tool_input: { file_path: '/test/file.ts' },
        tool_response: {},
        tool_use_id: 'tool-use-111',
      });

      const context = adapter.parseInput(input);

      expect(context.llmTool).toBeUndefined();
    });

    test('throws error on invalid JSON', () => {
      expect(() => adapter.parseInput('invalid json')).toThrow();
    });

    test('throws error on empty input', () => {
      expect(() => adapter.parseInput('')).toThrow();
    });
  });

  describe('formatOutput', () => {
    test('formats deny decision as block', () => {
      const response = {
        decision: 'deny' as const,
        message: 'Operation blocked',
      };

      const output = adapter.formatOutput(response);
      const parsed = JSON.parse(output);

      expect(parsed.decision).toBe('block');
      expect(parsed.reason).toBe('Operation blocked');
      expect(parsed.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    });

    test('formats allow decision with message as additionalContext', () => {
      const response = {
        decision: 'allow' as const,
        message: 'Code review feedback',
      };

      const output = adapter.formatOutput(response);
      const parsed = JSON.parse(output);

      expect(parsed.decision).toBeUndefined();
      expect(parsed.reason).toBeUndefined();
      expect(parsed.hookSpecificOutput.additionalContext).toBe('Code review feedback');
      expect(parsed.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    });

    test('formats allow decision without message', () => {
      const response = {
        decision: 'allow' as const,
        message: '',
      };

      const output = adapter.formatOutput(response);
      const parsed = JSON.parse(output);

      expect(parsed.decision).toBeUndefined();
      expect(parsed.reason).toBeUndefined();
      expect(parsed.hookSpecificOutput.additionalContext).toBeUndefined();
    });

    test('formats skip decision without blocking', () => {
      const response = {
        decision: 'skip' as const,
        message: '',
      };

      const output = adapter.formatOutput(response);
      const parsed = JSON.parse(output);

      expect(parsed.decision).toBeUndefined();
      expect(parsed.reason).toBeUndefined();
      expect(parsed.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    });

    test('formats ask decision without blocking', () => {
      const response = {
        decision: 'ask' as const,
        message: 'Review needed',
      };

      const output = adapter.formatOutput(response);
      const parsed = JSON.parse(output);

      // 'ask' is not 'deny' so no block, and not 'allow' so no additionalContext
      expect(parsed.decision).toBeUndefined();
      expect(parsed.reason).toBeUndefined();
      expect(parsed.hookSpecificOutput.additionalContext).toBeUndefined();
      expect(parsed.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    });
  });
});
