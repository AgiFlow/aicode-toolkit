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
  let service: ExecutionLogService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create a new service instance for each test
    service = new ExecutionLogService('session-123');
  });

  describe('hasExecuted', () => {
    test('returns false when log file does not exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });

      const result = await service.hasExecuted('/test/file.ts', 'deny');

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

      const result = await service.hasExecuted('/test/file.ts', 'deny');

      expect(result).toBe(true);
    });

    test.each([
      ['/test/other.ts', 'deny', 'different file'],
      ['/test/file.ts', 'allow', 'different decision'],
    ])('returns false for %s', async (filePath, decision) => {
      const logEntry = JSON.stringify({
        timestamp: Date.now(),
        sessionId: 'session-123',
        filePath: '/test/file.ts',
        operation: 'edit',
        decision: 'deny',
      });

      vi.mocked(fs.readFile).mockResolvedValue(logEntry);

      const result = await service.hasExecuted(filePath, decision);

      expect(result).toBe(false);
    });

    test('handles multiple log entries', async () => {
      const entries = [
        { sessionId: 'session-123', filePath: '/test/file1.ts', decision: 'allow' },
        { sessionId: 'session-123', filePath: '/test/file2.ts', decision: 'deny' },
        { sessionId: 'session-123', filePath: '/test/file.ts', decision: 'deny' },
      ].map((e) => JSON.stringify({ ...e, timestamp: Date.now(), operation: 'edit' }));

      vi.mocked(fs.readFile).mockResolvedValue(entries.join('\n'));

      const result = await service.hasExecuted('/test/file.ts', 'deny');

      expect(result).toBe(true);
    });

    test('handles malformed log entries gracefully', async () => {
      const logContent = 'invalid json\n{"valid": "entry"}';
      vi.mocked(fs.readFile).mockResolvedValue(logContent);

      const result = await service.hasExecuted('/test/file.ts', 'deny');

      expect(result).toBe(false);
    });

    test('handles read errors gracefully', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Permission denied'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.hasExecuted('/test/file.ts', 'deny');

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('logExecution', () => {
    test('appends execution to log file', async () => {
      vi.mocked(fs.appendFile).mockResolvedValue(undefined);

      await service.logExecution({
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

      await service.logExecution({
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

    test('appends execution with generatedFiles to log file', async () => {
      vi.mocked(fs.appendFile).mockResolvedValue(undefined);

      await service.logExecution({
        filePath: '/test/project',
        operation: 'scaffold',
        decision: 'allow',
        generatedFiles: ['/test/project/src/component.ts', '/test/project/src/component.test.ts'],
      });

      expect(fs.appendFile).toHaveBeenCalled();
      const callArgs = vi.mocked(fs.appendFile).mock.calls[0];
      const logData = JSON.parse(callArgs[1] as string);

      expect(logData.sessionId).toBe('session-123');
      expect(logData.filePath).toBe('/test/project');
      expect(logData.operation).toBe('scaffold');
      expect(logData.decision).toBe('allow');
      expect(logData.generatedFiles).toEqual([
        '/test/project/src/component.ts',
        '/test/project/src/component.test.ts',
      ]);
      expect(logData.timestamp).toBeDefined();
    });

    test('handles append errors gracefully', async () => {
      vi.mocked(fs.appendFile).mockRejectedValue(new Error('Disk full'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await service.logExecution({
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

      const stats = await service.getStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.uniqueFiles).toBe(0);
    });

    test('calculates stats correctly for multiple entries', async () => {
      const entries = [
        { sessionId: 'session-123', filePath: '/test/file1.ts', decision: 'deny' },
        { sessionId: 'session-123', filePath: '/test/file2.ts', decision: 'allow' },
        { sessionId: 'session-123', filePath: '/test/file1.ts', decision: 'allow' },
      ].map((e) => JSON.stringify({ ...e, timestamp: Date.now(), operation: 'edit' }));

      vi.mocked(fs.readFile).mockResolvedValue(entries.join('\n'));

      const stats = await service.getStats();

      expect(stats.totalEntries).toBe(3);
      expect(stats.uniqueFiles).toBe(2);
    });
  });

  describe('clearLog', () => {
    test('removes log file successfully', async () => {
      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      await service.clearLog();

      expect(fs.unlink).toHaveBeenCalled();
    });

    test('handles missing log file gracefully', async () => {
      vi.mocked(fs.unlink).mockRejectedValue({ code: 'ENOENT' });

      await expect(service.clearLog()).resolves.toBeUndefined();
    });

    test('throws error for other unlink errors', async () => {
      vi.mocked(fs.unlink).mockRejectedValue(new Error('Permission denied'));

      await expect(service.clearLog()).rejects.toThrow('Permission denied');
    });
  });

  describe('wasRecentlyReviewed', () => {
    test('returns false when no previous review exists', async () => {
      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });

      const result = await service.wasRecentlyReviewed('/test/file.ts', 3000);

      expect(result).toBe(false);
    });

    test('returns true when file was reviewed within debounce window', async () => {
      const now = Date.now();
      const recentTimestamp = now - 2000; // 2 seconds ago

      const logEntry = JSON.stringify({
        timestamp: recentTimestamp,
        sessionId: 'session-123',
        filePath: '/test/file.ts',
        operation: 'edit',
        decision: 'allow',
      });

      vi.mocked(fs.readFile).mockResolvedValue(logEntry);

      const result = await service.wasRecentlyReviewed('/test/file.ts', 3000);

      expect(result).toBe(true);
    });

    test('returns false when file was reviewed outside debounce window', async () => {
      const now = Date.now();
      const oldTimestamp = now - 5000; // 5 seconds ago

      const logEntry = JSON.stringify({
        timestamp: oldTimestamp,
        sessionId: 'session-123',
        filePath: '/test/file.ts',
        operation: 'edit',
        decision: 'allow',
      });

      vi.mocked(fs.readFile).mockResolvedValue(logEntry);

      const result = await service.wasRecentlyReviewed('/test/file.ts', 3000);

      expect(result).toBe(false);
    });

    test('returns false for different file', async () => {
      const now = Date.now();
      const recentTimestamp = now - 1000;

      const logEntry = JSON.stringify({
        timestamp: recentTimestamp,
        sessionId: 'session-123',
        filePath: '/test/other.ts',
        operation: 'edit',
        decision: 'allow',
      });

      vi.mocked(fs.readFile).mockResolvedValue(logEntry);

      const result = await service.wasRecentlyReviewed('/test/file.ts', 3000);

      expect(result).toBe(false);
    });

    test('uses most recent matching entry', async () => {
      const now = Date.now();
      const entries = [
        {
          timestamp: now - 5000,
          sessionId: 'session-123',
          filePath: '/test/file.ts',
          decision: 'allow',
        },
        {
          timestamp: now - 2000,
          sessionId: 'session-123',
          filePath: '/test/file.ts',
          decision: 'deny',
        },
      ].map((e) => JSON.stringify({ ...e, operation: 'edit' }));

      vi.mocked(fs.readFile).mockResolvedValue(entries.join('\n'));

      const result = await service.wasRecentlyReviewed('/test/file.ts', 3000);

      expect(result).toBe(true);
    });

    test('uses custom debounce window', async () => {
      const now = Date.now();
      const recentTimestamp = now - 4000; // 4 seconds ago

      const logEntry = JSON.stringify({
        timestamp: recentTimestamp,
        sessionId: 'session-123',
        filePath: '/test/file.ts',
        operation: 'edit',
        decision: 'allow',
      });

      // Test with 5000ms debounce - should be recent
      const service1 = new ExecutionLogService('session-123');
      vi.mocked(fs.readFile).mockResolvedValue(logEntry);
      const result5s = await service1.wasRecentlyReviewed('/test/file.ts', 5000);
      expect(result5s).toBe(true);

      // Test with 3000ms debounce - should NOT be recent
      const service2 = new ExecutionLogService('session-123');
      vi.mocked(fs.readFile).mockResolvedValue(logEntry);
      const result3s = await service2.wasRecentlyReviewed('/test/file.ts', 3000);
      expect(result3s).toBe(false);
    });

    test('handles errors gracefully and returns false', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Read error'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.wasRecentlyReviewed('/test/file.ts', 3000);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load execution log:',
        expect.any(Error),
      );
    });

    test('uses default debounce of 3000ms when not specified', async () => {
      const now = Date.now();
      const recentTimestamp = now - 2000;

      const logEntry = JSON.stringify({
        timestamp: recentTimestamp,
        sessionId: 'session-123',
        filePath: '/test/file.ts',
        operation: 'edit',
        decision: 'allow',
      });

      vi.mocked(fs.readFile).mockResolvedValue(logEntry);

      const result = await service.wasRecentlyReviewed('/test/file.ts');

      expect(result).toBe(true);
    });
  });

  describe('wasGeneratedByScaffold', () => {
    test('returns false when no scaffold log exists', async () => {
      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });

      const result = await service.wasGeneratedByScaffold('/test/file.ts');

      expect(result).toBe(false);
    });

    test('returns true when file was generated by scaffold', async () => {
      const logEntry = JSON.stringify({
        timestamp: Date.now(),
        sessionId: 'session-123',
        filePath: '/test/project',
        operation: 'scaffold',
        decision: 'allow',
        generatedFiles: ['/test/project/src/component.ts', '/test/project/src/component.test.ts'],
      });

      vi.mocked(fs.readFile).mockResolvedValue(logEntry);

      const result = await service.wasGeneratedByScaffold('/test/project/src/component.ts');

      expect(result).toBe(true);
    });

    test('returns false when file was not in generated files list', async () => {
      const logEntry = JSON.stringify({
        timestamp: Date.now(),
        sessionId: 'session-123',
        filePath: '/test/project',
        operation: 'scaffold',
        decision: 'allow',
        generatedFiles: ['/test/project/src/component.ts'],
      });

      vi.mocked(fs.readFile).mockResolvedValue(logEntry);

      const result = await service.wasGeneratedByScaffold('/test/project/src/other.ts');

      expect(result).toBe(false);
    });

    test('returns false when scaffold has no generatedFiles', async () => {
      const logEntry = JSON.stringify({
        timestamp: Date.now(),
        sessionId: 'session-123',
        filePath: '/test/project',
        operation: 'scaffold',
        decision: 'allow',
      });

      vi.mocked(fs.readFile).mockResolvedValue(logEntry);

      const result = await service.wasGeneratedByScaffold('/test/project/src/component.ts');

      expect(result).toBe(false);
    });

    test('checks only scaffold operations', async () => {
      const entries = [
        {
          timestamp: Date.now(),
          sessionId: 'session-123',
          filePath: '/test/file.ts',
          operation: 'edit',
          decision: 'allow',
        },
        {
          timestamp: Date.now(),
          sessionId: 'session-123',
          filePath: '/test/project',
          operation: 'scaffold',
          decision: 'allow',
          generatedFiles: ['/test/project/src/component.ts'],
        },
      ].map((e) => JSON.stringify(e));

      vi.mocked(fs.readFile).mockResolvedValue(entries.join('\n'));

      const result = await service.wasGeneratedByScaffold('/test/project/src/component.ts');

      expect(result).toBe(true);
    });

    test('handles errors gracefully and returns false', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Read error'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.wasGeneratedByScaffold('/test/file.ts');

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load execution log:',
        expect.any(Error),
      );
    });
  });
});
