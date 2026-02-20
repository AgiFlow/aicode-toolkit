/**
 * App-specific design system configuration
 *
 * This configuration is read from each app's project.json file
 * under the "style-system" key.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
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

  /**
   * Tags that identify shared/design system components.
   * Components with these tags are considered shared and reusable.
   * Default: ['style-system']
   */
  sharedComponentTags?: string[];
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
 * Default tags for identifying shared/design system components
 */
export const DEFAULT_SHARED_COMPONENT_TAGS = ['style-system'];

/**
 * Default configuration for apps without style-system config
 */
const DEFAULT_CONFIG: DesignSystemConfig = {
  type: 'tailwind',
  themeProvider: '@agimonai/web-ui',
  sharedComponentTags: DEFAULT_SHARED_COMPONENT_TAGS,
};

/**
 * Validate style-system configuration from project.json.
 * Ensures required fields are present and have correct types.
 *
 * @param config - The config object to validate
 * @param projectName - Project name for error messages
 * @returns Validated DesignSystemConfig
 * @throws Error if validation fails
 */
function validateDesignSystemConfig(config: unknown, projectName: string): DesignSystemConfig {
  if (typeof config !== 'object' || config === null) {
    throw new Error(`[${projectName}] style-system config must be an object`);
  }

  const cfg = config as Record<string, unknown>;

  // Validate required field: type
  if (!cfg.type || (cfg.type !== 'tailwind' && cfg.type !== 'shadcn')) {
    throw new Error(`[${projectName}] style-system.type must be 'tailwind' or 'shadcn'`);
  }

  // Validate required field: themeProvider
  if (!cfg.themeProvider || typeof cfg.themeProvider !== 'string') {
    throw new Error(`[${projectName}] style-system.themeProvider is required and must be a string`);
  }

  // Validate optional fields
  if (cfg.tailwindConfig !== undefined && typeof cfg.tailwindConfig !== 'string') {
    throw new Error(`[${projectName}] style-system.tailwindConfig must be a string`);
  }

  if (cfg.rootComponent !== undefined && typeof cfg.rootComponent !== 'string') {
    throw new Error(`[${projectName}] style-system.rootComponent must be a string`);
  }

  if (cfg.cssFiles !== undefined) {
    if (!Array.isArray(cfg.cssFiles) || !cfg.cssFiles.every((f) => typeof f === 'string')) {
      throw new Error(`[${projectName}] style-system.cssFiles must be an array of strings`);
    }
  }

  if (cfg.componentLibrary !== undefined && typeof cfg.componentLibrary !== 'string') {
    throw new Error(`[${projectName}] style-system.componentLibrary must be a string`);
  }

  if (cfg.themePath !== undefined && typeof cfg.themePath !== 'string') {
    throw new Error(`[${projectName}] style-system.themePath must be a string`);
  }

  if (cfg.sharedComponentTags !== undefined) {
    if (
      !Array.isArray(cfg.sharedComponentTags) ||
      !cfg.sharedComponentTags.every((t) => typeof t === 'string')
    ) {
      throw new Error(
        `[${projectName}] style-system.sharedComponentTags must be an array of strings`,
      );
    }
  }

  return config as DesignSystemConfig;
}

/**
 * Read design system configuration from an app's project.json.
 *
 * @param appPath - Path to the app directory (relative or absolute)
 * @returns Validated DesignSystemConfig
 * @throws Error if appPath is invalid, project.json cannot be read, or config validation fails
 */
