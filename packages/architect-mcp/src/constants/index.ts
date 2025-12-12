/**
 * Constants for architect-mcp package
 */

// Architect file names
export const ARCHITECT_FILENAME = 'architect.yaml';
export const ARCHITECT_FILENAME_HIDDEN = '.architect.yaml';
export const ARCHITECT_FILENAMES = [ARCHITECT_FILENAME_HIDDEN, ARCHITECT_FILENAME] as const;

// Pattern source types
export const PATTERN_SOURCE = {
  TEMPLATE: 'template',
  GLOBAL: 'global',
} as const;

// Glob pattern constants
export const GLOB_DOUBLE_STAR = '**';
export const GLOB_STAR = '*';
export const GLOB_ANY_EXT = '.*';
export const PATH_SEPARATOR = '/';
export const PARENT_DIR_PREFIX = '..';

// Match confidence levels
export const MATCH_CONFIDENCE = {
  EXACT: 'exact',
  PARTIAL: 'partial',
  INFERRED: 'inferred',
} as const;

// File extensions
export const EXT_TSX = '.tsx';

// Directory patterns for recommendations
export const DIR_PATTERNS = {
  ROUTES: 'routes',
  SERVICES: 'services',
  COMPONENTS: 'components',
} as const;

// File naming patterns
export const FILE_PATTERNS = {
  HOOK: 'hook',
  USE_PREFIX: 'use',
  TEST: 'test',
} as const;

// Default values
export const DEFAULT_PATTERN_NAME = 'unnamed pattern';

// Common naming patterns for similarity matching
export const COMMON_NAMING_PATTERNS = [
  'Controller',
  'Service',
  'Repository',
  'Component',
  'Hook',
  'Route',
  'Model',
  'Schema',
  'Validator',
  'Middleware',
  'Agent',
] as const;
