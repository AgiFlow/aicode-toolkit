/**
 * Tests for ClaudeCodeAdapter (PostToolUse mode)
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { ClaudeCodeAdapter } from '../../src/adapters/ClaudeCodeAdapter';

describe('ClaudeCodeAdapter (PostToolUse)', () => {
  let adapter: ClaudeCodeAdapter;

  beforeEach(() => {
    adapter = new ClaudeCodeAdapter();
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

      expect(context.tool_name).toBe('Read');
      expect(context.tool_input).toEqual({ file_path: '/test/file.ts', limit: 100 });
      expect(context.tool_response).toEqual({ content: 'file content' });
      expect(context.cwd).toBe('/workspace');
      expect(context.session_id).toBe('session-123');
      expect(context.llm_tool).toBe('claude-code');
      expect(context.hook_event_name).toBe('PostToolUse');
    });

    test.each([
      ['Write', { file_path: '/test/file.ts', content: 'test' }],
      ['Edit', { file_path: '/test/file.ts', old_string: 'a', new_string: 'b' }],
      ['Read', { file_path: '/test/file.ts' }],
    ])('parses %s tool input correctly', (toolName, toolInput) => {
      const input = JSON.stringify({
        session_id: 'session-test',
        transcript_path: '/path/to/transcript.txt',
        cwd: '/workspace',
        permission_mode: 'ask',
        hook_event_name: 'PostToolUse',
        tool_name: toolName,
        tool_input: toolInput,
        tool_response: {},
        tool_use_id: 'tool-use-123',
      });

      const context = adapter.parseInput(input);

      expect(context.tool_name).toBe(toolName);
      expect(context.tool_input).toEqual(toolInput);
    });

    test('parses tool_input with file_path', () => {
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

      expect(context.tool_input.file_path).toBe('/test/input-file.ts');
    });

    test('parses tool_response correctly', () => {
      const input = JSON.stringify({
        session_id: 'session-789',
        transcript_path: '/path/to/transcript.txt',
        cwd: '/workspace',
        permission_mode: 'ask',
        hook_event_name: 'PostToolUse',
        tool_name: 'Read',
        tool_input: {},
        tool_response: { filePath: '/test/response-file.ts', content: 'file content' },
        tool_use_id: 'tool-use-789',
      });

      const context = adapter.parseInput(input);

      expect(context.tool_response).toEqual({
        filePath: '/test/response-file.ts',
        content: 'file content',
      });
    });

    test('parses non-file tool operations', () => {
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

      expect(context.tool_name).toBe('Bash');
      expect(context.tool_input).toEqual({ command: 'ls -la' });
      expect(context.tool_response).toEqual({ output: 'file1.txt' });
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
      // First parse input to set hookEventName
      const input = JSON.stringify({
        session_id: 'session-123',
        transcript_path: '/path/to/transcript.txt',
        cwd: '/workspace',
        permission_mode: 'ask',
        hook_event_name: 'PostToolUse',
        tool_name: 'Write',
        tool_input: { file_path: '/test/file.ts' },
        tool_response: {},
        tool_use_id: 'tool-use-456',
      });
      adapter.parseInput(input);

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
      // Set PostToolUse mode
      const input = JSON.stringify({
        session_id: 'session-123',
        hook_event_name: 'PostToolUse',
        tool_name: 'Write',
        tool_input: {},
        tool_response: {},
        tool_use_id: 'tool-use-456',
        cwd: '/workspace',
        transcript_path: '/path',
        permission_mode: 'ask',
      });
      adapter.parseInput(input);

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
      // Set PostToolUse mode
      const input = JSON.stringify({
        session_id: 'session-123',
        hook_event_name: 'PostToolUse',
        tool_name: 'Write',
        tool_input: {},
        tool_response: {},
        tool_use_id: 'tool-use-456',
        cwd: '/workspace',
        transcript_path: '/path',
        permission_mode: 'ask',
      });
      adapter.parseInput(input);

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
      // Set PostToolUse mode
      const input = JSON.stringify({
        session_id: 'session-123',
        hook_event_name: 'PostToolUse',
        tool_name: 'Write',
        tool_input: {},
        tool_response: {},
        tool_use_id: 'tool-use-456',
        cwd: '/workspace',
        transcript_path: '/path',
        permission_mode: 'ask',
      });
      adapter.parseInput(input);

      const response = {
        decision: 'skip' as const,
        message: '',
      };

      const output = adapter.formatOutput(response);
      const parsed = JSON.parse(output);

      // Skip returns empty object
      expect(Object.keys(parsed).length).toBe(0);
    });

    test('formats ask decision without blocking', () => {
      // Set PostToolUse mode
      const input = JSON.stringify({
        session_id: 'session-123',
        hook_event_name: 'PostToolUse',
        tool_name: 'Write',
        tool_input: {},
        tool_response: {},
        tool_use_id: 'tool-use-456',
        cwd: '/workspace',
        transcript_path: '/path',
        permission_mode: 'ask',
      });
      adapter.parseInput(input);

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
