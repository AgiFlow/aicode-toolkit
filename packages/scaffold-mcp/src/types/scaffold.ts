import type { IFileSystemService, IScaffoldConfigLoader, IVariableReplacementService } from './interfaces';

/** Template variable values — intentionally flexible to support any YAML/JSON schema */
export type TemplateVariables = Record<string, unknown>;

/**
 * Options for scaffolding a new project from a boilerplate template
 */
export interface BoilerplateOptions {
  /** Name used to create the project subdirectory (empty string for monolith root) */
  projectName: string;
  /** Package name (e.g., '@scope/package-name') */
  packageName: string;
  /** Destination folder where the project will be created */
  targetFolder: string;
  /** Relative path to the template folder within the templates root */
  templateFolder: string;
  /** Name of the boilerplate entry in scaffold.yaml */
  boilerplateName: string;
  /** Template variable values to inject during file generation */
  variables?: TemplateVariables;
  /** Scaffold-generated marker comment to inject into generated code files (default: @scaffold-generated) */
  marker?: string;
}

/**
 * Options for scaffolding a new feature into an existing project
 */
export interface FeatureOptions {
  /** Absolute path to the existing project directory */
  projectPath: string;
  /** Relative path to the template folder within the templates root */
  templateFolder: string;
  /** Name of the feature entry in scaffold.yaml */
  featureName: string;
  /** Template variable values to inject during file generation */
  variables?: TemplateVariables;
  /** Scaffold-generated marker comment to inject into generated code files (default: @scaffold-generated) */
  marker?: string;
}

/**
 * JSON schema definition for scaffold template variables
 */
export interface VariablesSchema {
  /** JSON Schema type (typically 'object') */
  type: string;
  /** Property definitions keyed by variable name */
  properties: Record<string, unknown>;
  /** List of required property names */
  required: string[];
  /** Whether additional properties beyond the schema are allowed */
  additionalProperties: boolean;
}

/**
 * A single scaffold configuration entry (boilerplate or feature)
 */
export interface ScaffoldConfigEntry {
  /** Display name for the scaffold */
  name: string;
  /** Human-readable description of what the scaffold creates */
  description: string;
  /** JSON schema defining the variables this scaffold accepts */
  variables_schema: VariablesSchema;
  /** List of file include patterns to copy from the template */
  includes: string[];
  /** Optional name of a custom generator module to use instead of default processing */
  generator?: string;
}

/**
 * Scaffold configuration loaded from scaffold.yaml.
 * Keys are section names (e.g., 'boilerplate', 'features').
 */
export interface ArchitectConfig {
  [key: string]: ScaffoldConfigEntry;
}

/**
 * Parsed include entry from scaffold.yaml includes array
 */
export interface ParsedInclude {
  /** Source file path relative to the template directory */
  sourcePath: string;
  /** Target file path relative to the scaffold destination */
  targetPath: string;
  /** Optional conditions that must match for this include to be applied */
  conditions?: Record<string, string>;
}

/**
 * Result returned by scaffold operations
 */
export interface ScaffoldResult {
  /** Whether the scaffold operation succeeded */
  success: boolean;
  /** Human-readable message describing the outcome */
  message: string;
  /** Non-fatal warnings generated during scaffolding */
  warnings?: string[];
  /** Paths of files that were created */
  createdFiles?: string[];
  /** Paths of files that already existed and were preserved */
  existingFiles?: string[];
}

/**
 * Result of validating a scaffold template
 */
export interface TemplateValidationResult {
  /** Whether the template is valid */
  isValid: boolean;
  /** Validation error messages */
  errors: string[];
  /** Template files that are referenced but missing */
  missingFiles: string[];
}

/**
 * Context passed to custom generator functions
 */
export interface GeneratorContext {
  /** Resolved template variable values */
  variables: TemplateVariables;
  /** The scaffold config entry for this generator */
  config: ScaffoldConfigEntry;
  /** Absolute path to the scaffold destination */
  targetPath: string;
  /** Absolute path to the template source directory */
  templatePath: string;
  /** File system service for reading/writing files */
  fileSystem: IFileSystemService;
  /** Config loader for parsing scaffold.yaml */
  scaffoldConfigLoader: IScaffoldConfigLoader;
  /** Variable replacement service for template processing */
  variableReplacer: IVariableReplacementService;
}

/**
 * A custom scaffold generator function
 */
export type GeneratorFunction = (context: GeneratorContext) => Promise<ScaffoldResult>;
