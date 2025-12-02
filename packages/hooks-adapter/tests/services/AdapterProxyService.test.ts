/**
 * Tests for AdapterProxyService
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdapterProxyService, type HookCallbackRegistry } from '../../src/services/AdapterProxyService';

describe('AdapterProxyService', () => {
  let callbackRegistry: HookCallbackRegistry;
  let originalExit: typeof process.exit;
  let exitCalled: boolean;

  beforeEach(() => {
    originalExit = process.exit;
    exitCalled = false;

    // Mock process.exit to prevent test termination
    process.exit = vi.fn(() => {
      exitCalled = true;
      throw new Error('EXIT');
    }) as any;

    callbackRegistry = {
      'ClaudeCode.PreToolUse': vi.fn(async () => ({
        decision: 'skip' as const,
        message: '',
      })),
      'ClaudeCode.PostToolUse': vi.fn(async () => ({
        decision: 'skip' as const,
        message: '',
      })),
    };
  });

  afterEach(() => {
    process.exit = originalExit;
    vi.restoreAllMocks();
  });

  describe('execute', () => {
    test.each([
      ['InvalidFormat', 'Invalid hook format'],
      ['.PreToolUse', 'Invalid hook format'],
      ['ClaudeCode.', 'Invalid hook format'],
      ['', 'Invalid hook format'],
    ])('throws error for invalid format: %s', async (format, expectedError) => {
      await expect(
        AdapterProxyService.execute(format, callbackRegistry)
      ).rejects.toThrow(expectedError);
    });

    test('throws error when callback not registered', async () => {
      await expect(
        AdapterProxyService.execute('ClaudeCode.UnknownHook', callbackRegistry)
      ).rejects.toThrow('No callback registered for ClaudeCode.UnknownHook');
    });

    test('includes available callbacks in error message when callback not found', async () => {
      try {
        await AdapterProxyService.execute('ClaudeCode.UnknownHook', callbackRegistry);
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Available:');
        expect(error.message).toContain('ClaudeCode.PreToolUse');
        expect(error.message).toContain('ClaudeCode.PostToolUse');
      }
    });

    test('throws error for unsupported agent', async () => {
      const registry = {
        'UnsupportedAgent.PreToolUse': vi.fn(),
      };

      await expect(
        AdapterProxyService.execute('UnsupportedAgent.PreToolUse', registry)
      ).rejects.toThrow('Unknown agent: UnsupportedAgent');
    });

    test('lists supported agents in error message', async () => {
      const registry = {
        'UnknownAgent.PreToolUse': vi.fn(),
      };

      try {
        await AdapterProxyService.execute('UnknownAgent.PreToolUse', registry);
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Supported: ClaudeCode');
      }
    });

    test.each([
      ['ClaudeCode.PreToolUse'],
      ['claudecode.PreToolUse'],
      ['CLAUDECODE.PreToolUse'],
    ])('handles case insensitive agent names: %s', async (hookFormat) => {
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

      const registry = {
        [hookFormat]: vi.fn(async () => ({
          decision: 'skip' as const,
          message: '',
        })),
      };

      try {
        await AdapterProxyService.execute(hookFormat, registry);
      } catch (error: any) {
        if (error.message !== 'EXIT') throw error;
      }

      expect(registry[hookFormat]).toHaveBeenCalled();
    });
  });
});
