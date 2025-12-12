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
        'template',
      );
      matchedPatterns.push(...templateMatches);
    }

    // Match against global patterns if no template matches found
    if (globalConfig && matchedPatterns.length === 0) {
      const globalMatches = this.findMatchingPatterns(
        normalizedPath,
        globalConfig.features,
        'global',
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
    if (relativePath.startsWith('..')) {
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
    source: 'template' | 'global',
  ): DesignPatternMatch[] {
    const matches: DesignPatternMatch[] = [];

    if (!features) {
      return matches;
    }

    for (const feature of features) {
      const matchType = this.calculateMatchConfidence(filePath, feature.includes);

      if (matchType !== null) {
        // Map internal confidence to API confidence levels
        let confidence: 'exact' | 'partial' | 'inferred';

        if (source === 'template') {
          // Template matches have higher confidence
          confidence =
            matchType === 'exact' ? 'exact' : matchType === 'partial' ? 'partial' : 'inferred';
        } else {
          // Global matches have lower confidence
          confidence =
            matchType === 'exact' ? 'exact' : matchType === 'partial' ? 'partial' : 'inferred';
        }

        matches.push({
          name: feature.name || feature.architecture || 'unnamed pattern',
          design_pattern: feature.design_pattern,
          description: feature.description || '',
          confidence,
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
  ): 'exact' | 'partial' | 'inferred' | null {
    if (!includes || includes.length === 0) {
      return null;
    }

    for (const pattern of includes) {
      // Check for exact match
      if (minimatch(filePath, pattern)) {
        return 'exact';
      }

      // Check for partial match (same directory structure)
      const fileDir = path.dirname(filePath);
      const patternDir = path.dirname(pattern);

      if (fileDir === patternDir || fileDir.includes(patternDir)) {
        // Check file extension match
        const fileExt = path.extname(filePath);
        const patternExt = path.extname(pattern);

        if (fileExt === patternExt || pattern.includes('**')) {
          return 'partial';
        }
      }

      // Check for inferred match (similar naming patterns)
      const fileName = path.basename(filePath);
      const patternName = path.basename(pattern);

      if (this.isSimilarNaming(fileName, patternName)) {
        return 'inferred';
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
    const commonPatterns = [
      'Controller',
      'Service',
      'Repository',
      'Component',
      'Hook',
      'Route',
      'Model',
      'Schema',
      'Validator',
      'Middleware',
      'Agent',
    ];

    for (const pattern of commonPatterns) {
      if (fileBase.includes(pattern) && patternBase.includes(pattern)) {
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
      if (match.confidence === 'exact') {
        // File matches pattern exactly
        recommendations.push(
          `This file follows the "${match.name}" pattern.`,
          `Ensure it adheres to the pattern guidelines described above.`,
        );
      } else if (match.confidence === 'partial') {
        // File partially matches pattern
        recommendations.push(
          `This file appears to be related to the "${match.name}" pattern.`,
          `Review the pattern guidelines to ensure consistency.`,
        );
      } else if (match.confidence === 'inferred') {
        // Pattern inferred from naming
        recommendations.push(
          `Based on naming, this file might follow the "${match.name}" pattern.`,
          `Consider reviewing the pattern guidelines for best practices.`,
        );
      }
    }

    // Additional specific recommendations
    if (fileDir.includes('routes') && !fileName.includes('test')) {
      recommendations.push('Consider implementing proper error handling and validation.');
    }

    if (fileDir.includes('services')) {
      recommendations.push('Ensure business logic is properly encapsulated and testable.');
    }

    if (fileDir.includes('components') && fileName.endsWith('.tsx')) {
      recommendations.push('Remember to handle loading and error states appropriately.');
    }

    if (fileName.includes('hook') || fileName.startsWith('use')) {
      recommendations.push('Follow React hooks rules and naming conventions.');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }
}
