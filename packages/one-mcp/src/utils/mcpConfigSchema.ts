/**
 * mcpConfigSchema Utilities
 *
 * DESIGN PATTERNS:
 * - Schema-based validation using Zod
 * - Pure functions with no side effects
 * - Type inference from schemas
 * - Transformation from Claude Code format to internal format
 *
 * CODING STANDARDS:
 * - Export individual functions and schemas
 * - Use descriptive function names with verbs
 * - Add JSDoc comments for complex logic
 * - Keep functions small and focused
 *
 * AVOID:
 * - Side effects (mutating external state)
 * - Stateful logic (use services for state)
 * - Loosely typed configs (use Zod for runtime safety)
 */

import { z } from 'zod';

/**
 * Interpolate environment variables in a string
 * Supports ${VAR_NAME} syntax
 *
 * This function replaces environment variable placeholders with their actual values.
 * If an environment variable is not defined, the placeholder is kept as-is and a warning is logged.
 *
 * Examples:
 * - "${HOME}/data" → "/Users/username/data"
 * - "Bearer ${API_KEY}" → "Bearer sk-abc123xyz"
 * - "${DATABASE_URL}/api" → "postgres://localhost:5432/mydb/api"
 *
 * Supported locations for environment variable interpolation:
 * - Stdio config: command, args, env values
 * - HTTP/SSE config: url, header values
 *
 * @param value - String that may contain environment variable references
 * @returns String with environment variables replaced
 */
function interpolateEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, varName) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      console.warn(`Environment variable ${varName} is not defined, keeping placeholder`);
      return `\${${varName}}`;
    }
    return envValue;
  });
}

/**
 * Recursively interpolate environment variables in an object
 *
 * @param obj - Object that may contain environment variable references
 * @returns Object with environment variables replaced
 */
function interpolateEnvVarsInObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return interpolateEnvVars(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateEnvVarsInObject(item)) as T;
  }

  if (obj !== null && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateEnvVarsInObject(value);
    }
    return result as T;
  }

  return obj;
}

/**
 * Claude Code / Claude Desktop standard MCP config format
 * This is the format users write in their config files
 */

// Additional config options (nested under 'config' key)
const AdditionalConfigSchema = z.object({
  instruction: z.string().optional(),
  toolBlacklist: z.array(z.string()).optional(),
}).optional();

// Stdio server config (standard Claude Code format)
const ClaudeCodeStdioServerSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  disabled: z.boolean().optional(),
  instruction: z.string().optional(), // Top-level instruction (user override)
  config: AdditionalConfigSchema, // Nested config with server's default instruction
});

// HTTP/SSE server config
const ClaudeCodeHttpServerSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
  type: z.enum(['http', 'sse']).optional(),
  disabled: z.boolean().optional(),
  instruction: z.string().optional(), // Top-level instruction (user override)
  config: AdditionalConfigSchema, // Nested config with server's default instruction
});

// Union of all Claude Code server types
const ClaudeCodeServerConfigSchema = z.union([
  ClaudeCodeStdioServerSchema,
  ClaudeCodeHttpServerSchema,
]);

/**
 * Full Claude Code MCP configuration schema
 */
export const ClaudeCodeMcpConfigSchema = z.object({
  mcpServers: z.record(z.string(), ClaudeCodeServerConfigSchema),
});

export type ClaudeCodeMcpConfig = z.infer<typeof ClaudeCodeMcpConfigSchema>;

/**
 * Internal MCP config format
 * This is the normalized format used internally by the proxy
 */

// Stdio config
const McpStdioConfigSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
});

// HTTP config
const McpHttpConfigSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
});

// SSE config
const McpSseConfigSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
});

// Server config with transport type
const McpServerConfigSchema = z.discriminatedUnion('transport', [
  z.object({
    name: z.string(),
    instruction: z.string().optional(),
    toolBlacklist: z.array(z.string()).optional(),
    transport: z.literal('stdio'),
    config: McpStdioConfigSchema,
  }),
  z.object({
    name: z.string(),
    instruction: z.string().optional(),
    toolBlacklist: z.array(z.string()).optional(),
    transport: z.literal('http'),
    config: McpHttpConfigSchema,
  }),
  z.object({
    name: z.string(),
    instruction: z.string().optional(),
    toolBlacklist: z.array(z.string()).optional(),
    transport: z.literal('sse'),
    config: McpSseConfigSchema,
  }),
]);

