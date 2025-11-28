/**
 * Native FS Helper Functions
 *
 * Provides fs-extra-like API using native node:fs/promises
 * to avoid ESM compatibility issues with fs-extra
 */

import * as fs from 'node:fs/promises';
import { accessSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

/**
 * Check if a file or directory exists
 */
export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a file or directory exists (sync)
 */
export function pathExistsSync(filePath: string): boolean {
  try {
    accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure a directory exists, creating it recursively if needed
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Ensure a directory exists (sync), creating it recursively if needed
 */
export function ensureDirSync(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

/**
 * Remove a file or directory recursively
 */
export async function remove(filePath: string): Promise<void> {
  await fs.rm(filePath, { recursive: true, force: true });
}

/**
 * Copy a file or directory recursively
 */
export async function copy(src: string, dest: string): Promise<void> {
  await fs.cp(src, dest, { recursive: true });
}

/**
 * Move a file or directory
 */
export async function move(src: string, dest: string): Promise<void> {
  await ensureDir(nodePath.dirname(dest));
  await fs.rename(src, dest);
}

/**
 * Read and parse a JSON file
 */
export async function readJson<T = unknown>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Read and parse a JSON file (sync)
 */
export function readJsonSync<T = unknown>(filePath: string): T {
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Write an object as JSON to a file
 */
export async function writeJson(
  filePath: string,
  data: unknown,
  options?: { spaces?: number },
): Promise<void> {
  const content = JSON.stringify(data, null, options?.spaces ?? 2);
  await fs.writeFile(filePath, `${content}\n`, 'utf-8');
}

/**
 * Write an object as JSON to a file (sync)
 */
export function writeJsonSync(
  filePath: string,
  data: unknown,
  options?: { spaces?: number },
): void {
  const content = JSON.stringify(data, null, options?.spaces ?? 2);
  writeFileSync(filePath, `${content}\n`, 'utf-8');
}

/**
 * Output file - writes content ensuring directory exists
 */
export async function outputFile(filePath: string, content: string): Promise<void> {
  await ensureDir(nodePath.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

// Re-export native fs/promises functions for convenience
export { fs };
export const readFile = fs.readFile;
export const writeFile = fs.writeFile;
export const readdir = fs.readdir;
export const mkdir = fs.mkdir;
export const stat = fs.stat;
export const unlink = fs.unlink;
export const rename = fs.rename;
export const rm = fs.rm;
export const cp = fs.cp;
export { readFileSync, statSync, accessSync, mkdirSync, writeFileSync };
