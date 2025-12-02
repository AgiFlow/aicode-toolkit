/**
 * Tests for ExecutionLogService
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';

// Mock the fs module
vi.mock('node:fs/promises');

// Import after mocking
import { ExecutionLogService } from '../../src/services/ExecutionLogService';

describe('ExecutionLogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the internal cache
    (ExecutionLogService as any).cache = null;
  });

  describe('hasExecuted', () => {
    test('returns false when log file does not exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });

      const result = await ExecutionLogService.hasExecuted('session-123', '/test/file.ts', 'deny');

      expect(result).toBe(false);
    });

    test('returns true when matching execution found', async () => {
      const logEntry = JSON.stringify({
        timestamp: Date.now(),
        sessionId: 'session-123',
        filePath: '/test/file.ts',
        operation: 'edit',
        decision: 'deny',
      });

      vi.mocked(fs.readFile).mockResolvedValue(logEntry);

      const result = await ExecutionLogService.hasExecuted('session-123', '/test/file.ts', 'deny');

      expect(result).toBe(true);
    });

    test.each([
      ['session-456', '/test/file.ts', 'deny', 'different session'],
      ['session-123', '/test/other.ts', 'deny', 'different file'],
      ['session-123', '/test/file.ts', 'allow', 'different decision'],
    ])('returns false for %s', async (sessionId, filePath, decision) => {
      const logEntry = JSON.stringify({
        timestamp: Date.now(),
        sessionId: 'session-123',
        filePath: '/test/file.ts',
        operation: 'edit',
        decision: 'deny',
      });

      vi.mocked(fs.readFile).mockResolvedValue(logEntry);

      const result = await ExecutionLogService.hasExecuted(sessionId, filePath, decision);

      expect(result).toBe(false);
    });

    test('handles multiple log entries', async () => {
      const entries = [
        { sessionId: 'session-123', filePath: '/test/file1.ts', decision: 'allow' },
        { sessionId: 'session-123', filePath: '/test/file2.ts', decision: 'deny' },
        { sessionId: 'session-123', filePath: '/test/file.ts', decision: 'deny' },
      ].map((e) => JSON.stringify({ ...e, timestamp: Date.now(), operation: 'edit' }));

      vi.mocked(fs.readFile).mockResolvedValue(entries.join('\n'));

      const result = await ExecutionLogService.hasExecuted('session-123', '/test/file.ts', 'deny');

      expect(result).toBe(true);
    });

    test('handles malformed log entries gracefully', async () => {
      const logContent = 'invalid json\n{"valid": "entry"}';
      vi.mocked(fs.readFile).mockResolvedValue(logContent);

      const result = await ExecutionLogService.hasExecuted('session-123', '/test/file.ts', 'deny');

      expect(result).toBe(false);
    });

    test('handles read errors gracefully', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Permission denied'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await ExecutionLogService.hasExecuted('session-123', '/test/file.ts', 'deny');

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('logExecution', () => {
    test('appends execution to log file', async () => {
      vi.mocked(fs.appendFile).mockResolvedValue(undefined);

      await ExecutionLogService.logExecution({
        sessionId: 'session-123',
        filePath: '/test/file.ts',
        operation: 'edit',
        decision: 'deny',
      });

      expect(fs.appendFile).toHaveBeenCalled();
      const callArgs = vi.mocked(fs.appendFile).mock.calls[0];
      const logData = JSON.parse(callArgs[1] as string);

      expect(logData.sessionId).toBe('session-123');
      expect(logData.filePath).toBe('/test/file.ts');
      expect(logData.operation).toBe('edit');
      expect(logData.decision).toBe('deny');
      expect(logData.timestamp).toBeDefined();
    });

    test('appends execution with filePattern to log file', async () => {
      vi.mocked(fs.appendFile).mockResolvedValue(undefined);

      await ExecutionLogService.logExecution({
        sessionId: 'session-123',
        filePath: '/test/file.ts',
        operation: 'edit',
        decision: 'deny',
        filePattern: 'service-class-pattern,barrel-export-pattern',
      });

      expect(fs.appendFile).toHaveBeenCalled();
      const callArgs = vi.mocked(fs.appendFile).mock.calls[0];
      const logData = JSON.parse(callArgs[1] as string);

      expect(logData.sessionId).toBe('session-123');
      expect(logData.filePath).toBe('/test/file.ts');
      expect(logData.operation).toBe('edit');
      expect(logData.decision).toBe('deny');
      expect(logData.filePattern).toBe('service-class-pattern,barrel-export-pattern');
      expect(logData.timestamp).toBeDefined();
    });

    test('handles append errors gracefully', async () => {
      vi.mocked(fs.appendFile).mockRejectedValue(new Error('Disk full'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await ExecutionLogService.logExecution({
        sessionId: 'session-123',
        filePath: '/test/file.ts',
        operation: 'edit',
        decision: 'deny',
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to log hook execution:',
        expect.any(Error),
      );
    });
  });

  describe('getStats', () => {
    test('returns zero stats for empty log', async () => {
      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });

      const stats = await ExecutionLogService.getStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.uniqueSessions).toBe(0);
      expect(stats.uniqueFiles).toBe(0);
    });

    test('calculates stats correctly for multiple entries', async () => {
      const entries = [
        { sessionId: 'session-123', filePath: '/test/file1.ts', decision: 'deny' },
        { sessionId: 'session-456', filePath: '/test/file2.ts', decision: 'allow' },
        { sessionId: 'session-123', filePath: '/test/file1.ts', decision: 'allow' },
      ].map((e) => JSON.stringify({ ...e, timestamp: Date.now(), operation: 'edit' }));

      vi.mocked(fs.readFile).mockResolvedValue(entries.join('\n'));

      const stats = await ExecutionLogService.getStats();

      expect(stats.totalEntries).toBe(3);
      expect(stats.uniqueSessions).toBe(2);
      expect(stats.uniqueFiles).toBe(2);
    });
  });

  describe('clearLog', () => {
    test('removes log file successfully', async () => {
      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      await ExecutionLogService.clearLog();

      expect(fs.unlink).toHaveBeenCalled();
    });

    test('handles missing log file gracefully', async () => {
      vi.mocked(fs.unlink).mockRejectedValue({ code: 'ENOENT' });

      await expect(ExecutionLogService.clearLog()).resolves.toBeUndefined();
    });

    test('throws error for other unlink errors', async () => {
      vi.mocked(fs.unlink).mockRejectedValue(new Error('Permission denied'));

      await expect(ExecutionLogService.clearLog()).rejects.toThrow('Permission denied');
    });
  });
});
