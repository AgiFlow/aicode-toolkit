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
 * Configuration for a single hook method invocation.
 * Keys use kebab-case matching the adapter/CLI convention.
 */
export interface HookMethodConfig {
  'llm-tool'?: string;
  'tool-config'?: Record<string, unknown>;
  'fallback-tool'?: string;
  'fallback-tool-config'?: Record<string, unknown>;
}

/**
 * Per-method configuration for a specific agent.
 */
export interface HookAgentConfig {
  preToolUse?: HookMethodConfig;
  postToolUse?: HookMethodConfig;
  stop?: HookMethodConfig;
  userPromptSubmit?: HookMethodConfig;
  taskCompleted?: HookMethodConfig;
}

/**
 * Hook configuration keyed by agent name.
 */
export interface HookConfig {
  'claude-code'?: HookAgentConfig;
  'gemini-cli'?: HookAgentConfig;
}

/**
 * Top-level scaffold-mcp configuration block.
 */
export interface ScaffoldMcpConfig {
  'mcp-serve'?: McpServeConfig;
  hook?: HookConfig;
}

/**
 * Configuration for the architect-mcp mcp-serve command.
 * Keys map 1-to-1 with CLI flags (camelCase).
 */
export interface ArchitectMcpServeConfig {
  type?: string;
  port?: number;
  host?: string;
  adminEnable?: boolean;
  fallbackTool?: string;
  fallbackToolConfig?: Record<string, unknown>;
  designPatternTool?: string;
  designPatternToolConfig?: Record<string, unknown>;
  reviewTool?: string;
  reviewToolConfig?: Record<string, unknown>;
}

/**
 * Configuration for a single architect-mcp hook method invocation.
 * Keys use kebab-case matching the adapter/CLI convention.
 */
export interface ArchitectHookMethodConfig {
  'llm-tool'?: string;
  'tool-config'?: Record<string, unknown>;
}

/**
 * Per-method configuration for a specific agent (architect-mcp).
 * Only preToolUse and postToolUse are supported.
 */
export interface ArchitectHookAgentConfig {
  preToolUse?: ArchitectHookMethodConfig;
  postToolUse?: ArchitectHookMethodConfig;
}

/**
 * Hook configuration keyed by agent name (architect-mcp).
 */
export interface ArchitectHookConfig {
  'claude-code'?: ArchitectHookAgentConfig;
  'gemini-cli'?: ArchitectHookAgentConfig;
}

/**
 * Top-level architect-mcp configuration block.
 */
export interface ArchitectMcpConfig {
  'mcp-serve'?: ArchitectMcpServeConfig;
  hook?: ArchitectHookConfig;
}

/**
 * Toolkit configuration from .toolkit/settings.yaml (or legacy toolkit.yaml)
 */
export interface ToolkitConfig {
  version?: string;
  templatesPath?: string;
  projectType?: 'monolith' | 'monorepo';
  sourceTemplate?: string;
  'scaffold-mcp'?: ScaffoldMcpConfig;
  'architect-mcp'?: ArchitectMcpConfig;
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
