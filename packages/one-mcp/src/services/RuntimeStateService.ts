/**
 * RuntimeStateService
 *
 * Persists runtime metadata for HTTP one-mcp instances so external commands
 * (for example `one-mcp stop`) can discover and target the correct server.
 */

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { RuntimeStateManager, RuntimeStateRecord } from '../types';

const RUNTIME_DIR_NAME = 'runtimes';
const RUNTIME_FILE_SUFFIX = '.runtime.json';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRuntimeStateRecord(value: unknown): value is RuntimeStateRecord {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.serverId === 'string' &&
    typeof value.host === 'string' &&
    typeof value.port === 'number' &&
    value.transport === 'http' &&
    typeof value.shutdownToken === 'string' &&
    typeof value.startedAt === 'string' &&
    typeof value.pid === 'number' &&
    (value.configPath === undefined || typeof value.configPath === 'string')
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Runtime state persistence implementation.
 */
export class RuntimeStateService implements RuntimeStateManager {
  private runtimeDir: string;

  constructor(runtimeDir?: string) {
    this.runtimeDir = runtimeDir ?? RuntimeStateService.getDefaultRuntimeDir();
  }

  /**
   * Resolve default runtime directory under the user's home cache path.
   * @returns Absolute runtime directory path
   */
  static getDefaultRuntimeDir(): string {
    return join(homedir(), '.aicode-toolkit', 'one-mcp', RUNTIME_DIR_NAME);
  }

  /**
   * Build runtime state file path for a given server ID.
   * @param serverId - Target one-mcp server identifier
   * @returns Absolute runtime file path
   */
  private getRecordPath(serverId: string): string {
    return join(this.runtimeDir, `${serverId}${RUNTIME_FILE_SUFFIX}`);
  }

  /**
   * Persist a runtime state record.
   * @param record - Runtime metadata to persist
   * @returns Promise that resolves when write completes
   */
  async write(record: RuntimeStateRecord): Promise<void> {
    await mkdir(this.runtimeDir, { recursive: true });
    const filePath = this.getRecordPath(record.serverId);
    await writeFile(filePath, JSON.stringify(record, null, 2), 'utf-8');
  }

  /**
   * Read a runtime state record by server ID.
   * @param serverId - Target one-mcp server identifier
   * @returns Matching runtime record, or null when no record exists
   */
  async read(serverId: string): Promise<RuntimeStateRecord | null> {
    const filePath = this.getRecordPath(serverId);

    try {
      const content = await readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content) as unknown;
      return isRuntimeStateRecord(parsed) ? parsed : null;
    } catch (error) {
      if (isObject(error) && 'code' in error && error.code === 'ENOENT') {
        return null;
      }

      throw new Error(
        `Failed to read runtime state for server '${serverId}' from '${filePath}': ${toErrorMessage(error)}`,
      );
    }
  }

  /**
   * List all persisted runtime records.
   * @returns Array of runtime records
   */
  async list(): Promise<RuntimeStateRecord[]> {
    try {
      const entries = await readdir(this.runtimeDir, { withFileTypes: true });
      const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(RUNTIME_FILE_SUFFIX));

      const records = await Promise.all(
        files.map(async (file): Promise<RuntimeStateRecord | null> => {
          try {
            const content = await readFile(join(this.runtimeDir, file.name), 'utf-8');
            const parsed = JSON.parse(content) as unknown;
            return isRuntimeStateRecord(parsed) ? parsed : null;
          } catch {
            return null;
          }
        }),
      );

      return records.filter((record): record is RuntimeStateRecord => record !== null);
    } catch (error) {
      if (isObject(error) && 'code' in error && error.code === 'ENOENT') {
        return [];
      }

      throw new Error(
        `Failed to list runtime states from '${this.runtimeDir}': ${toErrorMessage(error)}`,
      );
    }
  }

  /**
   * Remove a runtime state record by server ID.
   * @param serverId - Target one-mcp server identifier
   * @returns Promise that resolves when delete completes
   */
  async remove(serverId: string): Promise<void> {
    await rm(this.getRecordPath(serverId), { force: true });
  }
}
