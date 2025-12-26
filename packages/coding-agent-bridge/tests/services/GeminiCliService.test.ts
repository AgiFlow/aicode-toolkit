/**
 * GeminiCliService Tests
 *
 * Tests for GeminiCliService focusing on toolConfig merge behavior
 * and CLI argument construction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiCliService } from '../../src/services/GeminiCliService';

interface MockExecaResult {
  stdout: string;
  stderr?: string;
  exitCode?: number;
}

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

import { execa } from 'execa';

/**
 * Helper to extract CLI args from mock calls
 */
function getCliArgs(mockExeca: ReturnType<typeof vi.mocked<typeof execa>>): string[] {
  const calls = mockExeca.mock.calls;
  if (calls.length >= 2 && Array.isArray(calls[1][1])) {
    return calls[1][1];
  }
  return [];
}

/**
 * Helper to count occurrences of a flag in args
 */
function countFlag(args: string[], flag: string): number {
  return args.filter((arg) => arg === flag).length;
}

describe('GeminiCliService', () => {
  const mockExeca = vi.mocked(execa);

  const createMockResponse = (stdout: string): MockExecaResult => ({
    stdout,
    stderr: '',
    exitCode: 0,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('invokeAsLlm toolConfig merge', () => {
    it('should use toolConfig model when provided', async () => {
      const toolConfigModel = 'gemini-2.0-flash';
      mockExeca.mockImplementation(() => Promise.resolve(createMockResponse('1.0.0')) as never);

      const service = new GeminiCliService({
        toolConfig: { model: toolConfigModel },
      });

      try {
        await service.invokeAsLlm({ prompt: 'test prompt' });
      } catch {
        // Expected to fail due to mock
      }

      const args = getCliArgs(mockExeca);
      expect(countFlag(args, '--model')).toBe(1);
      expect(args).toContain(toolConfigModel);
    });

    it('should let toolConfig override default model', async () => {
      const toolConfigModel = 'gemini-2.0-flash';
      mockExeca.mockImplementation(() => Promise.resolve(createMockResponse('1.0.0')) as never);

      const service = new GeminiCliService({
        toolConfig: { model: toolConfigModel },
      });

      try {
        await service.invokeAsLlm({ prompt: 'test prompt' });
      } catch {
        // Expected to fail
      }

      const args = getCliArgs(mockExeca);
      expect(countFlag(args, '--model')).toBe(1);
      expect(args).toContain(toolConfigModel);
      // Should not contain the default model
      expect(args).not.toContain('gemini-3-pro-preview');
    });

    it('should use default model when toolConfig has no model', async () => {
      mockExeca.mockImplementation(() => Promise.resolve(createMockResponse('1.0.0')) as never);

      const service = new GeminiCliService({
        toolConfig: { timeout: 5000 },
      });

      try {
        await service.invokeAsLlm({ prompt: 'test prompt' });
      } catch {
        // Expected to fail
      }

      const args = getCliArgs(mockExeca);
      expect(countFlag(args, '--model')).toBe(1);
      // Should use default model
      expect(args).toContain('gemini-3-pro-preview');
    });

    it('should not have duplicate model flags when merging', async () => {
      const toolConfigModel = 'gemini-2.0-flash';
      mockExeca.mockImplementation(() => Promise.resolve(createMockResponse('1.0.0')) as never);

      const service = new GeminiCliService({
        toolConfig: { model: toolConfigModel },
      });

      try {
        await service.invokeAsLlm({ prompt: 'test prompt', model: 'gemini-2.5-pro' });
      } catch {
        // Expected to fail
      }

      const args = getCliArgs(mockExeca);
      // Should only have one --model flag (no duplicates)
      expect(countFlag(args, '--model')).toBe(1);
    });

    it('should throw error when CLI is not found', async () => {
      mockExeca.mockRejectedValueOnce(new Error('CLI not found'));

      const service = new GeminiCliService({
        toolConfig: { model: 'gemini-2.0-flash' },
      });

      await expect(service.invokeAsLlm({ prompt: 'test prompt' })).rejects.toThrow();
    });
  });
});
