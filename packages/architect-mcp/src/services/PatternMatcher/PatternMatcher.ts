/**
 * PatternMatcher
 *
 * DESIGN PATTERNS:
 * - Service pattern for business logic encapsulation
 * - Single responsibility principle
 * - Strategy pattern for matching algorithms
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

import { minimatch } from 'minimatch';
import * as path from 'node:path';
import type {
  DesignPatternMatch,
  FileDesignPatternResult,
  ArchitectConfig,
  Feature,
} from '../../types';
import {
  PATTERN_SOURCE,
  GLOB_DOUBLE_STAR,
  PATH_SEPARATOR,
  PARENT_DIR_PREFIX,
  MATCH_CONFIDENCE,
  DIR_PATTERNS,
  FILE_PATTERNS,
  COMMON_NAMING_PATTERNS,
  EXT_TSX,
  DEFAULT_PATTERN_NAME,
} from '../../constants';

/**
 * Service for matching files against architect design patterns.
 * Supports exact, partial, and inferred matching strategies.
 */
export class PatternMatcher {
  /**
   * Quickly find matched file patterns (includes) for a file
   * Returns the glob patterns that matched, useful for logging
   *
   * @param filePath - File path to check
   * @param templateConfig - Template-specific architect config
   * @param globalConfig - Global architect config
   * @param projectRoot - Project root path for relative path calculation
   * @returns Comma-separated string of matched file patterns
   */
  getMatchedFilePatterns(
    filePath: string,
    templateConfig: ArchitectConfig | null,
    globalConfig: ArchitectConfig | null,
    projectRoot?: string,
  ): string {
    const normalizedPath = this.normalizeFilePath(filePath, projectRoot);
    const matchedPatterns: string[] = [];

    // Check template-specific patterns first
    if (templateConfig?.features) {
      for (const feature of templateConfig.features) {
        const matched = this.getMatchingIncludes(normalizedPath, feature.includes);
        matchedPatterns.push(...matched);
      }
    }

    // Check global patterns if no template matches found
    if (matchedPatterns.length === 0 && globalConfig?.features) {
      for (const feature of globalConfig.features) {
        const matched = this.getMatchingIncludes(normalizedPath, feature.includes);
        matchedPatterns.push(...matched);
      }
    }

    return [...new Set(matchedPatterns)].join(',');
  }

  /**
   * Get includes patterns that match a file path
   */
  private getMatchingIncludes(filePath: string, includes: string[]): string[] {
    if (!includes || includes.length === 0) {
      return [];
    }

    const matched: string[] = [];
    for (const pattern of includes) {
      if (minimatch(filePath, pattern)) {
        matched.push(pattern);
      }
    }
    return matched;
  }

  /**
   * Match a file against architect patterns
   */
  matchFileToPatterns(
    filePath: string,
    templateConfig: ArchitectConfig | null,
    globalConfig: ArchitectConfig | null,
    projectRoot?: string,
  ): FileDesignPatternResult {
    const normalizedPath = this.normalizeFilePath(filePath, projectRoot);
    const matchedPatterns: DesignPatternMatch[] = [];
    const recommendations: string[] = [];

    // Match against template-specific patterns first (higher priority)
    if (templateConfig) {
      const templateMatches = this.findMatchingPatterns(
        normalizedPath,
        templateConfig.features,
        PATTERN_SOURCE.TEMPLATE,
      );
      matchedPatterns.push(...templateMatches);
    }

    // Match against global patterns if no template matches found
    if (globalConfig && matchedPatterns.length === 0) {
      const globalMatches = this.findMatchingPatterns(
        normalizedPath,
        globalConfig.features,
        PATTERN_SOURCE.GLOBAL,
      );
      matchedPatterns.push(...globalMatches);
    }

    // Generate recommendations based on matched patterns
    if (matchedPatterns.length > 0) {
      recommendations.push(...this.generateRecommendations(normalizedPath, matchedPatterns));
    } else if (!templateConfig && !globalConfig) {
      recommendations.push(
        'No design patterns configured for this project.',
        'Consider adding architect.yaml configuration.',
      );
    } else {
      recommendations.push(
        'This file does not match any defined design patterns.',
        'Consider checking if this file type should follow a specific pattern.',
      );
    }

    return {
      file_path: filePath,
      matched_patterns: matchedPatterns,
      recommendations,
    };
  }

  /**
   * Normalize file path relative to project root
   */
  private normalizeFilePath(filePath: string, projectRoot?: string): string {
    if (!projectRoot) {
      return filePath;
    }

    // Make the path relative to project root
    const relativePath = path.relative(projectRoot, filePath);

    // If the file is outside project root, return original path
    if (relativePath.startsWith(PARENT_DIR_PREFIX)) {
      return filePath;
    }

    return relativePath;
  }

