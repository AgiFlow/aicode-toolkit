/**
 * Shared TypeScript Types
 *
 * DESIGN PATTERNS:
 * - Type-first development
 * - Interface segregation
 *
 * CODING STANDARDS:
 * - Export all shared types from this file
 * - Use descriptive names for types and interfaces
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Tool definition for MCP
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

/**
 * Base tool interface following MCP SDK patterns
 */
export interface Tool<TInput = any> {
  getDefinition(): ToolDefinition;
  execute(input: TInput): Promise<CallToolResult>;
}

// ============================================================================
// Architect-specific Types (Zod-inferred)
// ============================================================================

/**
 * Template architect configuration types
 * Re-exported from Zod schemas for type safety
 */
export type { Feature, ArchitectConfig } from '../schemas';

/**
 * Design pattern matching types
 */
export interface DesignPatternMatch {
  name: string;
  design_pattern: string;
  description: string;
  confidence: 'exact' | 'partial' | 'inferred';
  source: 'template' | 'global';
}

export interface FileDesignPatternResult {
  file_path: string;
  project_name?: string;
  source_template?: string;
  matched_patterns: DesignPatternMatch[];
  recommendations?: string[];
}

/**
 * Project configuration types
 */
export interface ProjectConfig {
  name: string;
  root: string;
  sourceTemplate?: string;
  projectType?: string;
}

/**
 * Service types
 */
export interface TemplateMapping {
  projectPath: string;
  templatePath: string;
  projectName: string;
  sourceTemplate?: string;
}

/**
 * Pattern matching types
 */
export interface Pattern {
  name: string;
  design_pattern: string;
  description: string;
  source: 'template' | 'global';
  confidence: 'high' | 'medium' | 'low';
  includes?: string[];
}

export interface MatchResult {
  matched_patterns: Pattern[];
  recommendations: string[];
}

/**
 * Code review types
 */
export interface RuleItem {
  rule: string;
  example?: string;
  codeExample?: string;
}

export interface RuleSection {
  pattern: string;
  description: string;
  inherits?: string[];
  must_do?: RuleItem[];
  should_do?: RuleItem[];
  must_not_do?: RuleItem[];
}

export interface RulesYamlConfig {
  version: string;
  template: string;
  description: string;
  source_template_ref?: string;
  rules: RuleSection[];
  documentation_refs?: string[];
  integration_notes?: string[];
}

export interface CodeReviewResult {
  file_path: string;
  project_name?: string;
  source_template?: string;
  matched_rules?: RuleSection;
  feedback: string;
  fix_required: boolean;
  identified_issues: Array<{
    type: 'must_do' | 'should_do' | 'must_not_do';
    rule: string;
    violation?: string;
  }>;
  rules?: RuleSection; // Rules for agent to review by itself (when llmTool is not 'claude-code')
}
