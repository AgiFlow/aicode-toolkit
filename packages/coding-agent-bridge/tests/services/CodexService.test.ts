/**
 * CodexService Tests
 *
 * Tests for CodexService focusing on toolConfig merge behavior
 * and CLI argument construction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodexService } from '../../src/services/CodexService';

interface MockExecaResult {
  stdout: string;
  stderr?: string;
}

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

// Mock fs/promises for schema file operations
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    default: {
      ...actual,
      mkdtemp: vi.fn().mockResolvedValue('/tmp/codex-schema-test'),
      writeFile: vi.fn().mockResolvedValue(undefined),
      rm: vi.fn().mockResolvedValue(undefined),
    },
  };
});

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

describe('CodexService', () => {
  const mockExeca = vi.mocked(execa);

  const createMockResponse = (stdout: string): MockExecaResult => ({ stdout, stderr: '' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('invokeAsLlm toolConfig merge', () => {
    it('should use toolConfig model when no params.model provided', async () => {
      const toolConfigModel = 'gpt-4o';
      mockExeca.mockImplementation(() => Promise.resolve(createMockResponse('1.0.0')) as never);

      const service = new CodexService({
        toolConfig: { model: toolConfigModel },
      });

      try {
        await service.invokeAsLlm({ prompt: 'test prompt' });
      } catch {
        // Expected to fail due to mock
      }

      const args = getCliArgs(mockExeca);
      expect(args).toContain('--model');
      expect(args).toContain(toolConfigModel);
      expect(countFlag(args, '--model')).toBe(1);
    });

    it('should let toolConfig override params.model', async () => {
      const toolConfigModel = 'gpt-4o';
      const paramsModel = 'gpt-4-turbo';
      mockExeca.mockImplementation(() => Promise.resolve(createMockResponse('1.0.0')) as never);

      const service = new CodexService({
        toolConfig: { model: toolConfigModel },
      });

      try {
        await service.invokeAsLlm({ prompt: 'test prompt', model: paramsModel });
      } catch {
        // Expected to fail
      }

      const args = getCliArgs(mockExeca);
      expect(countFlag(args, '--model')).toBe(1);
      expect(args).toContain(toolConfigModel);
      expect(args).not.toContain(paramsModel);
    });

    it('should use params.model when toolConfig has no model', async () => {
      const paramsModel = 'gpt-4-turbo';
      mockExeca.mockImplementation(() => Promise.resolve(createMockResponse('1.0.0')) as never);

      const service = new CodexService({
        toolConfig: { timeout: 5000 },
      });

      try {
        await service.invokeAsLlm({ prompt: 'test prompt', model: paramsModel });
      } catch {
        // Expected to fail
      }

      const args = getCliArgs(mockExeca);
      expect(args).toContain('--model');
      expect(args).toContain(paramsModel);
    });

    it('should not have duplicate flags when merging toolConfig and params', async () => {
      const toolConfigModel = 'gpt-4o';
      mockExeca.mockImplementation(() => Promise.resolve(createMockResponse('1.0.0')) as never);

      const service = new CodexService({
        toolConfig: { model: toolConfigModel, maxTokens: 8000 },
      });

      try {
        await service.invokeAsLlm({ prompt: 'test prompt', model: 'gpt-4-turbo' });
      } catch {
        // Expected to fail
      }

      const args = getCliArgs(mockExeca);
      expect(countFlag(args, '--model')).toBe(1);
      expect(countFlag(args, '--max-tokens')).toBe(1);
    });

    it('should throw error when CLI is not found', async () => {
      mockExeca.mockRejectedValueOnce(new Error('CLI not found'));

      const service = new CodexService({
        toolConfig: { model: 'gpt-4o' },
      });

      await expect(service.invokeAsLlm({ prompt: 'test prompt' })).rejects.toThrow();
    });
  });
});
