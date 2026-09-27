import { type Mocked, vi } from 'vitest';
import type { IFileSystemService } from '../../src/types/interfaces';

export const createMockFileSystemService = (): Mocked<IFileSystemService> => ({
  ensureDir: vi.fn().mockResolvedValue(undefined),
  copy: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
  readJson: vi.fn().mockResolvedValue({}),
  pathExists: vi.fn().mockResolvedValue(true),
  readdir: vi.fn().mockResolvedValue([]),
  stat: vi.fn().mockResolvedValue({ isDirectory: () => true, isFile: () => false }),
});
