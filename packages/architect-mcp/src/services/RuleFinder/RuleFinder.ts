/**
 * RuleFinder
 *
 * DESIGN PATTERNS:
 * - Service pattern for business logic encapsulation
 * - Single responsibility principle
 * - Caching for performance optimization
 *
 * CODING STANDARDS:
 * - Use async/await for asynchronous operations
 * - Throw descriptive errors for error cases
 * - Keep methods focused and well-named
 * - Document complex logic with comments
 *
 * AVOID:
 * - Mixing concerns (keep focused on single domain)
 * - Direct tool implementation (services should be tool-agnostic)
 */

import {
  ProjectConfigResolver,
  ProjectFinderService,
  TemplatesManagerService,
} from '@agiflowai/aicode-utils';
import * as fs from 'node:fs/promises';
import * as yaml from 'js-yaml';
import { minimatch } from 'minimatch';
import * as path from 'node:path';
import type { RulesYamlConfig, RuleSection, ProjectConfig } from '../../types';
import {
  RULES_FILENAME,
  SRC_PREFIX,
  UTF8_ENCODING,
  GLOB_NEGATION_PREFIX,
} from '../../constants';

export class RuleFinder {
  private projectCache: Map<string, ProjectConfig> = new Map();
  private rulesCache: Map<string, RulesYamlConfig> = new Map();
  private projectRulesCache: Map<string, RulesYamlConfig | null> = new Map();
  private globalRulesCache: RulesYamlConfig | null = null;
  private workspaceRoot: string;
  private projectFinder: ProjectFinderService;

  constructor(workspaceRoot?: string) {
    this.workspaceRoot = workspaceRoot || process.cwd();
    this.projectFinder = new ProjectFinderService(this.workspaceRoot);
  }

  /**
   * Load global rules from templates/RULES.yaml
   */
  private async loadGlobalRules(): Promise<RulesYamlConfig | null> {
    if (this.globalRulesCache) {
      return this.globalRulesCache;
    }

    try {
      const templatesRoot = await TemplatesManagerService.findTemplatesPath(this.workspaceRoot);
      if (!templatesRoot) {
        return null;
      }
      const globalRulesPath = path.join(templatesRoot, RULES_FILENAME);
      const globalRulesContent = await fs.readFile(globalRulesPath, UTF8_ENCODING);
      this.globalRulesCache = yaml.load(globalRulesContent) as RulesYamlConfig;
      return this.globalRulesCache;
    } catch (_error) {
      // Global rules are optional
      return null;
    }
  }

  /**
   * Load project-level rules from RULES.yaml in the project root directory
   */
  private async loadProjectRules(projectRoot: string): Promise<RulesYamlConfig | null> {
    // Check cache first
    if (this.projectRulesCache.has(projectRoot)) {
      return this.projectRulesCache.get(projectRoot) ?? null;
    }

    try {
      const projectRulesPath = path.join(projectRoot, RULES_FILENAME);
      const projectRulesContent = await fs.readFile(projectRulesPath, UTF8_ENCODING);
      const rulesConfig = yaml.load(projectRulesContent) as RulesYamlConfig;
      this.projectRulesCache.set(projectRoot, rulesConfig);
      return rulesConfig;
    } catch (_error) {
      // Project rules are optional
      this.projectRulesCache.set(projectRoot, null);
      return null;
    }
  }

  /**
   * Find inherited rule by pattern.
   * Checks in priority order: project -> template -> global
   */
  private async findInheritedRule(
    pattern: string,
    projectRules: RulesYamlConfig | null,
    templateRules: RulesYamlConfig | null,
    globalRules: RulesYamlConfig | null,
  ): Promise<RuleSection | null> {
    // First check project rules (highest priority)
    if (projectRules) {
      const projectMatches = projectRules.rules.filter((rule) => rule.pattern === pattern);
      // If multiple matches in project, get the second one (as specified in requirements)
      if (projectMatches.length > 1) {
        return projectMatches[1];
      } else if (projectMatches.length === 1) {
        return projectMatches[0];
      }
    }

    // Then check template rules
    if (templateRules) {
      const templateMatches = templateRules.rules.filter((rule) => rule.pattern === pattern);
      if (templateMatches.length > 1) {
        return templateMatches[1];
      } else if (templateMatches.length === 1) {
        return templateMatches[0];
      }
    }

    // Finally check global rules
    if (globalRules) {
      const globalMatches = globalRules.rules.filter((rule) => rule.pattern === pattern);
      if (globalMatches.length > 1) {
        return globalMatches[1];
      } else if (globalMatches.length === 1) {
        return globalMatches[0];
      }
    }

    return null;
  }

  /**
   * Merge two rule sections, with the second rule taking priority
   */
  private mergeRules(baseRule: RuleSection, overrideRule: RuleSection): RuleSection {
    return {
      pattern: overrideRule.pattern,
      globs: overrideRule.globs || baseRule.globs,
      description: overrideRule.description || baseRule.description,
      inherits: overrideRule.inherits || baseRule.inherits,
      must_do: [...(baseRule.must_do || []), ...(overrideRule.must_do || [])],
      should_do: [...(baseRule.should_do || []), ...(overrideRule.should_do || [])],
      must_not_do: [...(baseRule.must_not_do || []), ...(overrideRule.must_not_do || [])],
    };
  }

