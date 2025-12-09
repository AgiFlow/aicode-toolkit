/**
 * App-specific design system configuration
 *
 * This configuration is read from each app's project.json file
 * under the "style-system" key.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { log, TemplatesManagerService } from '@agiflowai/aicode-utils';

/**
 * Design system configuration schema
 */
export interface DesignSystemConfig {
  /** Type of design system (tailwind or shadcn) */
  type: 'tailwind' | 'shadcn';

  /** Path to tailwind config file (optional) */
  tailwindConfig?: string;

  /** Path to theme provider component with default export */
  themeProvider: string;

  /** Path to root component for wrapping rendered components (optional) */
  rootComponent?: string;

  /** CSS file paths to include (optional) */
  cssFiles?: string[];

  /** Component library path (for shadcn) */
  componentLibrary?: string;

  /** Path to theme CSS file for Tailwind class extraction (optional) */
  themePath?: string;
}

/**
 * Project.json structure (partial)
 */
interface ProjectJson {
  name: string;
  sourceRoot?: string;
  'style-system'?: DesignSystemConfig;
}

/**
 * Default configuration for apps without style-system config
 */
const DEFAULT_CONFIG: DesignSystemConfig = {
  type: 'tailwind',
  themeProvider: '@agimonai/web-ui',
};

/**
 * Read design system configuration from an app's project.json
 */
export async function getAppDesignSystemConfig(appPath: string): Promise<DesignSystemConfig> {
  const monorepoRoot = TemplatesManagerService.getWorkspaceRootSync();

  // Resolve app path (could be relative or absolute)
  const resolvedAppPath = path.isAbsolute(appPath) ? appPath : path.join(monorepoRoot, appPath);

  const projectJsonPath = path.join(resolvedAppPath, 'project.json');

  try {
    const content = await fs.readFile(projectJsonPath, 'utf-8');
    const projectJson: ProjectJson = JSON.parse(content);

    if (projectJson['style-system']) {
      log.info(`[Config] Loaded style-system config for ${projectJson.name}`);
      return projectJson['style-system'];
    }

    log.info(`[Config] No style-system config found for ${projectJson.name}, using defaults`);
    return DEFAULT_CONFIG;
  } catch (error) {
    throw new Error(
      `Failed to read style-system config from ${projectJsonPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Read design system configuration from an app by name
 */
export async function getAppDesignSystemConfigByName(appName: string): Promise<DesignSystemConfig> {
  const monorepoRoot = TemplatesManagerService.getWorkspaceRootSync();

  // Try common app locations
  const possiblePaths = [path.join(monorepoRoot, 'apps', appName), path.join(monorepoRoot, 'backend', 'apps', appName)];

  for (const appPath of possiblePaths) {
    try {
      return await getAppDesignSystemConfig(appPath);
    } catch {}
  }

  throw new Error(`Could not find app "${appName}" in common locations`);
}
