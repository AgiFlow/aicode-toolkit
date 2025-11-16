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
 * Private IP range patterns for SSRF protection
 */
const PRIVATE_IP_PATTERNS = [
  /^127\./,                          // Loopback (127.0.0.0/8)
  /^10\./,                           // Private Class A (10.0.0.0/8)
  /^172\.(1[6-9]|2\d|3[01])\./,     // Private Class B (172.16.0.0/12)
  /^192\.168\./,                     // Private Class C (192.168.0.0/16)
  /^169\.254\./,                     // Link-local (169.254.0.0/16)
  /^0\./,                            // Invalid (0.0.0.0/8)
  /^224\./,                          // Multicast (224.0.0.0/4)
  /^240\./,                          // Reserved (240.0.0.0/4)
  /^localhost$/i,                    // Localhost
  /^.*\.localhost$/i,                // *.localhost
  /^\[::\]/,                         // IPv6 loopback
  /^\[::1\]/,                        // IPv6 loopback
  /^\[fe80:/i,                       // IPv6 link-local
  /^\[fc00:/i,                       // IPv6 unique local
  /^\[fd00:/i,                       // IPv6 unique local
];

/**
 * Validate URL for SSRF protection
 *
 * @param url - The URL to validate (after env var interpolation)
 * @param security - Security settings
 * @throws Error if URL is unsafe
 */
function validateUrlSecurity(url: string, security?: RemoteConfigSource['security']): void {
  // Apply secure defaults
  const allowPrivateIPs = security?.allowPrivateIPs ?? false;
  const enforceHttps = security?.enforceHttps ?? true;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch (error) {
    throw new Error(`Invalid URL format: ${url}`);
  }

  // Check protocol
  const protocol = parsedUrl.protocol.replace(':', '');
  if (enforceHttps && protocol !== 'https') {
    throw new Error(
      `HTTPS is required for security. URL uses '${protocol}://'. Set security.enforceHttps: false to allow HTTP.`
    );
  }

  if (protocol !== 'http' && protocol !== 'https') {
    throw new Error(
      `Invalid URL protocol '${protocol}://'. Only http:// and https:// are allowed.`
    );
  }

  // Check for private IPs and localhost (unless explicitly allowed)
  if (!allowPrivateIPs) {
    const hostname = parsedUrl.hostname.toLowerCase();
    const isPrivateOrLocal = PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname));

    if (isPrivateOrLocal) {
      throw new Error(
        `Private IP addresses and localhost are blocked for security (${hostname}). Set security.allowPrivateIPs: true to allow internal networks.`
      );
    }
  }
}

/**
 * Validate a remote config source against its validation rules
 *
 * @param source - Remote config source with validation rules
 * @throws Error if validation fails
 */
export function validateRemoteConfigSource(source: RemoteConfigSource): void {
  // Interpolate environment variables in URL first
  const interpolatedUrl = interpolateEnvVars(source.url);

  // SSRF protection - validate URL security
  validateUrlSecurity(interpolatedUrl, source.security);

  // Custom regex validation (if provided)
  if (!source.validation) {
    return;
  }

  // Validate URL format if pattern is provided
  if (source.validation.url) {
    const urlPattern = new RegExp(source.validation.url);

    if (!urlPattern.test(interpolatedUrl)) {
      throw new Error(
        `Remote config URL "${interpolatedUrl}" does not match validation pattern: ${source.validation.url}`
      );
    }
  }

  // Validate header values against regex patterns
  if (source.validation.headers && Object.keys(source.validation.headers).length > 0) {
    // Check if headers are provided in the source
    if (!source.headers) {
      const requiredHeaders = Object.keys(source.validation.headers);
      throw new Error(
        `Remote config is missing required headers: ${requiredHeaders.join(', ')}`
      );
    }

    // Validate each header value against its regex pattern
    for (const [headerName, pattern] of Object.entries(source.validation.headers)) {
      // Check if header exists
      if (!(headerName in source.headers)) {
        throw new Error(
          `Remote config is missing required header: ${headerName}`
        );
      }

      // Interpolate environment variables in the header value
      const interpolatedHeaderValue = interpolateEnvVars(source.headers[headerName]);

      // Validate header value against regex pattern
      const headerPattern = new RegExp(pattern);
      if (!headerPattern.test(interpolatedHeaderValue)) {
        throw new Error(
          `Remote config header "${headerName}" value "${interpolatedHeaderValue}" does not match validation pattern: ${pattern}`
        );
      }
    }
  }
}

/**
 * Claude Code / Claude Desktop standard MCP config format
 * This is the format users write in their config files
 */

// Additional config options (nested under 'config' key)
const AdditionalConfigSchema = z.object({
  instruction: z.string().optional(),
  toolBlacklist: z.array(z.string()).optional(),
  omitToolDescription: z.boolean().optional(),
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

// Remote config validation schema
const RemoteConfigValidationSchema = z.object({
  url: z.string().optional(), // Regex pattern to validate URL
  headers: z.record(z.string(), z.string()).optional(), // Header name to regex pattern mapping for validating header values
}).optional();

// Remote config security schema for SSRF protection
const RemoteConfigSecuritySchema = z.object({
  allowPrivateIPs: z.boolean().optional(), // Allow private IP ranges (default: false)
  enforceHttps: z.boolean().optional(), // Enforce HTTPS only (default: true)
}).optional();

// Remote config source schema
const RemoteConfigSourceSchema = z.object({
  url: z.string(), // URL to fetch remote config from (supports env var interpolation)
  headers: z.record(z.string(), z.string()).optional(), // Headers for the request (supports env var interpolation)
  validation: RemoteConfigValidationSchema, // Optional validation rules
  security: RemoteConfigSecuritySchema, // Optional security settings for SSRF protection
  mergeStrategy: z.enum(['local-priority', 'remote-priority', 'merge-deep']).optional(), // Merge strategy (default: local-priority)
});

export type RemoteConfigSource = z.infer<typeof RemoteConfigSourceSchema>;

/**
 * Full Claude Code MCP configuration schema
 */
export const ClaudeCodeMcpConfigSchema = z.object({
  mcpServers: z.record(z.string(), ClaudeCodeServerConfigSchema),
  remoteConfigs: z.array(RemoteConfigSourceSchema).optional(), // Optional remote config sources
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
    omitToolDescription: z.boolean().optional(),
    transport: z.literal('stdio'),
    config: McpStdioConfigSchema,
  }),
  z.object({
    name: z.string(),
    instruction: z.string().optional(),
    toolBlacklist: z.array(z.string()).optional(),
    omitToolDescription: z.boolean().optional(),
    transport: z.literal('http'),
    config: McpHttpConfigSchema,
  }),
  z.object({
    name: z.string(),
    instruction: z.string().optional(),
    toolBlacklist: z.array(z.string()).optional(),
    omitToolDescription: z.boolean().optional(),
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
      const omitToolDescription = stdioConfig.config?.omitToolDescription;

      transformedServers[serverName] = {
        name: serverName,
        instruction: finalInstruction,
        toolBlacklist,
        omitToolDescription,
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
      const omitToolDescription = httpConfig.config?.omitToolDescription;

      transformedServers[serverName] = {
        name: serverName,
        instruction: finalInstruction,
        toolBlacklist,
        omitToolDescription,
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