  /**
   * Resolve inheritance for a rule section.
   * Checks in priority order: project -> template -> global
   */
  private async resolveInheritance(
    rule: RuleSection,
    projectRules: RulesYamlConfig | null,
    templateRules: RulesYamlConfig | null,
    globalRules: RulesYamlConfig | null,
  ): Promise<RuleSection> {
    let resolvedRule = { ...rule };

    // Resolve inheritance
    if (rule.inherits && rule.inherits.length > 0) {
      for (const inheritPattern of rule.inherits) {
        const inheritedRule = await this.findInheritedRule(
          inheritPattern,
          projectRules,
          templateRules,
          globalRules,
        );
        if (inheritedRule) {
          // Recursively resolve inheritance for the inherited rule
          const fullyResolvedInheritedRule = await this.resolveInheritance(
            inheritedRule,
            projectRules,
            templateRules,
            globalRules,
          );
          resolvedRule = this.mergeRules(fullyResolvedInheritedRule, resolvedRule);
        }
      }
    }

    return resolvedRule;
  }

  /**
   * Find rules for a given file path
   */
  async findRulesForFile(filePath: string): Promise<{
    project: ProjectConfig | null;
    rulesConfig: RulesYamlConfig | null;
    matchedRule: RuleSection | null;
    templatePath: string | null;
  }> {
    // Normalize the file path
    const normalizedPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.workspaceRoot, filePath);

    // Find the project containing this file
    const project = await this.findProjectForFile(normalizedPath);

    if (!project || !project.sourceTemplate) {
      return { project, rulesConfig: null, matchedRule: null, templatePath: null };
    }

    // Load project, template, and global rules in parallel for better performance
    const [{ rulesConfig, templatePath }, globalRules, projectRules] = await Promise.all([
      this.loadRulesForTemplate(project.sourceTemplate),
      this.loadGlobalRules(),
      this.loadProjectRules(project.root),
    ]);

    // Merge rules in priority order: project -> template -> global
    const mergedRulesConfig = this.mergeRulesConfigs(projectRules, rulesConfig, globalRules);

    // If no rules exist at any level, return early
    if (!mergedRulesConfig) {
      return { project, rulesConfig: null, matchedRule: null, templatePath };
    }

    // Find matching rule section
    const matchedRule = this.findMatchingRule(normalizedPath, project.root, mergedRulesConfig);

    if (!matchedRule) {
      return { project, rulesConfig: mergedRulesConfig, matchedRule: null, templatePath };
    }

    // Resolve inheritance for the matched rule
    const resolvedRule = await this.resolveInheritance(
      matchedRule,
      projectRules,
      rulesConfig,
      globalRules,
    );

