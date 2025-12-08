/**
 * Utils Barrel Export
 *
 * DESIGN PATTERNS:
 * - Barrel pattern: Re-export all utilities from a single entry point
 * - Clean imports: Consumers import from '@package/utils' instead of individual files
 *
 * CODING STANDARDS:
 * - Export all utility functions and instances
 * - Use named exports (no default exports)
 * - Keep alphabetically sorted for maintainability
 *
 * AVOID:
 * - Exporting internal implementation details
 * - Re-exporting types (types should come from '../types')
 */

// File system helpers
export {
  pathExists,
  pathExistsSync,
  readFile,
  readFileSync,
  writeFile,
  remove,
  move,
  copy,
  ensureDir,
  readdir,
  readJson,
  readJsonSync,
  mkdir,
  stat,
  statSync,
  accessSync,
  mkdirSync,
  writeFileSync,
} from './fsHelpers';

// ID generation
export { generateStableId } from './generateStableId';

// Git utilities
export {
  gitInit,
  findWorkspaceRoot,
  parseGitHubUrl,
  cloneSubdirectory,
  cloneRepository,
  fetchGitHubDirectoryContents,
} from './git';
export type { ParsedGitHubUrl, GitHubDirectoryEntry } from './git';

// Logging
export { logger, log } from './logger';

// Printing utilities
export { print, icons, messages, sections } from './print';

// Project type detection
export { detectProjectType } from './projectTypeDetector';
