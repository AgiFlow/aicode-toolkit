import type { JsonSchema } from '@composio/json-schema-to-zod';

/**
 * Boilerplate entry as defined in scaffold.yaml
 */
export interface BoilerplateConfig {
  /** Unique name identifying this boilerplate */
  name: string;
  /** Human-readable description shown in listings */
  description: string;
  /** Instruction text shown to the AI agent after scaffolding */
  instruction: string;
  /** JSON schema defining the variables this boilerplate accepts */
  variables_schema: JsonSchema;
  /** List of file include patterns to copy from the template */
  includes: string[];
  /** Target folder where the boilerplate will be created */
  targetFolder: string;
}

/**
 * Feature scaffold entry as defined in scaffold.yaml
 */
export interface FeatureConfig {
  /** Unique name identifying this feature scaffold */
  name: string;
  /** Optional custom generator module filename (omit to use default file-copy processing) */
  generator?: string;
  /** Instruction text shown to the AI agent after scaffolding */
  instruction: string;
  /** JSON schema defining the variables this feature accepts */
  variables_schema: JsonSchema;
  /** List of file include patterns to copy from the template */
  includes: string[];
}

/**
 * Root structure of a parsed scaffold.yaml file
 */
export interface ScaffoldYamlConfig {
  /** Available boilerplate configurations */
  boilerplate?: BoilerplateConfig[];
  /** Available feature scaffold configurations */
  feature?: FeatureConfig[];
}

/**
 * Resolved boilerplate info returned by the list operation
 */
export interface BoilerplateInfo {
  /** Unique name identifying this boilerplate */
  name: string;
  /** Human-readable description */
  description: string;
  /** Instruction text shown to the AI agent after scaffolding */
  instruction: string;
  /** JSON schema defining the variables this boilerplate accepts */
  variables_schema: JsonSchema;
  /** Relative path to the template directory */
  template_path: string;
  /** Target folder where the boilerplate will be created */
  target_folder: string;
  /** List of file include patterns */
  includes: string[];
}

/**
 * Request payload for the use-boilerplate operation
 */
export interface UseBoilerplateRequest {
  /** Boilerplate name to use — optional in monolith mode (read from toolkit.yaml) */
  boilerplateName?: string;
  /** Template variable values matching the boilerplate's variables_schema */
  variables: Record<string, unknown>;
  /** If true, scaffold at workspace root using toolkit.yaml */
  monolith?: boolean;
  /** Optional override for the target folder */
  targetFolderOverride?: string;
  /** Scaffold-generated marker tag to inject into generated code files (default: @scaffold-generated) */
  marker?: string;
}

/**
 * Pagination metadata for list responses
 */
export interface PaginationMeta {
  /** Total number of boilerplates available */
  total: number;
  /** Current offset (start index) */
  offset: number;
  /** Page size */
  limit: number;
}

/**
 * Paginated response from the list-boilerplates operation
 */
export interface ListBoilerplateResponse {
  /** Boilerplates in the current page */
  boilerplates: BoilerplateInfo[];
  /** Cursor token for fetching the next page */
  nextCursor?: string;
  /** Pagination metadata */
  _meta?: PaginationMeta;
}
