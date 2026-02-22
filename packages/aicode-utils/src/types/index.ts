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

export type { ProjectConfigResult, NxProjectJson } from './projectConfig';

/**
 * Configuration for the scaffold-mcp mcp-serve command.
 * Keys map 1-to-1 with CLI flags (camelCase).
 */
export interface McpServeConfig {
  /** Transport type: stdio | http | sse. Default: stdio. */
  type?: string;
  /** Port for http/sse transport. Default: 3000. */
  port?: number;
  /** Host to bind for http/sse transport. Default: localhost. */
  host?: string;
  /** Enable admin tools such as generate-boilerplate. Default: false. */
  adminEnable?: boolean;
  /** Render prompts with skill front matter for Claude Code. Default: false. */
  promptAsSkill?: boolean;
  /** Fallback LLM tool used when scaffold-mcp needs AI assistance. */
  fallbackTool?: string;
  /** Config passed to the fallback LLM tool. */
  fallbackToolConfig?: Record<string, unknown>;
}

/**
 * Configuration for a single hook method invocation.
 * Keys use kebab-case matching the adapter/CLI convention.
 */
export interface HookMethodConfig {
  /** LLM tool to invoke for this hook method (e.g. claude-code, gemini-cli). */
  'llm-tool'?: string;
  /** Config object forwarded to the LLM tool (e.g. { model: 'gemini-2.0-flash' }). */
  'tool-config'?: Record<string, unknown>;
  /** Fallback LLM tool used when the primary tool is unavailable. */
  'fallback-tool'?: string;
  /** Config object forwarded to the fallback LLM tool. */
  'fallback-tool-config'?: Record<string, unknown>;
}

/**
 * Per-method configuration for a specific agent.
 */
export interface HookAgentConfig {
  /** Config applied when the agent invokes the PreToolUse hook. */
  preToolUse?: HookMethodConfig;
  /** Config applied when the agent invokes the PostToolUse hook. */
  postToolUse?: HookMethodConfig;
  /** Config applied when the agent invokes the Stop hook. */
  stop?: HookMethodConfig;
  /** Config applied when the agent invokes the UserPromptSubmit hook. */
  userPromptSubmit?: HookMethodConfig;
  /** Config applied when the agent invokes the TaskCompleted hook. */
  taskCompleted?: HookMethodConfig;
}

/**
 * Hook configuration keyed by agent name.
 */
export interface HookConfig {
  /** Hook config for Claude Code agent. */
  'claude-code'?: HookAgentConfig;
  /** Hook config for Gemini CLI agent. */
  'gemini-cli'?: HookAgentConfig;
}

/**
 * Top-level scaffold-mcp configuration block.
 */
export interface ScaffoldMcpConfig {
  /** Defaults for the `scaffold-mcp mcp-serve` command. */
  'mcp-serve'?: McpServeConfig;
  /** Hook method defaults keyed by agent name. */
  hook?: HookConfig;
}

/**
 * Configuration for the architect-mcp mcp-serve command.
 * Keys map 1-to-1 with CLI flags (camelCase).
 */
export interface ArchitectMcpServeConfig {
  /** Transport type: stdio | http | sse. Default: stdio. */
  type?: string;
  /** Port for http/sse transport. Default: 3000. */
  port?: number;
  /** Host to bind for http/sse transport. Default: localhost. */
  host?: string;
  /** Enable admin tools such as add-design-pattern and add-rule. Default: false. */
  adminEnable?: boolean;
  /** Fallback LLM tool used for both design-pattern and review operations. */
  fallbackTool?: string;
  /** Config passed to the fallback LLM tool. */
  fallbackToolConfig?: Record<string, unknown>;
  /** LLM tool used specifically for get-file-design-pattern analysis. */
  designPatternTool?: string;
  /** Config passed to the design-pattern LLM tool. */
  designPatternToolConfig?: Record<string, unknown>;
  /** LLM tool used specifically for review-code-change analysis. */
  reviewTool?: string;
  /** Config passed to the review LLM tool. */
  reviewToolConfig?: Record<string, unknown>;
}

/**
 * Configuration for a single architect-mcp hook method invocation.
 * Keys use kebab-case matching the adapter/CLI convention.
 */
export interface ArchitectHookMethodConfig {
  /** LLM tool to invoke for this hook method. */
  'llm-tool'?: string;
  /** Config object forwarded to the LLM tool. */
  'tool-config'?: Record<string, unknown>;
}

/**
 * Per-method configuration for a specific agent (architect-mcp).
 * Only preToolUse and postToolUse are supported.
 */
