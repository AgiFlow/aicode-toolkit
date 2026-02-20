/**
 * RuleFinder Tests
 *
 * Tests for the RuleFinder service, focusing on glob pattern matching functionality.
 */

import { describe, it, expect } from 'vitest';
import { minimatch } from 'minimatch';

const GLOB_NEGATION_PREFIX = '!';

/**
 * Test the pattern matching logic used by RuleFinder.findMatchingRule
 * This tests the core matching algorithm without needing to mock the file system
 */
describe('RuleFinder pattern matching logic', () => {
  // Helper function that mirrors the logic in RuleFinder.findMatchingRule
  // Updated to support negated glob patterns
  const findMatchingRule = (
    filePath: string,
    rules: Array<{ pattern: string; globs?: string[]; description: string }>,
  ): { pattern: string; globs?: string[]; description: string } | null => {
    const SRC_PREFIX = 'src/';
    const pathVariations = [
      filePath,
      filePath.startsWith(SRC_PREFIX) ? filePath : `${SRC_PREFIX}${filePath}`,
      filePath.startsWith(SRC_PREFIX) ? filePath.slice(SRC_PREFIX.length) : filePath,
    ];

    for (const ruleSection of rules) {
      // Get patterns: prefer globs array, fallback to single pattern
      const patterns =
        ruleSection.globs && ruleSection.globs.length > 0
          ? ruleSection.globs
          : [ruleSection.pattern];

      // Separate positive and negative (negated) patterns
      const positivePatterns = patterns.filter((p) => !p.startsWith(GLOB_NEGATION_PREFIX));
      const negativePatterns = patterns
        .filter((p) => p.startsWith(GLOB_NEGATION_PREFIX))
        .map((p) => p.slice(GLOB_NEGATION_PREFIX.length));

      for (const pathVariant of pathVariations) {
        // Match if: matches any positive pattern AND doesn't match any negative pattern
        const matchesPositive =
          positivePatterns.length === 0 ||
          positivePatterns.some((pattern) => minimatch(pathVariant, pattern));

        const matchesNegative = negativePatterns.some((pattern) => minimatch(pathVariant, pattern));

        if (matchesPositive && !matchesNegative) {
          return ruleSection;
        }
      }
    }

    return null;
  };

  describe('backward compatibility with pattern field', () => {
    it('should match files using single pattern field', () => {
      const rules = [{ pattern: 'src/app/**/page.tsx', description: 'Page component' }];

      const result = findMatchingRule('src/app/users/page.tsx', rules);
      expect(result).not.toBeNull();
      expect(result?.pattern).toBe('src/app/**/page.tsx');
    });

    it('should not match files that do not fit the pattern', () => {
      const rules = [{ pattern: 'src/app/**/page.tsx', description: 'Page component' }];

      const result = findMatchingRule('src/services/UserService.ts', rules);
      expect(result).toBeNull();
    });
  });

  describe('globs field support', () => {
    it('should prefer globs over pattern when both are provided', () => {
      const rules = [
        {
          pattern: 'server-actions',
          globs: ['src/actions/**/*.ts', 'src/server-actions/**/*.ts'],
          description: 'Server Action Standards',
        },
      ];

      // Should match first glob
      const result1 = findMatchingRule('src/actions/createUser.ts', rules);
      expect(result1).not.toBeNull();
      expect(result1?.description).toBe('Server Action Standards');

      // Should match second glob
      const result2 = findMatchingRule('src/server-actions/deleteUser.ts', rules);
      expect(result2).not.toBeNull();
      expect(result2?.description).toBe('Server Action Standards');

      // Should NOT match pattern field when globs are present
      // (pattern is just an identifier, not used for matching)
      const result3 = findMatchingRule('server-actions', rules);
      expect(result3).toBeNull();
    });

    it('should match any glob in the array', () => {
      const rules = [
        {
          pattern: 'validation-standards',
          globs: ['src/actions/**/*.ts', 'src/app/api/**/route.ts', 'src/services/**/*.ts'],
          description: 'Validation Standards',
        },
      ];

      expect(findMatchingRule('src/actions/createUser.ts', rules)).not.toBeNull();
      expect(findMatchingRule('src/app/api/users/route.ts', rules)).not.toBeNull();
      expect(findMatchingRule('src/services/UserService.ts', rules)).not.toBeNull();
      expect(findMatchingRule('src/components/Button.tsx', rules)).toBeNull();
    });

    it('should fallback to pattern when globs is empty array', () => {
      const rules = [
        {
          pattern: 'src/tools/**/*.ts',
          globs: [],
          description: 'Tool Standards',
        },
      ];

      const result = findMatchingRule('src/tools/MyTool.ts', rules);
      expect(result).not.toBeNull();
      expect(result?.description).toBe('Tool Standards');
    });

    it('should fallback to pattern when globs is undefined', () => {
      const rules = [
        {
          pattern: 'src/tools/**/*.ts',
          globs: undefined,
          description: 'Tool Standards',
        },
      ];

      const result = findMatchingRule('src/tools/MyTool.ts', rules);
      expect(result).not.toBeNull();
      expect(result?.description).toBe('Tool Standards');
    });
  });

  describe('path variations with globs', () => {
    it('should match files with src/ prefix variation', () => {
      const rules = [
        {
          pattern: 'services',
          globs: ['src/services/**/*.ts'],
          description: 'Service Standards',
        },
      ];

      // File path without src/ prefix should still match
      const result = findMatchingRule('services/UserService.ts', rules);
      expect(result).not.toBeNull();
    });

    it('should match files without src/ prefix variation', () => {
      const rules = [
        {
          pattern: 'services',
          globs: ['services/**/*.ts'],
          description: 'Service Standards',
        },
      ];

      // File path with src/ prefix should still match
      const result = findMatchingRule('src/services/UserService.ts', rules);
      expect(result).not.toBeNull();
    });
  });

  describe('multiple rules with globs', () => {
    it('should return first matching rule', () => {
      const rules = [
        {
          pattern: 'page-components',
          globs: ['src/app/**/page.tsx'],
          description: 'Page Components',
        },
        {
          pattern: 'layout-components',
          globs: ['src/app/**/layout.tsx'],
          description: 'Layout Components',
        },
        {
          pattern: 'all-components',
          globs: ['src/**/*.tsx'],
          description: 'All Components',
        },
      ];

      // Should match first rule (page-components)
      const result1 = findMatchingRule('src/app/users/page.tsx', rules);
      expect(result1?.description).toBe('Page Components');

      // Should match second rule (layout-components)
      const result2 = findMatchingRule('src/app/layout.tsx', rules);
      expect(result2?.description).toBe('Layout Components');

      // Should match third rule (all-components) since it doesn't match first two
      const result3 = findMatchingRule('src/components/Button.tsx', rules);
      expect(result3?.description).toBe('All Components');
    });
  });

  describe('negated glob patterns', () => {
    it('should exclude files matching negated patterns', () => {
      const rules = [
        {
          pattern: 'source-files',
          globs: ['src/**/*.ts', '!src/**/*.test.ts', '!src/**/*.spec.ts'],
          description: 'Source files excluding tests',
        },
      ];

      // Regular source files should match
      expect(findMatchingRule('src/services/UserService.ts', rules)).not.toBeNull();
      expect(findMatchingRule('src/tools/MyTool.ts', rules)).not.toBeNull();

      // Test files should NOT match (excluded by negated pattern)
      expect(findMatchingRule('src/services/UserService.test.ts', rules)).toBeNull();
      expect(findMatchingRule('src/tools/MyTool.spec.ts', rules)).toBeNull();
    });

    it('should handle multiple negated patterns', () => {
      const rules = [
        {
          pattern: 'production-code',
          globs: [
            'src/**/*.ts',
            '!src/**/*.test.ts',
            '!src/**/*.spec.ts',
            '!src/**/*.mock.ts',
            '!src/__mocks__/**',
          ],
          description: 'Production code only',
        },
      ];

      // Production files should match
      expect(findMatchingRule('src/index.ts', rules)).not.toBeNull();

      // All excluded patterns should NOT match
      expect(findMatchingRule('src/index.test.ts', rules)).toBeNull();
      expect(findMatchingRule('src/index.spec.ts', rules)).toBeNull();
      expect(findMatchingRule('src/index.mock.ts', rules)).toBeNull();
      expect(findMatchingRule('src/__mocks__/fs.ts', rules)).toBeNull();
    });

    it('should match when file matches positive but not negative patterns', () => {
      const rules = [
        {
          pattern: 'api-routes',
          globs: ['src/app/api/**/*.ts', '!src/app/api/**/*.test.ts'],
          description: 'API route handlers',
        },
      ];

      // API route files should match
      expect(findMatchingRule('src/app/api/users/route.ts', rules)).not.toBeNull();
      expect(findMatchingRule('src/app/api/posts/[id]/route.ts', rules)).not.toBeNull();

      // API test files should NOT match
      expect(findMatchingRule('src/app/api/users/route.test.ts', rules)).toBeNull();
    });

    it('should handle rules with only negated patterns', () => {
      const rules = [
        {
          pattern: 'exclude-tests',
          globs: ['!**/*.test.ts', '!**/*.spec.ts'],
          description: 'Only negated patterns',
        },
      ];

      // When only negated patterns exist and no positive patterns,
      // files that don't match any negated pattern should match
      expect(findMatchingRule('src/index.ts', rules)).not.toBeNull();
      expect(findMatchingRule('src/services/UserService.ts', rules)).not.toBeNull();

      // Files matching any negated pattern should NOT match
      expect(findMatchingRule('src/index.test.ts', rules)).toBeNull();
      expect(findMatchingRule('services/User.spec.ts', rules)).toBeNull();
    });

    it('should handle mixed positive and negative patterns correctly', () => {
      const rules = [
        {
          pattern: 'component-files',
          globs: [
            'src/components/**/*.tsx',
            'src/ui/**/*.tsx',
            '!src/**/*.stories.tsx',
            '!src/**/*.test.tsx',
          ],
          description: 'React components excluding stories and tests',
        },
      ];

      // Component files should match
      expect(findMatchingRule('src/components/Button.tsx', rules)).not.toBeNull();
      expect(findMatchingRule('src/ui/Card.tsx', rules)).not.toBeNull();

      // Story files should NOT match
      expect(findMatchingRule('src/components/Button.stories.tsx', rules)).toBeNull();
      expect(findMatchingRule('src/ui/Card.stories.tsx', rules)).toBeNull();

      // Test files should NOT match
      expect(findMatchingRule('src/components/Button.test.tsx', rules)).toBeNull();
    });

    it('should work with deeply nested paths', () => {
      const rules = [
        {
          pattern: 'deep-source',
          globs: ['src/**/*.ts', '!src/**/*.test.ts'],
          description: 'Deep source files',
        },
      ];

      // Deeply nested source files should match
      expect(
        findMatchingRule('src/features/auth/services/validation/UserValidator.ts', rules),
      ).not.toBeNull();

      // Deeply nested test files should NOT match
      expect(
        findMatchingRule('src/features/auth/services/validation/UserValidator.test.ts', rules),
      ).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should return null for empty rules array', () => {
      const result = findMatchingRule('src/index.ts', []);
      expect(result).toBeNull();
    });

    it('should handle empty file path', () => {
      const rules = [{ pattern: 'src/**/*.ts', description: 'All TS files' }];
      const result = findMatchingRule('', rules);
      expect(result).toBeNull();
    });

    it('should handle paths with dynamic route segments', () => {
      const rules = [
        {
          pattern: 'dynamic-routes',
          // Use ** to match any directory including those with brackets
          globs: ['src/app/**/*.ts'],
          description: 'Dynamic route files',
        },
      ];

      // Files in dynamic route directories should match
      const result = findMatchingRule('src/app/users/[id]/page.ts', rules);
      expect(result).not.toBeNull();
      expect(result?.description).toBe('Dynamic route files');
    });

    it('should handle paths with dots and hyphens', () => {
      const rules = [
        {
          pattern: 'config-files',
          globs: ['**/*.config.ts', '**/*-config.ts'],
          description: 'Configuration files',
        },
      ];

      expect(findMatchingRule('src/jest.config.ts', rules)).not.toBeNull();
      expect(findMatchingRule('src/app-config.ts', rules)).not.toBeNull();
    });
  });
});

