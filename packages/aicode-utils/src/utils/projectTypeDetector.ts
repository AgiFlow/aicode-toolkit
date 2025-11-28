/**
 * projectTypeDetector Utilities
 *
 * DESIGN PATTERNS:
 * - Pure function pattern: No side effects, deterministic output
 * - Single domain focus: All functions related to project type detection
 * - Composability: Functions can be combined to create complex behavior
 *
 * CODING STANDARDS:
 * - Function names use camelCase with descriptive verbs (validate, format, parse, transform)
 * - All functions should be pure (same input = same output, no side effects)
 * - Use explicit return types
 * - Document complex logic with JSDoc comments
 * - Keep functions small and focused on single responsibility
 *
 * AVOID:
 * - Side effects (mutations, I/O, random values, Date.now(), etc.)
 * - Stateful behavior or closures with mutable state
 * - Dependencies on external services or global variables
 * - Classes (use pure functions instead)
 */

import path from 'node:path';
import * as fs from 'node:fs/promises';
import * as yaml from 'js-yaml';
import { pathExists, readJson } from './fsHelpers';
import { ProjectType } from '../constants';
import type { ToolkitConfig } from '../types';

/**
 * Result of project type detection
 */
export interface ProjectTypeDetectionResult {
  /** Detected project type (undefined if not detected) */
  projectType?: ProjectType;
  /** List of indicators that led to the detection */
  indicators: string[];
}

/**
 * Monorepo configuration files that indicate a monorepo setup
 */
const MONOREPO_INDICATOR_FILES = [
  'nx.json',
  'turbo.json',
  'rush.json',
  'lerna.json',
  'pnpm-workspace.yaml',
] as const;

/**
 * Detect project type (monorepo vs monolith) based on workspace files
 * Deterministic detection: monorepo exists when monorepo configuration files are found
 *
 * Detection priority:
 * 1. toolkit.yaml (highest priority - explicit configuration)
 * 2. Monorepo configuration files (nx.json, turbo.json, rush.json, lerna.json, pnpm-workspace.yaml)
 * 3. package.json with workspaces field (npm/yarn workspaces)
 * 4. If nothing found, returns undefined (user should choose)
 *
 * @param workspaceRoot - Absolute path to the workspace root directory
 * @returns Detection result with project type and indicators
 */
export async function detectProjectType(
  workspaceRoot: string,
): Promise<ProjectTypeDetectionResult> {
  const indicators: string[] = [];

  // Check toolkit.yaml first (highest priority)
  const toolkitYamlPath = path.join(workspaceRoot, 'toolkit.yaml');
  if (await pathExists(toolkitYamlPath)) {
    try {
      const content = await fs.readFile(toolkitYamlPath, 'utf-8');
      const config = yaml.load(content) as ToolkitConfig;
      if (config?.projectType) {
        indicators.push(`toolkit.yaml specifies ${config.projectType}`);
        return {
          projectType: config.projectType as ProjectType,
          indicators,
        };
      }
    } catch {
      // Ignore errors reading/parsing toolkit.yaml
    }
  }

  // Check deterministic monorepo indicators
  for (const filename of MONOREPO_INDICATOR_FILES) {
    const filePath = path.join(workspaceRoot, filename);
    if (await pathExists(filePath)) {
      indicators.push(`${filename} found`);
      return {
        projectType: ProjectType.MONOREPO,
        indicators,
      };
    }
  }

  // Check package.json for workspaces (npm/yarn workspaces)
  const packageJsonPath = path.join(workspaceRoot, 'package.json');
  if (await pathExists(packageJsonPath)) {
    try {
      const packageJson = await readJson<{ workspaces?: unknown }>(packageJsonPath);
      if (packageJson.workspaces) {
        indicators.push('package.json with workspaces found');
        return {
          projectType: ProjectType.MONOREPO,
          indicators,
        };
      }
    } catch {
      // Ignore errors reading/parsing package.json
    }
  }

  // No monorepo indicators found
  indicators.push('No monorepo indicators found');
  return {
    projectType: undefined,
    indicators,
  };
}

/**
 * Check if a workspace is a monorepo
 * Convenience function that returns a boolean
 *
 * @param workspaceRoot - Absolute path to the workspace root directory
 * @returns True if workspace is detected as monorepo, false otherwise
 */
export async function isMonorepo(workspaceRoot: string): Promise<boolean> {
  const result = await detectProjectType(workspaceRoot);
  return result.projectType === ProjectType.MONOREPO;
}

/**
 * Check if a workspace is a monolith
 * Convenience function that returns a boolean
 *
 * @param workspaceRoot - Absolute path to the workspace root directory
 * @returns True if workspace is detected as monolith, false otherwise
 */
export async function isMonolith(workspaceRoot: string): Promise<boolean> {
  const result = await detectProjectType(workspaceRoot);
  return result.projectType === ProjectType.MONOLITH;
}