/**
 * Full internal MCP configuration schema
 */
export const InternalMcpConfigSchema = z.object({
  mcpServers: z.record(z.string(), McpServerConfigSchema),
});

export type InternalMcpConfig = z.infer<typeof InternalMcpConfigSchema>;

/**
 * Transform Claude Code config to internal format
 * Converts standard Claude Code MCP configuration to normalized internal format
 *
 * @param claudeConfig - Claude Code format configuration
 * @returns Internal format configuration
 */
export function transformClaudeCodeConfig(claudeConfig: ClaudeCodeMcpConfig): InternalMcpConfig {
  const transformedServers: Record<string, z.infer<typeof McpServerConfigSchema>> = {};

  for (const [serverName, serverConfig] of Object.entries(claudeConfig.mcpServers)) {
    // Skip disabled servers
    if ('disabled' in serverConfig && serverConfig.disabled === true) {
      continue;
    }

    // Detect and transform based on config structure
    if ('command' in serverConfig) {
      // Stdio transport
      const stdioConfig = serverConfig as z.infer<typeof ClaudeCodeStdioServerSchema>;

      // Interpolate environment variables in command, args, and env
      const interpolatedCommand = interpolateEnvVars(stdioConfig.command);
      const interpolatedArgs = stdioConfig.args?.map((arg) => interpolateEnvVars(arg));
      const interpolatedEnv = stdioConfig.env
        ? interpolateEnvVarsInObject(stdioConfig.env)
        : undefined;

      // Instruction priority: top-level instruction (user override) > config.instruction (server default)
      const finalInstruction = stdioConfig.instruction || stdioConfig.config?.instruction;
      const toolBlacklist = stdioConfig.config?.toolBlacklist;

      transformedServers[serverName] = {
        name: serverName,
        instruction: finalInstruction,
        toolBlacklist,
        transport: 'stdio' as const,
        config: {
          command: interpolatedCommand,
          args: interpolatedArgs,
          env: interpolatedEnv,
        },
      };
    } else if ('url' in serverConfig) {
      // HTTP or SSE transport
      const httpConfig = serverConfig as z.infer<typeof ClaudeCodeHttpServerSchema>;
      const transport = httpConfig.type === 'sse' ? ('sse' as const) : ('http' as const);

      // Interpolate environment variables in URL and headers
      const interpolatedUrl = interpolateEnvVars(httpConfig.url);
      const interpolatedHeaders = httpConfig.headers
        ? interpolateEnvVarsInObject(httpConfig.headers)
        : undefined;

      // Instruction priority: top-level instruction (user override) > config.instruction (server default)
      const finalInstruction = httpConfig.instruction || httpConfig.config?.instruction;
      const toolBlacklist = httpConfig.config?.toolBlacklist;

      transformedServers[serverName] = {
        name: serverName,
        instruction: finalInstruction,
        toolBlacklist,
        transport,
        config: {
          url: interpolatedUrl,
          headers: interpolatedHeaders,
        },
      };
    }
  }

  return { mcpServers: transformedServers };
}

/**
 * Parse and validate MCP config from raw JSON
 * Validates against Claude Code format, transforms to internal format, and validates result
 *
 * @param rawConfig - Raw JSON configuration object
 * @returns Validated and transformed internal configuration
 * @throws ZodError if validation fails
 */
export function parseMcpConfig(rawConfig: unknown): InternalMcpConfig {
  // First, validate against Claude Code format
  const claudeConfig = ClaudeCodeMcpConfigSchema.parse(rawConfig);

  // Then transform to internal format
  const internalConfig = transformClaudeCodeConfig(claudeConfig);

  // Finally, validate the transformed config
  return InternalMcpConfigSchema.parse(internalConfig);
}
