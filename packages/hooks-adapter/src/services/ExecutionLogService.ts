/**
 * ExecutionLogService - Tracks hook executions to prevent duplicate actions
 *
 * DESIGN PATTERNS:
 * - Repository pattern: Abstracts data access to execution log
 * - Query pattern: Provides efficient lookups for hook execution history
 * - Singleton cache: In-memory cache for performance
 *
 * CODING STANDARDS:
 * - Use static methods for stateless operations
 * - Handle file system errors gracefully
 * - Optimize for performance with efficient data structures
 *
 * AVOID:
 * - Loading entire log file into memory
 * - Blocking I/O operations
 * - Complex parsing logic (keep it simple)
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

/**
 * Log entry structure for hook execution
 */
interface HookLogEntry {
  timestamp: number;
  sessionId: string;
  filePath: string;
  operation: string;
  decision: string;
  filePattern?: string;
  /** File modification timestamp (mtime) at time of execution */
  fileMtime?: number;
  /** MD5 checksum of file content at time of execution */
  fileChecksum?: string;
}

/**
 * Input parameters for logging a hook execution
 */
export interface LogExecutionParams {
  sessionId: string;
  filePath: string;
  operation: string;
  decision: string;
  filePattern?: string;
  /** File modification timestamp (mtime) at time of execution */
  fileMtime?: number;
  /** MD5 checksum of file content at time of execution */
  fileChecksum?: string;
}

/**
 * Service for tracking hook executions using an append-only log
 * Prevents duplicate hook actions (e.g., showing design patterns twice for same file)
 */
export class ExecutionLogService {
  /** Log file path - stored in system temp directory */
  private static readonly LOG_FILE = path.join(os.tmpdir(), 'hook-adapter-executions.jsonl');

  /** In-memory cache of recent executions (last 1000 entries) */
  private static cache: HookLogEntry[] | null = null;

  /** Max cache size to prevent memory bloat */
  private static readonly MAX_CACHE_SIZE = 1000;

  /**
   * Check if a specific action was already taken for this file in this session
   *
   * @param sessionId - Session identifier
   * @param filePath - File path to check
   * @param decision - Decision to check for (e.g., 'deny' means we already showed patterns)
   * @returns true if the action was already taken
   */
  static async hasExecuted(
    sessionId: string,
    filePath: string,
    decision: string,
  ): Promise<boolean> {
    const entries = await ExecutionLogService.loadLog();

    // Search from end (most recent) for efficiency
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];

      // Match session, file, and decision
      if (
        entry.sessionId === sessionId &&
        entry.filePath === filePath &&
        entry.decision === decision
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Log a hook execution
   *
   * @param params - Log execution parameters
   */
  static async logExecution(params: LogExecutionParams): Promise<void> {
    const entry: HookLogEntry = {
      timestamp: Date.now(),
      sessionId: params.sessionId,
      filePath: params.filePath,
      operation: params.operation,
      decision: params.decision,
      filePattern: params.filePattern,
      fileMtime: params.fileMtime,
      fileChecksum: params.fileChecksum,
    };

    // Append to log file (JSONL format - one JSON object per line)
    try {
      await fs.appendFile(ExecutionLogService.LOG_FILE, `${JSON.stringify(entry)}\n`, 'utf-8');

      // Update cache
      if (ExecutionLogService.cache) {
        ExecutionLogService.cache.push(entry);
        // Trim cache if too large
        if (ExecutionLogService.cache.length > ExecutionLogService.MAX_CACHE_SIZE) {
          ExecutionLogService.cache = ExecutionLogService.cache.slice(
            -ExecutionLogService.MAX_CACHE_SIZE,
          );
        }
      }
    } catch (error) {
      // Fail silently - logging should not break the hook
      console.error('Failed to log hook execution:', error);
    }
  }

  /**
   * Load execution log from file
   * Uses in-memory cache for performance
   */
  private static async loadLog(): Promise<HookLogEntry[]> {
    // Return cached data if available
    if (ExecutionLogService.cache !== null) {
      return ExecutionLogService.cache;
    }

    try {
      // Read log file
      const content = await fs.readFile(ExecutionLogService.LOG_FILE, 'utf-8');

      // Parse JSONL format
      const lines = content.trim().split('\n').filter(Boolean);
      const entries: HookLogEntry[] = [];

      for (const line of lines) {
        try {
          entries.push(JSON.parse(line));
        } catch {}
      }

      // Keep only recent entries to prevent memory bloat
      ExecutionLogService.cache = entries.slice(-ExecutionLogService.MAX_CACHE_SIZE);
      return ExecutionLogService.cache;
    } catch (error: any) {
      // File doesn't exist yet or read error - start with empty log
      if (error.code === 'ENOENT') {
        ExecutionLogService.cache = [];
        return ExecutionLogService.cache;
      }

      // Other errors - fail silently and return empty
      console.error('Failed to load execution log:', error);
      ExecutionLogService.cache = [];
      return ExecutionLogService.cache;
    }
  }

  /**
   * Clear the execution log (for testing)
   */
  static async clearLog(): Promise<void> {
    try {
      await fs.unlink(ExecutionLogService.LOG_FILE);
      ExecutionLogService.cache = [];
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Get log statistics (for debugging)
   */
  static async getStats(): Promise<{
    totalEntries: number;
    uniqueSessions: number;
    uniqueFiles: number;
  }> {
    const entries = await ExecutionLogService.loadLog();
    const sessions = new Set(entries.map((e) => e.sessionId));
    const files = new Set(entries.map((e) => e.filePath));

    return {
      totalEntries: entries.length,
      uniqueSessions: sessions.size,
      uniqueFiles: files.size,
    };
  }

  /**
   * Get file metadata (mtime and checksum) for a file
   *
   * @param filePath - Path to the file
   * @returns File metadata or null if file doesn't exist
   */
  static async getFileMetadata(
    filePath: string,
  ): Promise<{ mtime: number; checksum: string } | null> {
    try {
      const [stats, content] = await Promise.all([
        fs.stat(filePath),
        fs.readFile(filePath, 'utf-8'),
      ]);

      const checksum = crypto.createHash('md5').update(content).digest('hex');

      return {
        mtime: stats.mtimeMs,
        checksum,
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if a file has changed since the last execution for this session
   * Returns true if the file should be reviewed (new file or content changed)
   *
   * @param sessionId - Session identifier
   * @param filePath - File path to check
   * @param decision - Decision type to check for
   * @returns true if file has changed or no previous execution found
   */
  static async hasFileChanged(
    sessionId: string,
    filePath: string,
    decision: string,
  ): Promise<boolean> {
    const entries = await ExecutionLogService.loadLog();

    // Find the most recent execution for this session/file/decision
    let lastExecution: HookLogEntry | null = null;
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (
        entry.sessionId === sessionId &&
        entry.filePath === filePath &&
        entry.decision === decision
      ) {
        lastExecution = entry;
        break;
      }
    }

    // No previous execution - file should be reviewed
    if (!lastExecution || !lastExecution.fileChecksum) {
      return true;
    }

    // Get current file metadata
    const currentMetadata = await ExecutionLogService.getFileMetadata(filePath);
    if (!currentMetadata) {
      return true; // File doesn't exist, let hook handle it
    }

    // Compare checksum - if different, file has changed
    return currentMetadata.checksum !== lastExecution.fileChecksum;
  }
}
