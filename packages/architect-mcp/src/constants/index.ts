/**
 * Constants for architect-mcp package
 */

// Architect file names
export const ARCHITECT_FILENAME = 'architect.yaml';
export const ARCHITECT_FILENAME_HIDDEN = '.architect.yaml';
export const ARCHITECT_FILENAMES = [ARCHITECT_FILENAME_HIDDEN, ARCHITECT_FILENAME] as const;

// Rules file names
export const RULES_FILENAME = 'RULES.yaml';
export const GLOBAL_TEMPLATE_REF = 'shared';
export const DEFAULT_RULES_VERSION = '1.0';

// Path prefixes
export const SRC_PREFIX = 'src/';

// File encoding
export const UTF8_ENCODING = 'utf-8';

// Pattern source types
export const PATTERN_SOURCE = {
  PROJECT: 'project',
  TEMPLATE: 'template',
  GLOBAL: 'global',
} as const;

// Glob pattern constants
export const GLOB_DOUBLE_STAR = '**';
export const GLOB_STAR = '*';
export const GLOB_ANY_EXT = '.*';
export const PATH_SEPARATOR = '/';
export const PARENT_DIR_PREFIX = '..';
export const GLOB_NEGATION_PREFIX = '!';

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

// File size limits
/** Maximum file size for architect.yaml files (1MB) to prevent DoS via large files */
export const MAX_ARCHITECT_FILE_SIZE = 1024 * 1024;

// RulesWriter error types
export const RULES_ERROR = {
  TEMPLATES_NOT_FOUND: 'TEMPLATES_NOT_FOUND',
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  RULE_EXISTS: 'RULE_EXISTS',
  WRITE_FAILED: 'WRITE_FAILED',
} as const;

// RulesWriter error messages
export const RULES_ERROR_MESSAGE = {
  TEMPLATES_NOT_FOUND: 'Templates directory not found',
  TEMPLATE_NAME_REQUIRED: 'Template name is required for template-specific rules',
  WRITE_FAILED: 'Failed to write RULES.yaml',
  AVAILABLE_HINT: 'Check templates directory for available templates',
  INPUT_VALIDATION_FAILED: 'Input validation failed',
} as const;

// RulesWriter default descriptions
export const RULES_DESCRIPTION = {
  GLOBAL: 'Shared rules and patterns for all templates',
  TEMPLATE_PREFIX: 'Rules and patterns for',
} as const;

// RulesWriter labels
export const RULES_LABEL = {
  GLOBAL: 'global',
} as const;

// YAML dump configuration
export const YAML_INDENT = 2;
export const YAML_NO_LINE_WRAP = -1;

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