export interface ArchitectHookAgentConfig {
  /** Config applied when the agent invokes the PreToolUse hook. */
  preToolUse?: ArchitectHookMethodConfig;
  /** Config applied when the agent invokes the PostToolUse hook. */
  postToolUse?: ArchitectHookMethodConfig;
}

/**
 * Hook configuration keyed by agent name (architect-mcp).
 */
export interface ArchitectHookConfig {
  /** Hook config for Claude Code agent. */
  'claude-code'?: ArchitectHookAgentConfig;
  /** Hook config for Gemini CLI agent. */
  'gemini-cli'?: ArchitectHookAgentConfig;
}

/**
 * Top-level architect-mcp configuration block.
 */
export interface ArchitectMcpConfig {
  /** Defaults for the `architect-mcp mcp-serve` command. */
  'mcp-serve'?: ArchitectMcpServeConfig;
  /** Hook method defaults keyed by agent name. */
  hook?: ArchitectHookConfig;
}

/**
 * A single hook entry in the claude-code hooks config.
 */
export interface ClaudeCodeHookEntry {
  /** Optional tool-name matcher (regex). Absent = no matcher field in output. */
  matcher?: string;
  /** Shell commands to execute for this hook entry. */
  commands: string[];
}

/**
 * Hook event map for the claude-code section of settings.yaml.
 */
export interface ClaudeCodeHooksConfig {
  /** Entries invoked before the agent uses a tool. */
  PreToolUse?: ClaudeCodeHookEntry[];
  /** Entries invoked after the agent uses a tool. */
  PostToolUse?: ClaudeCodeHookEntry[];
  /** Entries invoked when the agent stops (session end). */
  Stop?: ClaudeCodeHookEntry[];
  /** Entries invoked when the user submits a prompt. */
  UserPromptSubmit?: ClaudeCodeHookEntry[];
  /** Entries invoked when the agent completes a task. */
  TaskCompleted?: ClaudeCodeHookEntry[];
}

/**
 * Top-level claude-code configuration block in settings.yaml.
 * Generates .claude/settings.json when `aicode sync` is run.
 */
export interface ClaudeCodeAgentConfig {
  hooks?: ClaudeCodeHooksConfig;
}

/**
 * A single MCP server entry in the mcp-config section of settings.yaml.
 */
export interface McpServerEntry {
  /** Executable used to start the server (e.g. bun, node, npx). */
  command: string;
  /** CLI arguments passed to the command. */
  args?: string[];
  /** Environment variables injected into the server process. */
  env?: Record<string, string>;
  /** Short instruction shown to the AI about when to use this server. */
  instruction?: string;
}

/**
 * Skills configuration in the mcp-config section.
 */
export interface McpSkillsConfig {
  /** Directories containing skill markdown files, relative to workspace root. */
  paths?: string[];
}

/**
 * Top-level mcp-config configuration block in settings.yaml.
 * Generates mcp-config.yaml when `aicode sync` is run.
 */
export interface McpConfigSection {
  /** MCP server definitions keyed by server name. */
  servers?: Record<string, McpServerEntry>;
  /** Skills configuration for skill-capable MCP servers. */
  skills?: McpSkillsConfig;
}

/**
 * Toolkit configuration from .toolkit/settings.yaml (or legacy toolkit.yaml)
 */
export interface ToolkitConfig {
  /** Config schema version (e.g. '1.0'). */
  version?: string;
  /** Path to the scaffold templates directory, relative to workspace root. */
  templatesPath?: string;
  /** Project structure type: monolith (single app) or monorepo (multiple packages). */
  projectType?: 'monolith' | 'monorepo';
  /** Active template name (monolith only — monorepo reads from project.json). */
  sourceTemplate?: string;
  /** scaffold-mcp server and hook configuration. */
  'scaffold-mcp'?: ScaffoldMcpConfig;
  /** architect-mcp server and hook configuration. */
  'architect-mcp'?: ArchitectMcpConfig;
  /** Generates .claude/settings.json via `aicode sync --hooks` */
  'claude-code'?: ClaudeCodeAgentConfig;
  /** Generates mcp-config.yaml via `aicode sync --mcp` */
  'mcp-config'?: McpConfigSection;
}

/**
 * Project configuration from project.json
 */
export interface ProjectConfig {
  /** Package/project name as declared in project.json. */
  name: string;
  /** Root directory of the project, relative to workspace root. */
  root: string;
  /** Template this project was scaffolded from. */
  sourceTemplate?: string;
  /** Project type as declared in project.json (e.g. 'application' or 'library'). */
  projectType?: string;
}

/**
 * Scaffold template include configuration
 */
