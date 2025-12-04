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
        hook_event_name: 'PreToolUse',
        tool_use_id: 'tool-use-123',
        transcript_path: '/path/to/transcript.txt',
        permission_mode: 'ask',
        llm_tool: 'claude-code',
      });

      const context = adapter.parseInput(input);

      expect(context.tool_name).toBe('Read');
      expect(context.tool_input).toEqual({ file_path: '/test/file.ts', limit: 100 });
      expect(context.cwd).toBe('/workspace');
      expect(context.session_id).toBe('session-123');
      expect(context.llm_tool).toBe('claude-code');
      expect(context.hook_event_name).toBe('PreToolUse');
    });

    test.each([
      ['Write', { file_path: '/test/file.ts', content: 'test' }],
      ['Edit', { file_path: '/test/file.ts', old_string: 'old', new_string: 'new' }],
      ['Read', { file_path: '/test/file.ts' }],
    ])('parses %s tool correctly', (toolName, toolInput) => {
      const input = JSON.stringify({
        tool_name: toolName,
        tool_input: toolInput,
        cwd: '/workspace',
        session_id: 'session-test',
        hook_event_name: 'PreToolUse',
        tool_use_id: 'tool-use-test',
        transcript_path: '/path/to/transcript.txt',
        permission_mode: 'ask',
      });

      const context = adapter.parseInput(input);

      expect(context.tool_name).toBe(toolName);
      expect(context.tool_input).toEqual(toolInput);
    });

    test('parses non-file tools correctly', () => {
      const input = JSON.stringify({
        tool_name: 'Bash',
        tool_input: { command: 'ls -la' },
        cwd: '/workspace',
        session_id: 'session-999',
        hook_event_name: 'PreToolUse',
        tool_use_id: 'tool-use-999',
        transcript_path: '/path/to/transcript.txt',
        permission_mode: 'ask',
      });

      const context = adapter.parseInput(input);

      expect(context.tool_name).toBe('Bash');
      expect(context.tool_input).toEqual({ command: 'ls -la' });
    });

    test('handles missing optional llm_tool field', () => {
      const input = JSON.stringify({
        tool_name: 'Read',
        tool_input: { file_path: '/test/file.ts' },
        cwd: '/workspace',
        session_id: 'session-111',
        hook_event_name: 'PreToolUse',
        tool_use_id: 'tool-use-111',
        transcript_path: '/path/to/transcript.txt',
        permission_mode: 'ask',
      });

      const context = adapter.parseInput(input);

      expect(context.llm_tool).toBeUndefined();
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
      // Parse input first to set PreToolUse mode
      const input = JSON.stringify({
        tool_name: 'Read',
        tool_input: { file_path: '/test/file.ts' },
        cwd: '/workspace',
        session_id: 'session-123',
        hook_event_name: 'PreToolUse',
        tool_use_id: 'tool-use-123',
        transcript_path: '/path/to/transcript.txt',
        permission_mode: 'ask',
      });
      adapter.parseInput(input);

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
      // Parse input first
      const input = JSON.stringify({
        tool_name: 'Read',
        tool_input: { file_path: '/test/file.ts' },
        cwd: '/workspace',
        session_id: 'session-123',
        hook_event_name: 'PreToolUse',
        tool_use_id: 'tool-use-123',
        transcript_path: '/path/to/transcript.txt',
        permission_mode: 'ask',
      });
      adapter.parseInput(input);

      const response = {
        decision: 'skip' as const,
        message: '',
      };

      const output = adapter.formatOutput(response);
      const parsed = JSON.parse(output);

      expect(parsed).toEqual({});
    });

    test('includes updatedInput when provided', () => {
      // Parse input first
      const input = JSON.stringify({
        tool_name: 'Write',
        tool_input: { file_path: '/test/file.ts', content: 'old content' },
        cwd: '/workspace',
        session_id: 'session-123',
        hook_event_name: 'PreToolUse',
        tool_use_id: 'tool-use-123',
        transcript_path: '/path/to/transcript.txt',
        permission_mode: 'ask',
      });
      adapter.parseInput(input);

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
      // Parse input first
      const input = JSON.stringify({
        tool_name: 'Read',
        tool_input: { file_path: '/test/file.ts' },
        cwd: '/workspace',
        session_id: 'session-123',
        hook_event_name: 'PreToolUse',
        tool_use_id: 'tool-use-123',
        transcript_path: '/path/to/transcript.txt',
        permission_mode: 'ask',
      });
      adapter.parseInput(input);

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
