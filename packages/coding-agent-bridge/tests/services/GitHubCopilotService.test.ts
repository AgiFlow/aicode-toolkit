/**
 * GitHubCopilotService Tests
 *
 * Tests for GitHubCopilotService focusing on toolConfig merge behavior
 * and CLI argument construction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubCopilotService } from '../../src/services/GitHubCopilotService';

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

function getCliArgs(mockExeca: ReturnType<typeof vi.mocked<typeof execa>>): string[] {
  const calls = mockExeca.mock.calls;
  if (calls.length >= 2 && Array.isArray(calls[1][1])) {
    return calls[1][1];
  }
  return [];
}

function countFlag(args: string[], flag: string): number {
  return args.filter((arg) => arg === flag).length;
}

describe('GitHubCopilotService', () => {
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
    it('should use allowed toolConfig flags like --model', async () => {
      mockExeca.mockImplementation(() => Promise.resolve(createMockResponse('1.0.0')) as never);

      const service = new GitHubCopilotService({
        toolConfig: { model: 'gpt-5.2' },
      });

      try {
        await service.invokeAsLlm({ prompt: 'test prompt' });
      } catch {
        // Expected to fail due to mock
      }

      const args = getCliArgs(mockExeca);
      expect(countFlag(args, '--model')).toBe(1);
      expect(args).toContain('gpt-5.2');
    });

    it('should filter unsupported toolConfig flags like --config', async () => {
      mockExeca.mockImplementation(() => Promise.resolve(createMockResponse('1.0.0')) as never);

      const service = new GitHubCopilotService({
        toolConfig: {
          model: 'gpt-5.2',
          config: '/tmp/copilot',
          addDir: '/tmp/project',
        },
      });

      try {
        await service.invokeAsLlm({ prompt: 'test prompt' });
      } catch {
        // Expected to fail due to mock
      }

      const args = getCliArgs(mockExeca);
      expect(args).not.toContain('--config');
      expect(args).not.toContain('/tmp/copilot');
      expect(args).toContain('--add-dir');
      expect(args).toContain('/tmp/project');
    });

    it('should throw error when CLI is not found', async () => {
      mockExeca.mockRejectedValueOnce(new Error('CLI not found'));

      const service = new GitHubCopilotService({
        toolConfig: { model: 'gpt-5.2' },
      });

      await expect(service.invokeAsLlm({ prompt: 'test prompt' })).rejects.toThrow();
    });
  });
});
