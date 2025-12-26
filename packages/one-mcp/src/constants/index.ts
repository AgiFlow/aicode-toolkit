/**
 * Shared constants for one-mcp package
 */

/**
 * Prefix added to skill names when they clash with MCP tool names.
 * This ensures skills can be uniquely identified even when a tool has the same name.
 */
export const SKILL_PREFIX = 'skill__';

/**
 * Log prefix for skill detection messages.
 * Used to easily filter skill detection logs in stderr output.
 */
export const LOG_PREFIX_SKILL_DETECTION = '[skill-detection]';

/**
 * Prefix for prompt-based skill locations.
 * Format: "prompt:{serverName}:{promptName}"
 */
export const PROMPT_LOCATION_PREFIX = 'prompt:';

/**
 * Default server ID used when no ID is provided via CLI or config.
 * This fallback is used when auto-generation also fails.
 */
export const DEFAULT_SERVER_ID = 'unknown';