export interface ParsedInclude {
  /** Absolute path of the source template file. */
  sourcePath: string;
  /** Absolute path of the destination file in the target directory. */
  targetPath: string;
  /** Conditions that must be satisfied for this include to be applied. */
  conditions?: Record<string, string>;
}

/**
 * Result of a scaffold operation
 */
export interface ScaffoldResult {
  /** Whether the scaffold operation completed without errors. */
  success: boolean;
  /** Human-readable summary of the operation outcome. */
  message: string;
  /** Non-fatal warnings collected during the operation. */
  warnings?: string[];
  /** Paths of files that were newly created. */
  createdFiles?: string[];
  /** Paths of files that already existed and were not overwritten. */
  existingFiles?: string[];
}

/**
 * Minimal stat result returned by IFileSystemService.stat.
 */
export interface FileStat {
  /** Returns true when the path is a directory. */
  isDirectory(): boolean;
  /** Returns true when the path is a regular file. */
  isFile(): boolean;
}

/**
 * Abstract interface for file system operations
 */
export interface IFileSystemService {
  /**
   * Check whether a path exists on disk.
   * @param path - Absolute path to check.
   * @returns True when the path exists.
   */
  pathExists(path: string): Promise<boolean>;
  /**
   * Read a file as text.
   * @param path - Absolute path of the file.
   * @param encoding - Character encoding (default: utf-8).
   * @returns File contents as a string.
   */
  readFile(path: string, encoding?: BufferEncoding): Promise<string>;
  /**
   * Read and parse a JSON file. Returns unknown — callers must narrow the type.
   * @param path - Absolute path of the JSON file.
   * @returns Parsed value with type unknown.
   */
  readJson(path: string): Promise<unknown>;
  /**
   * Write text content to a file.
   * @param path - Absolute path of the target file.
   * @param content - Text to write.
   * @param encoding - Character encoding (default: utf-8).
   */
  writeFile(path: string, content: string, encoding?: BufferEncoding): Promise<void>;
  /**
   * Create a directory and all parent directories.
   * @param path - Absolute path of the directory to create.
   */
  ensureDir(path: string): Promise<void>;
  /**
   * Copy a file or directory from src to dest.
   * @param src - Absolute source path.
   * @param dest - Absolute destination path.
   */
  copy(src: string, dest: string): Promise<void>;
  /**
   * List the entries of a directory.
   * @param path - Absolute path of the directory.
   * @returns Array of entry names (not full paths).
   */
  readdir(path: string): Promise<string[]>;
  /**
   * Return stat info for a path.
   * @param path - Absolute path to stat.
   * @returns FileStat with isDirectory and isFile helpers.
   */
  stat(path: string): Promise<FileStat>;
}

/**
 * Abstract interface for variable replacement in templates
 */
export interface IVariableReplacementService {
  /**
   * Walk dirPath and apply variable substitution to every non-binary file.
   * @param dirPath - Directory to process recursively.
   * @param variables - Key/value pairs used for substitution.
   */
  processFilesForVariableReplacement(
    dirPath: string,
    variables: Record<string, unknown>,
  ): Promise<void>;
  /**
   * Apply variable substitution to a single file.
   * @param filePath - File to process.
   * @param variables - Key/value pairs used for substitution.
   */
  replaceVariablesInFile(filePath: string, variables: Record<string, unknown>): Promise<void>;
  /** Return true when filePath should be treated as a binary (non-text) file. */
  isBinaryFile(filePath: string): boolean;
}

/**
 * Context object passed to generator functions.
 * Bundles all dependencies needed to produce scaffold output.
 */
export interface GeneratorContext {
  /** Template variables resolved for the current scaffold operation. */
  variables: Record<string, unknown>;
  /** Raw scaffold configuration loaded from scaffold.yaml. */
  config: unknown;
  /** Absolute path of the directory where output files will be written. */
  targetPath: string;
  /** Absolute path of the source template directory. */
  templatePath: string;
  /** File-system abstraction used for all I/O inside generators. */
  fileSystem: IFileSystemService;
  /** Loader for scaffold config files — typed as unknown to avoid circular deps. */
  scaffoldConfigLoader: unknown;
  /** Variable-replacement service injected to avoid circular imports. */
  variableReplacer: IVariableReplacementService;
  /** ScaffoldProcessingService constructor — passed to avoid circular imports. */
  ScaffoldProcessingService: new (
    ...args: unknown[]
  ) => unknown;
  /** Return the workspace root path. */
  getRootPath: () => string;
  /** Return the absolute path of a project relative to the workspace root. */
  getProjectPath: (projectPath: string) => string;
}

/**
 * Type definition for generator functions
 */
export type GeneratorFunction = (context: GeneratorContext) => Promise<ScaffoldResult>;