    return { project, rulesConfig: mergedRulesConfig, matchedRule: resolvedRule, templatePath };
  }

  /**
   * Merge rules configs from project, template, and global sources.
   * Priority order: project -> template -> global (project rules come first)
   * Handles cases where any or all configs may be null.
   */
  private mergeRulesConfigs(
    projectRules: RulesYamlConfig | null,
    templateRules: RulesYamlConfig | null,
    globalRules: RulesYamlConfig | null,
  ): RulesYamlConfig | null {
    // If all are null, return null
    if (!projectRules && !templateRules && !globalRules) {
      return null;
    }

    // Find the first non-null config to use as base for metadata
    const baseConfig = projectRules || templateRules || globalRules;

    // Merge all rules in priority order: project -> template -> global
    return {
      ...baseConfig!,
      rules: [
        ...(projectRules?.rules || []),
        ...(templateRules?.rules || []),
        ...(globalRules?.rules || []),
      ],
    };
  }

  /**
   * Load RULES.yaml for a template
   */
  private async loadRulesForTemplate(sourceTemplate: string): Promise<{
    rulesConfig: RulesYamlConfig | null;
    templatePath: string | null;
  }> {
    // Check cache
    if (this.rulesCache.has(sourceTemplate)) {
      const cached = this.rulesCache.get(sourceTemplate)!;
      const templatesRoot = await TemplatesManagerService.findTemplatesPath(this.workspaceRoot);
      if (!templatesRoot) {
        return { rulesConfig: null, templatePath: null };
      }
      const templatePath = path.join(templatesRoot, sourceTemplate);
      return { rulesConfig: cached, templatePath };
    }

    try {
      // Use TemplatesManagerService to find the templates directory
      const templatesRoot = await TemplatesManagerService.findTemplatesPath(this.workspaceRoot);
      if (!templatesRoot) {
        return { rulesConfig: null, templatePath: null };
      }
      const templatePath = path.join(templatesRoot, sourceTemplate);
      const rulesPath = path.join(templatePath, RULES_FILENAME);

      const rulesContent = await fs.readFile(rulesPath, UTF8_ENCODING);
      const rulesConfig = yaml.load(rulesContent) as RulesYamlConfig;

      // Cache the result
      this.rulesCache.set(sourceTemplate, rulesConfig);

      return { rulesConfig, templatePath };
    } catch {
      // RULES.yaml is optional for templates
      return { rulesConfig: null, templatePath: null };
    }
  }

  /**
   * Find matching rule for a file path
   *
   * Supports both positive and negated glob patterns:
   * - Positive patterns (e.g., 'src/*.ts') include files
   * - Negated patterns (e.g., '!src/*.test.ts') exclude files
   *
   * A file matches a rule if:
   * 1. It matches at least one positive pattern (or there are no positive patterns)
   * 2. AND it does NOT match any negated pattern
   *
   * Example: globs: ['src/*.ts', '!src/*.test.ts', '!src/*.spec.ts']
   * - 'src/utils/helper.ts' → matches (positive match, no negative match)
   * - 'src/utils/helper.test.ts' → no match (excluded by negated pattern)
   */
  private findMatchingRule(
    filePath: string,
    projectRoot: string,
    rulesConfig: RulesYamlConfig,
  ): RuleSection | null {
    // Get the file path relative to the project root
    const projectRelativePath = path.relative(projectRoot, filePath);

    // Try different path variations to handle both src-prefixed and non-prefixed patterns in RULES.yaml
    const pathVariations = [
      projectRelativePath,
      // Also try with src/ prefix if not present
      projectRelativePath.startsWith(SRC_PREFIX)
        ? projectRelativePath
        : `${SRC_PREFIX}${projectRelativePath}`,
      // Try without src/ prefix if present
      projectRelativePath.startsWith(SRC_PREFIX)
        ? projectRelativePath.slice(SRC_PREFIX.length)
        : projectRelativePath,
    ];

    for (const ruleSection of rulesConfig.rules) {
      // Get patterns: prefer globs array, fallback to single pattern
      const patterns =
        ruleSection.globs && ruleSection.globs.length > 0
          ? ruleSection.globs
          : [ruleSection.pattern];

      // Separate positive and negative (negated) patterns
      const positivePatterns = patterns.filter(
        (p) => !p.startsWith(GLOB_NEGATION_PREFIX),
      );
      const negativePatterns = patterns
        .filter((p) => p.startsWith(GLOB_NEGATION_PREFIX))
        .map((p) => p.slice(GLOB_NEGATION_PREFIX.length)); // Remove the negation prefix

      // Check if any path variation matches the rule
      for (const pathVariant of pathVariations) {
        // Must match at least one positive pattern.
        // If no positive patterns exist, treat as implicit match for any file -
        // negated patterns become the primary filter (useful for exclusion-only rules)
        const matchesPositive =
          positivePatterns.length === 0 ||
          positivePatterns.some((pattern) => minimatch(pathVariant, pattern));

        // Must NOT match any negative pattern
        const matchesNegative = negativePatterns.some((pattern) =>
          minimatch(pathVariant, pattern),
        );

        if (matchesPositive && !matchesNegative) {
          return ruleSection;
        }
      }
    }

    return null;
  }

  /**
   * Find the project containing a given file
   * Supports both monolith (toolkit.yaml) and monorepo (project.json) configurations
   */
  private async findProjectForFile(filePath: string): Promise<ProjectConfig | null> {
    try {
      // For monorepo: First try to find project using ProjectFinderService
      // For monolith: ProjectConfigResolver will find toolkit.yaml at workspace root
      const project = await this.projectFinder.findProjectForFile(filePath);

      let projectConfig: {
        sourceTemplate?: string;
        workspaceRoot?: string;
        type?: string;
      };
      let projectRoot: string;
      let projectName: string;

      if (project?.root) {
        // Monorepo project found - use ProjectConfigResolver with project directory
        projectConfig = await ProjectConfigResolver.resolveProjectConfig(project.root);
        projectRoot = project.root;
        projectName = project.name;
      } else {
        // No project found - try workspace root for monolith mode
        projectConfig = await ProjectConfigResolver.resolveProjectConfig(this.workspaceRoot);
        projectRoot = projectConfig.workspaceRoot || this.workspaceRoot;
        projectName = path.basename(projectRoot);
      }

      if (!projectConfig || !projectConfig.sourceTemplate) {
        return null;
      }

      // IMPORTANT: Verify the file is actually within the project
      // This prevents returning project config for files outside the project
      const relativeToProject = path.relative(projectRoot, filePath);
      const isInProject =
        !relativeToProject.startsWith('..') && !path.isAbsolute(relativeToProject);

      if (!isInProject) {
        // File is outside the project, cannot determine rules
        return null;
      }

      return {
        name: projectName,
        root: projectRoot,
        sourceTemplate: projectConfig.sourceTemplate,
        projectType: projectConfig.type,
      };
    } catch {
      // Project config not found
      return null;
    }
  }

  /**
   * Clear all internal caches including project configs, template rules,
   * project rules, and global rules. Call this when underlying RULES.yaml
   * files may have changed on disk.
   */
  clearCache(): void {
    this.projectCache.clear();
    this.rulesCache.clear();
    this.projectRulesCache.clear();
    this.globalRulesCache = null;
    this.projectFinder.clearCache();
  }
}