  /**
   * Find patterns that match the given file path
   */
  private findMatchingPatterns(
    filePath: string,
    features: Feature[] | undefined,
    source: (typeof PATTERN_SOURCE)[keyof typeof PATTERN_SOURCE],
  ): DesignPatternMatch[] {
    const matches: DesignPatternMatch[] = [];

    if (!features) {
      return matches;
    }

    for (const feature of features) {
      const matchType = this.calculateMatchConfidence(filePath, feature.includes);

      if (matchType !== null) {
        matches.push({
          name: feature.name || feature.architecture || DEFAULT_PATTERN_NAME,
          design_pattern: feature.design_pattern,
          description: feature.description || '',
          confidence: matchType,
          source,
        });
      }
    }

    return matches;
  }

  /**
   * Calculate match confidence for a file against pattern includes
   */
  private calculateMatchConfidence(
    filePath: string,
    includes: string[],
  ): (typeof MATCH_CONFIDENCE)[keyof typeof MATCH_CONFIDENCE] | null {
    if (!includes || includes.length === 0) {
      return null;
    }

    for (const pattern of includes) {
      // Check for exact match
      if (minimatch(filePath, pattern)) {
        return MATCH_CONFIDENCE.EXACT;
      }

      // Check for partial match (same directory structure)
      // Only match if pattern uses ** glob and file is in a subdirectory
      if (pattern.includes(GLOB_DOUBLE_STAR)) {
        const patternDir = pattern.split(GLOB_DOUBLE_STAR)[0].replace(/\/$/, '');
        const fileDir = path.dirname(filePath);

        // Check if file is in the pattern's directory tree
        if (fileDir === patternDir || fileDir.startsWith(patternDir + PATH_SEPARATOR)) {
          // Extract filename pattern after **/ (e.g., "*.ts" from "src/**/*.ts")
          const globWithSeparator = GLOB_DOUBLE_STAR + PATH_SEPARATOR;
          const patternAfterGlob = pattern.split(globWithSeparator)[1] || '';
          const fileName = path.basename(filePath);

          // Check if filename matches the pattern (e.g., *.ts matches Tool.ts, but index.ts doesn't match Tool.ts)
          if (patternAfterGlob && minimatch(fileName, patternAfterGlob)) {
            return MATCH_CONFIDENCE.PARTIAL;
          }
        }
      }

      // Check for inferred match (similar naming patterns)
      const fileName = path.basename(filePath);
      const patternName = path.basename(pattern);

      if (this.isSimilarNaming(fileName, patternName)) {
        return MATCH_CONFIDENCE.INFERRED;
      }
    }

    return null;
  }

  /**
   * Check if file names follow similar patterns
   */
  private isSimilarNaming(fileName: string, patternName: string): boolean {
    // Remove extensions for comparison
    const fileBase = fileName.replace(/\.[^.]+$/, '');
    const patternBase = patternName.replace(/\.[^.]+$/, '').replace(/\*/g, '');

    // Check for common suffixes/prefixes
    for (const namingPattern of COMMON_NAMING_PATTERNS) {
      if (fileBase.includes(namingPattern) && patternBase.includes(namingPattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate recommendations based on matched patterns
   */
  private generateRecommendations(filePath: string, matches: DesignPatternMatch[]): string[] {
    const recommendations: string[] = [];
    const fileName = path.basename(filePath);
    const fileDir = path.dirname(filePath);

    // Recommendations based on file location and matches
    for (const match of matches) {
      if (match.confidence === MATCH_CONFIDENCE.EXACT) {
        // File matches pattern exactly
        recommendations.push(
          `This file follows the "${match.name}" pattern.`,
          `Ensure it adheres to the pattern guidelines described above.`,
        );
      } else if (match.confidence === MATCH_CONFIDENCE.PARTIAL) {
        // File partially matches pattern
        recommendations.push(
          `This file appears to be related to the "${match.name}" pattern.`,
          `Review the pattern guidelines to ensure consistency.`,
        );
      } else if (match.confidence === MATCH_CONFIDENCE.INFERRED) {
        // Pattern inferred from naming
        recommendations.push(
          `Based on naming, this file might follow the "${match.name}" pattern.`,
          `Consider reviewing the pattern guidelines for best practices.`,
        );
      }
    }

    // Additional specific recommendations
    if (fileDir.includes(DIR_PATTERNS.ROUTES) && !fileName.includes(FILE_PATTERNS.TEST)) {
      recommendations.push('Consider implementing proper error handling and validation.');
    }

    if (fileDir.includes(DIR_PATTERNS.SERVICES)) {
      recommendations.push('Ensure business logic is properly encapsulated and testable.');
    }

    if (fileDir.includes(DIR_PATTERNS.COMPONENTS) && fileName.endsWith(EXT_TSX)) {
      recommendations.push('Remember to handle loading and error states appropriately.');
    }

    if (fileName.includes(FILE_PATTERNS.HOOK) || fileName.startsWith(FILE_PATTERNS.USE_PREFIX)) {
      recommendations.push('Follow React hooks rules and naming conventions.');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }
}