/**
 * Test the rules config merging logic used by RuleFinder.mergeRulesConfigs
 * This tests combining project, template, and global rules with correct priority
 * Priority order: project -> template -> global
 */
describe('RuleFinder mergeRulesConfigs logic', () => {
  // Helper function that mirrors the logic in RuleFinder.mergeRulesConfigs
  type RulesYamlConfig = {
    version: string;
    template: string;
    description: string;
    rules: Array<{ pattern: string; globs?: string[]; description: string }>;
  };

  /**
   * Merge rules configs from project, template, and global sources.
   * Priority order: project -> template -> global (project rules come first)
   */
  const mergeRulesConfigs = (
    projectRules: RulesYamlConfig | null,
    templateRules: RulesYamlConfig | null,
    globalRules: RulesYamlConfig | null,
  ): RulesYamlConfig | null => {
    // If all are null, return null
    if (!projectRules && !templateRules && !globalRules) {
      return null;
    }

    // Find the first non-null config to use as base for metadata
    const baseConfig = projectRules || templateRules || globalRules;

    // Merge all rules in priority order: project -> template -> global
    return {
      // biome-ignore lint/style/noNonNullAssertion: value guaranteed by context
      ...baseConfig!,
      rules: [
        ...(projectRules?.rules || []),
        ...(templateRules?.rules || []),
        ...(globalRules?.rules || []),
      ],
    };
  };

  const globalRulesConfig: RulesYamlConfig = {
    version: '1.0',
    template: 'shared',
    description: 'Shared rules for all templates',
    rules: [
      { pattern: 'import-standards', globs: ['**/*.ts'], description: 'Import standards' },
      { pattern: 'export-standards', globs: ['**/*.ts'], description: 'Export standards' },
    ],
  };

  const templateRulesConfig: RulesYamlConfig = {
    version: '1.0',
    template: 'nextjs-15',
    description: 'Next.js 15 specific rules',
    rules: [
      { pattern: 'server-actions', globs: ['src/actions/**/*.ts'], description: 'Server actions' },
      {
        pattern: 'page-components',
        globs: ['src/app/**/page.tsx'],
        description: 'Page components',
      },
    ],
  };

  const projectRulesConfig: RulesYamlConfig = {
    version: '1.0',
    template: 'my-project',
    description: 'Project-specific rules',
    rules: [
      { pattern: 'custom-api', globs: ['src/api/**/*.ts'], description: 'Custom API rules' },
      {
        pattern: 'local-services',
        globs: ['src/services/**/*.ts'],
        description: 'Local service rules',
      },
    ],
  };

  describe('when all three levels of rules exist', () => {
    it('should merge all configs with project rules first, then template, then global', () => {
      const merged = mergeRulesConfigs(projectRulesConfig, templateRulesConfig, globalRulesConfig);

      expect(merged).not.toBeNull();
      expect(merged?.rules).toHaveLength(6);
      // Project rules come first (highest priority)
      expect(merged?.rules[0].pattern).toBe('custom-api');
      expect(merged?.rules[1].pattern).toBe('local-services');
      // Template rules come second
      expect(merged?.rules[2].pattern).toBe('server-actions');
      expect(merged?.rules[3].pattern).toBe('page-components');
      // Global rules come last (lowest priority)
      expect(merged?.rules[4].pattern).toBe('import-standards');
      expect(merged?.rules[5].pattern).toBe('export-standards');
    });

    it('should preserve project metadata in merged config when project rules exist', () => {
      const merged = mergeRulesConfigs(projectRulesConfig, templateRulesConfig, globalRulesConfig);

      expect(merged?.version).toBe('1.0');
      expect(merged?.template).toBe('my-project');
      expect(merged?.description).toBe('Project-specific rules');
    });
  });

  describe('when only template and global rules exist (no project rules)', () => {
    it('should merge with template rules first', () => {
      const merged = mergeRulesConfigs(null, templateRulesConfig, globalRulesConfig);

      expect(merged).not.toBeNull();
      expect(merged?.rules).toHaveLength(4);
      // Template rules come first
      expect(merged?.rules[0].pattern).toBe('server-actions');
      expect(merged?.rules[1].pattern).toBe('page-components');
      // Global rules come after
      expect(merged?.rules[2].pattern).toBe('import-standards');
      expect(merged?.rules[3].pattern).toBe('export-standards');
    });

    it('should preserve template metadata when no project rules', () => {
      const merged = mergeRulesConfigs(null, templateRulesConfig, globalRulesConfig);

      expect(merged?.version).toBe('1.0');
      expect(merged?.template).toBe('nextjs-15');
      expect(merged?.description).toBe('Next.js 15 specific rules');
    });
  });

  describe('when only project and global rules exist (no template rules)', () => {
    it('should merge with project rules first', () => {
      const merged = mergeRulesConfigs(projectRulesConfig, null, globalRulesConfig);

      expect(merged).not.toBeNull();
      expect(merged?.rules).toHaveLength(4);
      // Project rules come first
      expect(merged?.rules[0].pattern).toBe('custom-api');
      expect(merged?.rules[1].pattern).toBe('local-services');
      // Global rules come after
      expect(merged?.rules[2].pattern).toBe('import-standards');
      expect(merged?.rules[3].pattern).toBe('export-standards');
    });

    it('should preserve project metadata', () => {
      const merged = mergeRulesConfigs(projectRulesConfig, null, globalRulesConfig);

      expect(merged?.template).toBe('my-project');
    });
  });

  describe('when only project and template rules exist (no global rules)', () => {
    it('should merge with project rules first', () => {
      const merged = mergeRulesConfigs(projectRulesConfig, templateRulesConfig, null);

      expect(merged).not.toBeNull();
      expect(merged?.rules).toHaveLength(4);
      // Project rules come first
      expect(merged?.rules[0].pattern).toBe('custom-api');
      expect(merged?.rules[1].pattern).toBe('local-services');
      // Template rules come after
      expect(merged?.rules[2].pattern).toBe('server-actions');
      expect(merged?.rules[3].pattern).toBe('page-components');
    });
  });

  describe('when only one level of rules exists', () => {
    it('should return project rules when only project rules exist', () => {
      const merged = mergeRulesConfigs(projectRulesConfig, null, null);

      expect(merged).not.toBeNull();
      expect(merged?.rules).toHaveLength(2);
      expect(merged?.template).toBe('my-project');
      expect(merged?.rules[0].pattern).toBe('custom-api');
    });

    it('should return template rules when only template rules exist', () => {
      const merged = mergeRulesConfigs(null, templateRulesConfig, null);

      expect(merged).not.toBeNull();
      expect(merged?.rules).toHaveLength(2);
      expect(merged?.template).toBe('nextjs-15');
      expect(merged?.rules[0].pattern).toBe('server-actions');
    });

    it('should return global rules when only global rules exist', () => {
      const merged = mergeRulesConfigs(null, null, globalRulesConfig);

      expect(merged).not.toBeNull();
      expect(merged?.rules).toHaveLength(2);
      expect(merged?.template).toBe('shared');
      expect(merged?.rules[0].pattern).toBe('import-standards');
    });
  });

  describe('when no rules exist', () => {
    it('should return null when all are null', () => {
      const merged = mergeRulesConfigs(null, null, null);

      expect(merged).toBeNull();
    });
  });
});
