/**
 * Tests for AdapterProxyService
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdapterProxyService } from '../../src/services/AdapterProxyService';
import { CLAUDE_CODE } from '@agiflowai/coding-agent-bridge';
import { PRE_TOOL_USE, POST_TOOL_USE } from '../../src/constants';
import type { HookCallback } from '../../src/types';

describe('AdapterProxyService', () => {
  let originalExit: typeof process.exit;
  let mockCallback: HookCallback;

  beforeEach(() => {
    originalExit = process.exit;

    // Mock process.exit to prevent test termination
    process.exit = vi.fn(() => {
      throw new Error('EXIT');
    }) as any;

    mockCallback = vi.fn(async () => ({
      decision: 'skip' as const,
      message: '',
    }));
  });

  afterEach(() => {
    process.exit = originalExit;
    vi.restoreAllMocks();
  });

  describe('execute', () => {
    test('throws error for unsupported agent', async () => {
      await expect(
        AdapterProxyService.execute('unsupported-agent', PRE_TOOL_USE, mockCallback),
      ).rejects.toThrow('Unknown agent: unsupported-agent');
    });

    test('lists supported agents in error message', async () => {
      try {
        await AdapterProxyService.execute('unknown-agent', PRE_TOOL_USE, mockCallback);
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain(`Supported: ${CLAUDE_CODE}`);
      }
    });

    test('accepts claude-code agent with PreToolUse hook', async () => {
      // Mock stdin to prevent hanging
      vi.spyOn(process.stdin, 'on').mockImplementation((event: string, handler: any) => {
        const input = JSON.stringify({
          tool_name: 'Read',
          tool_input: {},
          cwd: '/test',
          session_id: 'test',
        });

        if (event === 'data') {
          setImmediate(() => handler(Buffer.from(input)));
        } else if (event === 'end') {
          setImmediate(() => handler());
        }
        return process.stdin;
      });

      try {
        await AdapterProxyService.execute(CLAUDE_CODE, PRE_TOOL_USE, mockCallback);
      } catch (error: any) {
        if (error.message !== 'EXIT') throw error;
      }

      expect(mockCallback).toHaveBeenCalled();
    });

    test('accepts claude-code agent with PostToolUse hook', async () => {
      // Mock stdin to prevent hanging
      vi.spyOn(process.stdin, 'on').mockImplementation((event: string, handler: any) => {
        const input = JSON.stringify({
          session_id: 'test',
          transcript_path: '/test/transcript',
          cwd: '/test',
          permission_mode: 'default',
          hook_event_name: 'PostToolUse',
          tool_name: 'Edit',
          tool_input: { file_path: '/test/file.ts' },
          tool_response: {},
          tool_use_id: 'test-id',
        });

        if (event === 'data') {
          setImmediate(() => handler(Buffer.from(input)));
        } else if (event === 'end') {
          setImmediate(() => handler());
        }
        return process.stdin;
      });

      try {
        await AdapterProxyService.execute(CLAUDE_CODE, POST_TOOL_USE, mockCallback);
      } catch (error: any) {
        if (error.message !== 'EXIT') throw error;
      }

      expect(mockCallback).toHaveBeenCalled();
    });
  });
});
