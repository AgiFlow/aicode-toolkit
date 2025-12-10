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
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

/**
 * Base tool interface following MCP SDK patterns
 */
export interface Tool<TInput = unknown> {
  getDefinition(): ToolDefinition;
  execute(input: TInput): Promise<CallToolResult>;
}

// ============================================================================
// Architect-specific Types
// ============================================================================

/**
 * Template architect configuration types
 */
export interface Feature {
  name?: string;
  architecture?: string;
  design_pattern: string;
  includes: string[];
  description?: string;
}

/**
 * Template architect configuration.
 * Note: Index signature allows for additional custom configuration properties
 * that may vary between different architect implementations.
 */
export interface ArchitectConfig {
  features?: Feature[];
  [key: string]: unknown;
}

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
 * Mapping between a project and its source template.
 */
export interface TemplateMapping {
  projectPath: string;
  templatePath: string;
  projectName: string;
  sourceTemplate?: string;
}

/**
 * Pattern definition for matching files against design patterns.
 */
export interface Pattern {
  name: string;
  design_pattern: string;
  description: string;
  source: 'template' | 'global';
  confidence: 'high' | 'medium' | 'low';
  includes?: string[];
}

/**
 * Result of pattern matching operation containing matched patterns and recommendations.
 */
export interface MatchResult {
  matched_patterns: Pattern[];
  recommendations: string[];
}

/**
 * Represents a single rule item with optional code examples.
 */
export interface RuleItem {
  /** The rule text or description */
  rule: string;
  /** Optional text example */
  example?: string;
  /** Optional code snippet demonstrating the rule */
  codeExample?: string;
}

/**
 * Groups rules by pattern for code review.
 */
export interface RuleSection {
  /** Glob pattern to match files */
  pattern: string;
  /** Description of this rule section */
  description: string;
  /** List of rule sections to inherit from */
  inherits?: string[];
  /** Rules that must be followed */
  must_do?: RuleItem[];
  /** Rules that should be followed */
  should_do?: RuleItem[];
  /** Rules that must not be violated */
  must_not_do?: RuleItem[];
}

/**
 * Complete RULES.yaml configuration structure.
 */
export interface RulesYamlConfig {
  version: string;
  template: string;
  description: string;
  source_template_ref?: string;
  rules: RuleSection[];
  documentation_refs?: string[];
  integration_notes?: string[];
  /** Optional architecture definition for layer-aware code review */
  architecture?: ArchitectureDefinition;
}

/**
 * Result of a code review operation.
 */
export interface CodeReviewResult {
  /** Path to the reviewed file */
  file_path: string;
  /** Name of the project (optional) */
  project_name?: string;
  /** Source template used by the project */
  source_template?: string;
  /** Rules that matched the file pattern */
  matched_rules?: RuleSection;
  /** Review feedback text */
  feedback: string;
  /** Whether fixes are required */
  fix_required: boolean;
  /** List of identified issues */
  identified_issues: Array<{
    type: 'must_do' | 'should_do' | 'must_not_do';
    rule: string;
    violation?: string;
  }>;
  /** Rules for agent self-review (when llmTool is not 'claude-code') */
  rules?: RuleSection;
}

// ============================================================================
// Architecture Definition Types
// ============================================================================

/**
 * Defines a layer in the system architecture with its boundaries and import rules.
 */
export interface LayerDefinition {
  /** Unique name for the layer (e.g., 'presentation', 'domain', 'infrastructure') */
  name: string;
  /** Glob patterns that match files belonging to this layer */
  contains: string[];
  /** Description of the layer's responsibility */
  responsibility: string;
  /** List of layer names this layer can import from (whitelist) */
  allowed_imports?: string[];
  /** List of layer names this layer must NOT import from (blocklist, takes precedence) */
  forbidden_imports?: string[];
}

/**
 * Defines architectural contracts/constraints.
 */
export interface ContractDefinition {
  /** Type of contract (e.g., 'dependency_rule', 'naming_convention') */
  type: string;
  /** The rule or constraint description */
  rule: string;
}

/**
 * Top-level architecture definition for a project.
 */
export interface ArchitectureDefinition {
  /** Architecture style (e.g., 'layered', 'hexagonal', 'clean') */
  style: string;
  /** Description of the architecture approach */
  description: string;
  /** List of architectural layers in the system */
  layers: LayerDefinition[];
  /** Optional list of architectural contracts */
  contracts?: ContractDefinition[];
}
