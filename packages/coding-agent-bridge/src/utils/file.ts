/**
 * File Utilities
 *
 * DESIGN PATTERNS:
 * - Utility functions for common file operations
 * - Pure functions with no side effects
 *
 * CODING STANDARDS:
 * - Use async/await for file operations
 * - Handle errors gracefully
 * - Document all public functions
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { pathExists, ensureDir } from '@agiflowai/aicode-utils';

/**
 * Append content to a file if it exists, or create it with initial content if it doesn't
 *
 * @param filePath - Absolute path to the file
 * @param content - Content to append
 * @param initialContent - Content to write if file doesn't exist (defaults to content)
 * @returns Promise that resolves when operation is complete
 */
export async function appendToFileIfExists(
  filePath: string,
  content: string,
  initialContent?: string,
): Promise<void> {
  const exists = await pathExists(filePath);

  if (exists) {
    await fs.appendFile(filePath, content, 'utf-8');
  } else {
    // Ensure directory exists
    await ensureDir(path.dirname(filePath));
    // Write initial content or the content itself
    await fs.writeFile(filePath, initialContent ?? content, 'utf-8');
  }
}

/**
 * Append content to a file only if the content is not already present
 *
 * @param filePath - Absolute path to the file
 * @param content - Content to append
 * @param searchString - String to search for to check if content exists (defaults to content)
 * @param initialContent - Content to write if file doesn't exist
 * @returns Promise that resolves to true if content was appended, false if already exists
 */
export async function appendUniqueToFile(
  filePath: string,
  content: string,
  searchString?: string,
  initialContent?: string,
): Promise<boolean> {
  const exists = await pathExists(filePath);
  const searchStr = searchString ?? content;

  if (exists) {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    if (fileContent.includes(searchStr)) {
      return false; // Content already exists
    }
    await fs.appendFile(filePath, content, 'utf-8');
    return true;
  }

  // File doesn't exist, create it
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, initialContent ?? content, 'utf-8');
  return true;
}

/**
 * Write content to a file, ensuring the directory exists
 *
 * @param filePath - Absolute path to the file
 * @param content - Content to write
 * @returns Promise that resolves when operation is complete
 */
export async function writeFileEnsureDir(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Append content to a file with AICODE tracking markers if not already present
 *
 * @param filePath - Absolute path to the file
 * @param content - Content to append
 * @param searchString - String to search for to check if content exists (defaults to checking for AICODE:START marker)
 * @param initialContent - Content to write if file doesn't exist
 * @returns Promise that resolves to true if content was appended, false if already exists
 */
export async function appendUniqueWithMarkers(
  filePath: string,
  content: string,
  searchString?: string,
  initialContent?: string,
): Promise<boolean> {
  const exists = await pathExists(filePath);
  const startMarker = '<!-- AICODE:START -->';
  const endMarker = '<!-- AICODE:END -->';
  const searchStr = searchString ?? startMarker;

  if (exists) {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    // Check if marker already exists
    if (fileContent.includes(searchStr)) {
      return false; // Content already exists
    }
    // Wrap content with markers
    const wrappedContent = `\n${startMarker}\n${content}\n${endMarker}\n`;
    await fs.appendFile(filePath, wrappedContent, 'utf-8');
    return true;
  }

  // File doesn't exist, create it
  await ensureDir(path.dirname(filePath));
  const wrappedContent = `${startMarker}\n${content}\n${endMarker}\n`;
  await fs.writeFile(filePath, initialContent ?? wrappedContent, 'utf-8');
  return true;
}
