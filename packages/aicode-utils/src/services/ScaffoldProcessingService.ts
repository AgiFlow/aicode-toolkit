import path from 'node:path';
import type { IFileSystemService, IVariableReplacementService } from '../types';

/**
 * Shared service for common scaffolding operations like processing templates and tracking files
 */
export class ScaffoldProcessingService {
  constructor(
    private fileSystem: IFileSystemService,
    private variableReplacer: IVariableReplacementService,
  ) {}

  /**
   * Process a target path for variable replacement, handling both files and directories
   */
  async processTargetForVariableReplacement(
    targetPath: string,
    variables: Record<string, any>,
  ): Promise<void> {
    const targetStat = await this.fileSystem.stat(targetPath);

    if (targetStat.isDirectory()) {
      // Process all files in the directory recursively
      await this.variableReplacer.processFilesForVariableReplacement(targetPath, variables);
    } else {
      // Process single file
      await this.variableReplacer.replaceVariablesInFile(targetPath, variables);
    }
  }

  /**
   * Track all created files, handling both single files and directories
   */
  async trackCreatedFiles(targetPath: string, createdFiles: string[]): Promise<void> {
    const targetStat = await this.fileSystem.stat(targetPath);

    if (targetStat.isDirectory()) {
      // Track all files in the directory recursively
      await this.trackCreatedFilesRecursive(targetPath, createdFiles);
    } else {
      // Track single file
      createdFiles.push(targetPath);
    }
  }

  /**
   * Track all existing files, handling both single files and directories
   */
  async trackExistingFiles(targetPath: string, existingFiles: string[]): Promise<void> {
    const targetStat = await this.fileSystem.stat(targetPath);

    if (targetStat.isDirectory()) {
      // Track all files in the directory recursively
      await this.trackExistingFilesRecursive(targetPath, existingFiles);
    } else {
      // Track single file
      existingFiles.push(targetPath);
    }
  }

  /**
   * Copy source to target, then process templates and track files
   * Now supports tracking existing files separately from created files
   */
  async copyAndProcess(
    sourcePath: string,
    targetPath: string,
    variables: Record<string, any>,
    createdFiles: string[],
    existingFiles?: string[],
  ): Promise<void> {
    // Ensure target directory exists
    await this.fileSystem.ensureDir(path.dirname(targetPath));

    // Check if target already exists
    const targetExists = await this.fileSystem.pathExists(targetPath);

    if (targetExists && existingFiles) {
      // Track existing files but don't overwrite
      await this.trackExistingFiles(targetPath, existingFiles);
      return; // Skip copying and processing for existing files
    }

    // Copy source to target (only if it doesn't exist)
    await this.fileSystem.copy(sourcePath, targetPath);

    // Process for variable replacement
    await this.processTargetForVariableReplacement(targetPath, variables);

    // Track created files
    await this.trackCreatedFiles(targetPath, createdFiles);
  }

  /**
   * Recursively collect all file paths in a directory for created files
   */
  private async trackCreatedFilesRecursive(dirPath: string, createdFiles: string[]): Promise<void> {
    let items: string[] = [];
    try {
      items = await this.fileSystem.readdir(dirPath);
    } catch (error) {
      console.warn(`Cannot read directory ${dirPath}: ${String(error)}`);
      return;
    }

    for (const item of items) {
      if (!item) continue;

      const itemPath = path.join(dirPath, item);

      try {
        const stat = await this.fileSystem.stat(itemPath);

        if (stat.isDirectory()) {
          await this.trackCreatedFilesRecursive(itemPath, createdFiles);
        } else if (stat.isFile()) {
          createdFiles.push(itemPath);
        }
      } catch (error) {
        console.warn(`Cannot stat ${itemPath}: ${String(error)}`);
      }
    }
  }

  /**
   * Recursively collect all file paths in a directory for existing files
   */
  private async trackExistingFilesRecursive(
    dirPath: string,
    existingFiles: string[],
  ): Promise<void> {
    let items: string[] = [];
    try {
      items = await this.fileSystem.readdir(dirPath);
    } catch (error) {
      console.warn(`Cannot read directory ${dirPath}: ${String(error)}`);
      return;
    }

    for (const item of items) {
      if (!item) continue;

      const itemPath = path.join(dirPath, item);

      try {
        const stat = await this.fileSystem.stat(itemPath);

        if (stat.isDirectory()) {
          await this.trackExistingFilesRecursive(itemPath, existingFiles);
        } else if (stat.isFile()) {
          existingFiles.push(itemPath);
        }
      } catch (error) {
        console.warn(`Cannot stat ${itemPath}: ${String(error)}`);
      }
    }
  }
}
