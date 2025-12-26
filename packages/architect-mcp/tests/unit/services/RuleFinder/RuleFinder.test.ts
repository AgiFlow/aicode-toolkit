/**
 * RuleFinder Tests
 *
 * Tests for the RuleFinder service, focusing on glob pattern matching functionality.
 */

import { describe, it, expect } from 'vitest';
import { minimatch } from 'minimatch';

/**
 * Test the pattern matching logic used by RuleFinder.findMatchingRule
 * This tests the core matching algorithm without needing to mock the file system
 */
describe('RuleFinder pattern matching logic', () => {
  // Helper function that mirrors the logic in RuleFinder.findMatchingRule
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

      for (const pattern of patterns) {
        for (const pathVariant of pathVariations) {
          if (minimatch(pathVariant, pattern)) {
            return ruleSection;
          }
        }
      }
    }

    return null;
  };

  describe('backward compatibility with pattern field', () => {
    it('should match files using single pattern field', () => {
      const rules = [
        { pattern: 'src/app/**/page.tsx', description: 'Page component' },
      ];

      const result = findMatchingRule('src/app/users/page.tsx', rules);
      expect(result).not.toBeNull();
      expect(result?.pattern).toBe('src/app/**/page.tsx');
    });

    it('should not match files that do not fit the pattern', () => {
      const rules = [
        { pattern: 'src/app/**/page.tsx', description: 'Page component' },
      ];

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
          globs: [
            'src/actions/**/*.ts',
            'src/app/api/**/route.ts',
            'src/services/**/*.ts',
          ],
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
});