export async function getAppDesignSystemConfig(appPath: string): Promise<DesignSystemConfig> {
  // Validate input
  if (!appPath || typeof appPath !== 'string') {
    throw new Error('appPath is required and must be a non-empty string');
  }

  const monorepoRoot = TemplatesManagerService.getWorkspaceRootSync();

  // Resolve app path (could be relative or absolute)
  const resolvedAppPath = path.isAbsolute(appPath) ? appPath : path.join(monorepoRoot, appPath);

  const projectJsonPath = path.join(resolvedAppPath, 'project.json');

  try {
    const content = await fs.readFile(projectJsonPath, 'utf-8');
    let projectJson: unknown;

    try {
      projectJson = JSON.parse(content);
    } catch (parseError) {
      throw new Error(
        `Invalid JSON in ${projectJsonPath}: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
      );
    }

    // Validate project.json has expected structure
    if (typeof projectJson !== 'object' || projectJson === null) {
      throw new Error(`${projectJsonPath} must contain a JSON object`);
    }

    const project = projectJson as ProjectJson;
    const projectName = project.name ? project.name : path.basename(resolvedAppPath);

    if (project['style-system']) {
      const validatedConfig = validateDesignSystemConfig(project['style-system'], projectName);
      log.info(`[Config] Loaded and validated style-system config for ${projectName}`);
      return validatedConfig;
    }

    log.info(`[Config] No style-system config found for ${projectName}, using defaults`);
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
  const possiblePaths = [
    path.join(monorepoRoot, 'apps', appName),
    path.join(monorepoRoot, 'backend', 'apps', appName),
  ];

  const errors: string[] = [];

  for (const appPath of possiblePaths) {
    try {
      return await getAppDesignSystemConfig(appPath);
    } catch (error) {
      // Collect errors for debugging - file not found is expected, other errors are not
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`${appPath}: ${errorMessage}`);
    }
  }

  throw new Error(
    `Could not find app "${appName}" in common locations. Tried:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
  );
}

/**
 * Configuration for getCssClasses tool custom service override
 */
export interface GetCssClassesConfig {
  /** Path to custom service module (relative to workspace root) */
  customService?: string;
}

/**
 * Configuration for bundler service override
 */
export interface BundlerConfig {
  /** Path to custom bundler service module (relative to workspace root) */
  customService?: string;
}

/**
 * Toolkit.yaml style-system configuration structure
 */
interface ToolkitStyleSystemConfig {
  sharedComponentTags?: string[];
  getCssClasses?: GetCssClassesConfig;
  bundler?: BundlerConfig;
}

/**
 * Toolkit.yaml structure (partial)
 */
interface ToolkitYaml {
  'style-system'?: ToolkitStyleSystemConfig;
}

/**
 * Get shared component tags from toolkit.yaml or use defaults.
 *
 * Reads configuration from toolkit.yaml at workspace root.
 * Falls back to DEFAULT_SHARED_COMPONENT_TAGS if not configured.
 *
 * @returns Array of tag names that identify shared components
 */
export async function getSharedComponentTags(): Promise<string[]> {
  const monorepoRoot = TemplatesManagerService.getWorkspaceRootSync();
  const toolkitYamlPath = path.join(monorepoRoot, 'toolkit.yaml');

  try {
    const content = await fs.readFile(toolkitYamlPath, 'utf-8');
    const config = yaml.load(content) as ToolkitYaml | null;

    if (config?.['style-system']?.sharedComponentTags?.length) {
      const tags = config['style-system'].sharedComponentTags;
      // Validate that tags is an array of strings
      if (Array.isArray(tags) && tags.every((tag) => typeof tag === 'string')) {
        log.info(`[Config] Loaded sharedComponentTags from toolkit.yaml: ${tags.join(', ')}`);
        return tags;
      }
      log.warn(
        '[Config] sharedComponentTags in toolkit.yaml is not a valid string array, using defaults',
      );
    }
  } catch (error) {
    // Only log if it's not a file-not-found error (ENOENT)
    if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
      log.warn(`[Config] Failed to parse toolkit.yaml: ${error.message}`);
    }
    // toolkit.yaml doesn't exist or couldn't be read, use defaults
  }

  log.info(
    `[Config] Using default sharedComponentTags: ${DEFAULT_SHARED_COMPONENT_TAGS.join(', ')}`,
  );
  return DEFAULT_SHARED_COMPONENT_TAGS;
}

/**
 * Get getCssClasses tool configuration from toolkit.yaml.
 *
 * Reads configuration from toolkit.yaml at workspace root under
 * style-system.getCssClasses key.
 *
 * @returns GetCssClassesConfig or undefined if not configured
 */
export async function getGetCssClassesConfig(): Promise<GetCssClassesConfig | undefined> {
  const monorepoRoot = TemplatesManagerService.getWorkspaceRootSync();
  const toolkitYamlPath = path.join(monorepoRoot, 'toolkit.yaml');

  try {
    const content = await fs.readFile(toolkitYamlPath, 'utf-8');
    const config = yaml.load(content) as ToolkitYaml | null;

    if (config?.['style-system']?.getCssClasses) {
      const getCssClassesConfig = config['style-system'].getCssClasses;

      // Validate customService if provided
      if (
        getCssClassesConfig.customService !== undefined &&
        typeof getCssClassesConfig.customService !== 'string'
      ) {
        log.warn('[Config] style-system.getCssClasses.customService must be a string, ignoring');
        return undefined;
      }

      log.info(`[Config] Loaded getCssClasses config from toolkit.yaml`);
      return getCssClassesConfig;
    }
  } catch (error) {
    // Only log if it's not a file-not-found error (ENOENT)
    if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
      log.warn(`[Config] Failed to parse toolkit.yaml: ${error.message}`);
    }
  }

  return undefined;
}

/**
 * Get bundler service configuration from toolkit.yaml.
 *
 * Reads configuration from toolkit.yaml at workspace root under
 * style-system.bundler key.
 *
 * @returns BundlerConfig or undefined if not configured
 */
export async function getBundlerConfig(): Promise<BundlerConfig | undefined> {
  const monorepoRoot = TemplatesManagerService.getWorkspaceRootSync();
  const toolkitYamlPath = path.join(monorepoRoot, 'toolkit.yaml');

  try {
    const content = await fs.readFile(toolkitYamlPath, 'utf-8');
    const config = yaml.load(content) as ToolkitYaml | null;

    if (config?.['style-system']?.bundler) {
      const bundlerConfig = config['style-system'].bundler;

      // Validate customService if provided
      if (
        bundlerConfig.customService !== undefined &&
        typeof bundlerConfig.customService !== 'string'
      ) {
        log.warn('[Config] style-system.bundler.customService must be a string, ignoring');
        return undefined;
      }

      log.info(`[Config] Loaded bundler config from toolkit.yaml`);
      return bundlerConfig;
    }
  } catch (error) {
    // Only log if it's not a file-not-found error (ENOENT)
    if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
      log.warn(`[Config] Failed to parse toolkit.yaml: ${error.message}`);
    }
  }

  return undefined;
}
