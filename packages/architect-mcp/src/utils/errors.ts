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

/** Structured validation issue from Zod */
export interface ValidationIssue {
  path: (string | number)[];
  message: string;
  code?: string;
}

/**
 * Error thrown when architect config validation fails
 */
export class InvalidConfigError extends ArchitectError {
  /** Structured validation issues from Zod */
  readonly issues: ValidationIssue[];

  constructor(message: string, issues?: ValidationIssue[]) {
    super(message);
    this.name = 'InvalidConfigError';
    this.issues = issues || [];
  }
}
