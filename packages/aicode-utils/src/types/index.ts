/**
 * @agiflowai/aicode-utils - Type Definitions
 *
 * DESIGN PATTERNS:
 * - Interface segregation: Keep interfaces focused and minimal
 * - Type composition: Build complex types from simple primitives
 * - Generics: Use type parameters for reusable, type-safe abstractions
 *
 * CODING STANDARDS:
 * - Use PascalCase for type/interface names
 * - Prefix interfaces with 'I' only for abstract contracts
 * - Document complex types with JSDoc comments
 * - Export all public types
 *
 * AVOID:
 * - Any type unless absolutely necessary
 * - Overly complex type gymnastics
 * - Coupling types to implementation details
 */

export * from './projectConfig';

/**
 * Configuration for the scaffold-mcp mcp-serve command.
 * Keys map 1-to-1 with CLI flags (camelCase).
 */
export interface McpServeConfig {
  type?: string;
  port?: number;
  host?: string;
  adminEnable?: boolean;
  promptAsSkill?: boolean;
  fallbackTool?: string;
  fallbackToolConfig?: Record<string, unknown>;
}

/**
 * Configuration for the scaffold-mcp hook command.
 * Keys map 1-to-1 with CLI flags (camelCase).
 */
export interface HookConfig {
  marker?: string;
  fallbackTool?: string;
  fallbackToolConfig?: Record<string, unknown>;
}

/**
 * Toolkit configuration from .toolkit/settings.yaml (or legacy toolkit.yaml)
 */
export interface ToolkitConfig {
  version?: string;
  templatesPath?: string;
  projectType?: 'monolith' | 'monorepo';
  sourceTemplate?: string;
  'mcp-serve'?: McpServeConfig;
  hook?: HookConfig;
}

/**
 * Project configuration from project.json
 */
export interface ProjectConfig {
  name: string;
  root: string;
  sourceTemplate?: string;
  projectType?: string;
}

/**
 * Scaffold template include configuration
 */
export interface ParsedInclude {
  sourcePath: string;
  targetPath: string;
  conditions?: Record<string, string>;
}

/**
 * Result of a scaffold operation
 */
export interface ScaffoldResult {
  success: boolean;
  message: string;
  warnings?: string[];
  createdFiles?: string[];
  existingFiles?: string[];
}

/**
 * Abstract interface for file system operations
 */
export interface IFileSystemService {
  pathExists(path: string): Promise<boolean>;
  readFile(path: string, encoding?: BufferEncoding): Promise<string>;
  readJson(path: string): Promise<any>;
  writeFile(path: string, content: string, encoding?: BufferEncoding): Promise<void>;
  ensureDir(path: string): Promise<void>;
  copy(src: string, dest: string): Promise<void>;
  readdir(path: string): Promise<string[]>;
  stat(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean }>;
}

/**
 * Abstract interface for variable replacement in templates
 */
export interface IVariableReplacementService {
  processFilesForVariableReplacement(
    dirPath: string,
    variables: Record<string, any>,
  ): Promise<void>;
  replaceVariablesInFile(filePath: string, variables: Record<string, any>): Promise<void>;
  isBinaryFile(filePath: string): boolean;
}

/**
 * Context object passed to generator functions
 */
export interface GeneratorContext {
  variables: Record<string, any>;
  config: any;
  targetPath: string;
  templatePath: string;
  fileSystem: IFileSystemService;
  scaffoldConfigLoader: any;
  variableReplacer: IVariableReplacementService;
  // Utility classes and functions passed to avoid import issues
  ScaffoldProcessingService: any; // Constructor for ScaffoldProcessingService
  getRootPath: () => string;
  getProjectPath: (projectPath: string) => string;
}

/**
 * Type definition for generator functions
 */
export type GeneratorFunction = (context: GeneratorContext) => Promise<ScaffoldResult>;
