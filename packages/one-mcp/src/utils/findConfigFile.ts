/**
 * Config File Finder Utility
 *
 * DESIGN PATTERNS:
 * - Utility function pattern for reusable logic
 * - Fail-fast pattern with early returns
 * - Environment variable configuration pattern
 *
 * CODING STANDARDS:
 * - Use sync filesystem operations for config discovery (performance)
 * - Check PROJECT_PATH environment variable first
 * - Fall back to current working directory
 * - Support both .yaml and .json extensions
 * - Return null if no config file is found
 *
 * AVOID:
 * - Throwing errors (return null instead for optional config)
 * - Hardcoded file names without extension variants
 * - Ignoring environment variables
 */

import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

/**
 * Find MCP configuration file by checking PROJECT_PATH first, then cwd
 * Looks for both mcp-config.yaml and mcp-config.json
 *
 * @returns Absolute path to config file, or null if not found
 */
export function findConfigFile(): string | null {
  const configFileNames = ['mcp-config.yaml', 'mcp-config.yml', 'mcp-config.json'];

  // Check PROJECT_PATH environment variable first
  const projectPath = process.env.PROJECT_PATH;
  if (projectPath) {
    for (const fileName of configFileNames) {
      const configPath = resolve(projectPath, fileName);
      if (existsSync(configPath)) {
        return configPath;
      }
    }
  }

  // Fall back to current working directory
  const cwd = process.cwd();
  for (const fileName of configFileNames) {
    const configPath = join(cwd, fileName);
    if (existsSync(configPath)) {
      return configPath;
    }
  }

  // No config file found
  return null;
}
