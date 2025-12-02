/**
 * Tests for BaseAdapter
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseAdapter } from '../../src/adapters/BaseAdapter';
import type { HookContext, HookResponse } from '../../src/types';
import { Readable } from 'node:stream';

/**
 * Mock adapter implementation for testing
 */
class MockAdapter extends BaseAdapter {
  parseInput(stdin: string): HookContext {
    const data = JSON.parse(stdin);
    return {
      toolName: data.tool_name,
      toolInput: data.tool_input,
      filePath: data.file_path,
      operation: data.operation,
      cwd: data.cwd,
      sessionId: data.session_id,
      llmTool: data.llm_tool,
    };
  }

  formatOutput(response: HookResponse): string {
    return JSON.stringify({
      decision: response.decision,
      message: response.message,
      userMessage: response.userMessage,
      updatedInput: response.updatedInput,
    });
  }
}

describe('BaseAdapter', () => {
  let adapter: MockAdapter;
  let originalExit: typeof process.exit;
  let exitCode: number | undefined;

  beforeEach(() => {
    adapter = new MockAdapter();
    originalExit = process.exit;

    // Mock process.exit to capture exit code
    exitCode = undefined;
    process.exit = vi.fn((code?: number) => {
      exitCode = code ?? 0;
      throw new Error('EXIT');
    }) as any;
  });

  afterEach(() => {
    process.exit = originalExit;
    vi.restoreAllMocks();
  });

  /**
   * Helper to mock stdin with data
   */
  function mockStdin(data: string): Readable {
    const readable = new Readable();
    readable.push(data);
    readable.push(null);

    // Mock process.stdin methods
    vi.spyOn(process.stdin, 'on').mockImplementation((event: string, handler: any) => {
      if (event === 'data') {
        setImmediate(() => handler(Buffer.from(data)));
      } else if (event === 'end') {
        setImmediate(() => handler());
      }
      return process.stdin;
    });

    return readable;
  }

  describe('execute', () => {
    test('reads stdin, executes callback, and writes output', async () => {
      const input = {
        tool_name: 'Read',
        tool_input: { file_path: '/test/file.ts' },
        file_path: '/test/file.ts',
        operation: 'read',
        cwd: '/test',
        session_id: 'session-123',
        llm_tool: 'claude-code',
      };

      mockStdin(JSON.stringify(input));

      const callback = vi.fn(async (context: HookContext) => ({
        decision: 'allow' as const,
        message: 'Test message',
      }));

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      try {
        await adapter.execute(callback);
      } catch (error: any) {
        if (error.message !== 'EXIT') throw error;
      }

      expect(callback).toHaveBeenCalledWith({
        toolName: 'Read',
        toolInput: { file_path: '/test/file.ts' },
        filePath: '/test/file.ts',
        operation: 'read',
        cwd: '/test',
        sessionId: 'session-123',
        llmTool: 'claude-code',
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        JSON.stringify({
          decision: 'allow',
          message: 'Test message',
          userMessage: undefined,
          updatedInput: undefined,
        }),
      );

      expect(exitCode).toBe(0);
    });

    test('handles skip decision without outputting anything', async () => {
      const input = {
        tool_name: 'Read',
        tool_input: { file_path: '/test/file.ts' },
        file_path: '/test/file.ts',
        operation: 'read',
        cwd: '/test',
        session_id: 'session-123',
      };

      mockStdin(JSON.stringify(input));

      const callback = vi.fn(async () => ({
        decision: 'skip' as const,
        message: '',
      }));

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // For skip decision, process.exit should be called without logging
      // Re-mock process.exit to not throw so we can verify no logging happens
      let skipExitCalled = false;
      process.exit = vi.fn((code?: number) => {
        skipExitCalled = true;
        exitCode = code ?? 0;
        // Don't throw for this test - we want to verify no console.log
        return undefined as never;
      }) as any;

      await adapter.execute(callback);

      expect(callback).toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(skipExitCalled).toBe(true);
      expect(exitCode).toBe(0);
    });

    test('handles callback with updatedInput', async () => {
      const input = {
        tool_name: 'Write',
        tool_input: { file_path: '/test/file.ts', content: 'test' },
        file_path: '/test/file.ts',
        operation: 'write',
        cwd: '/test',
        session_id: 'session-123',
      };

      mockStdin(JSON.stringify(input));

      const updatedInput = { file_path: '/test/file.ts', content: 'updated test' };
      const callback = vi.fn(async () => ({
        decision: 'allow' as const,
        message: 'Updated content',
        updatedInput,
      }));

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      try {
        await adapter.execute(callback);
      } catch (error: any) {
        if (error.message !== 'EXIT') throw error;
      }

      expect(consoleLogSpy).toHaveBeenCalledWith(
        JSON.stringify({
          decision: 'allow',
          message: 'Updated content',
          userMessage: undefined,
          updatedInput,
        }),
      );
    });

    test('handles errors with fail-open behavior', async () => {
      const input = {
        tool_name: 'Read',
        tool_input: {},
        cwd: '/test',
        session_id: 'session-123',
      };

      mockStdin(JSON.stringify(input));

      const callback = vi.fn(async () => {
        throw new Error('Callback error');
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      try {
        await adapter.execute(callback);
      } catch (error: any) {
        if (error.message !== 'EXIT') throw error;
      }

      expect(consoleLogSpy).toHaveBeenCalledWith(
        JSON.stringify({
          decision: 'allow',
          message: '⚠️ Hook error: Callback error',
          userMessage: undefined,
          updatedInput: undefined,
        }),
      );

      expect(exitCode).toBe(0);
    });

    test('handles JSON parse errors with fail-open behavior', async () => {
      mockStdin('invalid json');

      const callback = vi.fn();
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      try {
        await adapter.execute(callback);
      } catch (error: any) {
        if (error.message !== 'EXIT') throw error;
      }

      expect(callback).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('⚠️ Hook error:');
      expect(exitCode).toBe(0);
    });

    test('handles non-Error exceptions', async () => {
      const input = {
        tool_name: 'Read',
        tool_input: {},
        cwd: '/test',
        session_id: 'session-123',
      };

      mockStdin(JSON.stringify(input));

      const callback = vi.fn(async () => {
        throw 'String error';
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      try {
        await adapter.execute(callback);
      } catch (error: any) {
        if (error.message !== 'EXIT') throw error;
      }

      expect(consoleLogSpy).toHaveBeenCalledWith(
        JSON.stringify({
          decision: 'allow',
          message: '⚠️ Hook error: String error',
          userMessage: undefined,
          updatedInput: undefined,
        }),
      );
    });
  });
});
