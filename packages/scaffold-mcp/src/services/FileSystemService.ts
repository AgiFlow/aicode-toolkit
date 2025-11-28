import {
  pathExists as fsPathExists,
  readFile as fsReadFile,
  readJson as fsReadJson,
  writeFile as fsWriteFile,
  ensureDir as fsEnsureDir,
  copy as fsCopy,
  readdir as fsReaddir,
  stat as fsStat,
} from '@agiflowai/aicode-utils';
import type { IFileSystemService } from '../types/interfaces';

export class FileSystemService implements IFileSystemService {
  async pathExists(path: string): Promise<boolean> {
    return fsPathExists(path);
  }

  async readFile(path: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    return fsReadFile(path, encoding);
  }

  async readJson(path: string): Promise<any> {
    return fsReadJson(path);
  }

  async writeFile(path: string, content: string, encoding: BufferEncoding = 'utf8'): Promise<void> {
    return fsWriteFile(path, content, encoding);
  }

  async ensureDir(path: string): Promise<void> {
    return fsEnsureDir(path);
  }

  async copy(src: string, dest: string): Promise<void> {
    return fsCopy(src, dest);
  }

  async readdir(path: string): Promise<string[]> {
    return fsReaddir(path);
  }

  async stat(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean }> {
    return fsStat(path);
  }
}
