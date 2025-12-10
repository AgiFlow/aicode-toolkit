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

/**
 * Toolkit.yaml style-system configuration structure
 */
interface ToolkitStyleSystemConfig {
  sharedComponentTags?: string[];
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
    // Simple YAML parsing for sharedComponentTags array
    const config = parseToolkitYaml(content);

    if (config['style-system']?.sharedComponentTags?.length) {
      log.info(`[Config] Loaded sharedComponentTags from toolkit.yaml: ${config['style-system'].sharedComponentTags.join(', ')}`);
      return config['style-system'].sharedComponentTags;
    }
  } catch {
    // toolkit.yaml doesn't exist or couldn't be read, use defaults
  }

  log.info(`[Config] Using default sharedComponentTags: ${DEFAULT_SHARED_COMPONENT_TAGS.join(', ')}`);
  return DEFAULT_SHARED_COMPONENT_TAGS;
}

/**
 * Simple YAML parser for toolkit.yaml style-system section.
 * Handles the specific structure we need without a full YAML library.
 */
function parseToolkitYaml(content: string): ToolkitYaml {
  const result: ToolkitYaml = {};
  const lines = content.split('\n');

  let inStyleSystem = false;
  let inSharedComponentTags = false;
  const tags: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for style-system section
    if (trimmed === 'style-system:') {
      inStyleSystem = true;
      continue;
    }

    // Exit style-system section on non-indented line
    if (inStyleSystem && !line.startsWith(' ') && !line.startsWith('\t') && trimmed !== '') {
      inStyleSystem = false;
      inSharedComponentTags = false;
    }

    if (inStyleSystem) {
      // Check for sharedComponentTags key
      if (trimmed === 'sharedComponentTags:') {
        inSharedComponentTags = true;
        continue;
      }

      // Exit sharedComponentTags on new key (not starting with -)
      if (inSharedComponentTags && !trimmed.startsWith('-') && trimmed.includes(':')) {
        inSharedComponentTags = false;
      }

      // Parse array items
      if (inSharedComponentTags && trimmed.startsWith('-')) {
        const tag = trimmed.slice(1).trim().replace(/^['"]|['"]$/g, '');
        if (tag) {
          tags.push(tag);
        }
      }
    }
  }

  if (tags.length > 0) {
    result['style-system'] = { sharedComponentTags: tags };
  }

  return result;
}
