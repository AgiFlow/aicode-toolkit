/**
 * Custom Error Classes
 *
 * Typed error classes for better error handling and identification.
 */

/**
 * Base error class for architect-mcp errors
 */
export class ArchitectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArchitectError';
  }
}

/**
 * Error thrown when parsing architect.yaml fails
 */
export class ParseArchitectError extends ArchitectError {
  constructor(message: string) {
    super(message);
    this.name = 'ParseArchitectError';
  }
}

/**
 * Error thrown when architect config validation fails
 */
export class InvalidConfigError extends ArchitectError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidConfigError';
  }
}
