import { log } from '@agiflowai/aicode-utils';
import {
  LlmProxyService,
  type LlmToolId,
  isValidLlmTool,
  SUPPORTED_LLM_TOOLS,
} from '@agiflowai/coding-agent-bridge';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { execa } from 'execa';
import { RuleFinder } from './RuleFinder.js';
import type { CodeReviewResult, RuleSection, RulesYamlConfig } from '../types';

interface CodeReviewServiceOptions {
  llmTool?: LlmToolId;
  toolConfig?: Record<string, unknown>;
}

export class CodeReviewService {
  private llmService?: LlmProxyService;
  private ruleFinder: RuleFinder;
  private llmTool?: LlmToolId;

  constructor(options?: CodeReviewServiceOptions) {
    this.llmTool = options?.llmTool;

    // Initialize LLM service if a valid llmTool is specified
    if (this.llmTool && isValidLlmTool(this.llmTool)) {
      this.llmService = new LlmProxyService({
        llmTool: this.llmTool,
        defaultTimeout: 180000, // 3 minutes for code review
        toolConfig: options?.toolConfig,
      });
    }
    this.ruleFinder = new RuleFinder();
  }

  /**
   * Review a code file against template-specific rules
   */
  async reviewCodeChange(filePath: string): Promise<CodeReviewResult> {
    // Find rules for this file
    const { project, rulesConfig, matchedRule, templatePath } =
      await this.ruleFinder.findRulesForFile(filePath);

    if (!project) {
      return {
        file_path: filePath,
        feedback: 'No project found for this file. Cannot determine coding standards.',
        fix_required: false,
        identified_issues: [],
      };
    }

    if (!rulesConfig || !templatePath) {
      return {
        file_path: filePath,
        project_name: project.name,
        source_template: project.sourceTemplate,
        feedback: 'No RULES.yaml found for this template. Generic code review applied.',
        fix_required: false,
        identified_issues: [],
      };
    }

    if (!matchedRule) {
      return {
        file_path: filePath,
        project_name: project.name,
        source_template: project.sourceTemplate,
        feedback: 'No specific rules found for this file pattern.',
        fix_required: false,
        identified_issues: [],
      };
    }

    // If no LLM service is configured, return rules for agent to review
    if (!this.llmService) {
      return {
        file_path: filePath,
        project_name: project.name,
        source_template: project.sourceTemplate,
        feedback: `Rules provided for agent review. LLM-based review not enabled. Supported tools: ${SUPPORTED_LLM_TOOLS.join(', ')}`,
        fix_required: false,
        identified_issues: [],
        rules: matchedRule, // Include the rules for the agent to use
      };
    }

    // Normalize path
    const normalizedPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);

    // Get file content with diff annotations
    const fileWithDiff = await this.getFileWithDiff(normalizedPath);

    // Perform the code review using Claude
    const reviewResult = await this.performCodeReview(
      fileWithDiff,
      normalizedPath,
      matchedRule,
      rulesConfig,
    );

    return {
      file_path: filePath,
      project_name: project.name,
      source_template: project.sourceTemplate,
      ...reviewResult,
    };
  }

  /**
   * Get the JSON schema for code review responses
   */
  private getResponseSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        feedback: {
          type: 'string',
          description: 'Short feedback about the code quality and compliance with rules (TEXT only)',
        },
        identified_issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['must_do', 'should_do', 'must_not_do'],
                description: 'Type of rule violation',
              },
              rule: {
                type: 'string',
                description: 'The specific rule that was violated or not followed',
              },
              violation: {
                type: 'string',
                description: "Description of how the code violates or doesn't follow the rule",
              },
              suggestion: {
                type: 'string',
                description: 'Suggestion for improvement',
              },
            },
            required: ['type', 'rule', 'violation', 'suggestion'],
            additionalProperties: false,
          },
        },
      },
      required: ['feedback', 'identified_issues'],
      additionalProperties: false,
    };
  }

  /**
   * Perform code review using configured LLM service
   */
  private async performCodeReview(
    fileContent: string,
    filePath: string,
    rules: RuleSection,
    rulesConfig: RulesYamlConfig,
  ): Promise<Pick<CodeReviewResult, 'feedback' | 'fix_required' | 'identified_issues'>> {
    if (!this.llmService) {
      throw new Error(
        `LLM service not initialized. Use llmTool with one of: ${SUPPORTED_LLM_TOOLS.join(', ')}`,
      );
    }

    // Build the review prompt
    const jsonSchema = this.getResponseSchema();
    const systemPrompt = this.buildSystemPrompt(rulesConfig, jsonSchema);
    const userPrompt = this.buildUserPrompt(fileContent, filePath, rules);

    try {
      const response = await this.llmService.invokeAsLlm({
        prompt: userPrompt,
        systemPrompt,
        maxTokens: 4000,
        jsonSchema, // Pass schema for native enforcement (Claude, Codex)
      });

      // Parse the response
      return this.parseReviewResponse(response.content);
    } catch (error) {
      log.error('Code review failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        feedback: `Code review failed: ${errorMessage}`,
        fix_required: false,
        identified_issues: [],
      };
    }
  }

  /**
   * Build system prompt for code review
   */
  private buildSystemPrompt(rulesConfig: RulesYamlConfig, jsonSchema: Record<string, unknown>): string {
    return `You are a code reviewer for a ${rulesConfig.template} template project.

${rulesConfig.description}

Your task is to review code changes against specific rules and provide actionable feedback.

Issue types:
- must_not_do: Critical violations that must be fixed (will cause bugs or serious issues)
- must_do: Required patterns that are missing
- should_do: Suggestions for improvement (best practices)

You must respond with valid JSON that follows this exact JSON Schema:
${JSON.stringify(jsonSchema, null, 2)}

Be constructive and specific in your feedback. Focus on actual issues rather than preferences.`;
  }

  /**
   * Build user prompt for code review
   */
  private buildUserPrompt(fileContent: string, filePath: string, rules: RuleSection): string {
    let prompt = `Review the following code file against the specified rules:

File: ${filePath}
Pattern: ${rules.pattern}
Description: ${rules.description}

RULES TO CHECK:
`;

    if (rules.must_do && rules.must_do.length > 0) {
      prompt += '\nMUST DO (Required):';
      for (const rule of rules.must_do) {
        prompt += `\n- ${rule.rule}`;
        if (rule.example) {
          prompt += ` (Example: ${rule.example})`;
        }
        if (rule.codeExample) {
          prompt += `\n  Code Example:\n${rule.codeExample}`;
        }
      }
    }

    if (rules.should_do && rules.should_do.length > 0) {
      prompt += '\n\nSHOULD DO (Recommended):';
      for (const rule of rules.should_do) {
        prompt += `\n- ${rule.rule}`;
        if (rule.example) {
          prompt += ` (Example: ${rule.example})`;
        }
        if (rule.codeExample) {
          prompt += `\n  Code Example:\n${rule.codeExample}`;
        }
      }
    }

    if (rules.must_not_do && rules.must_not_do.length > 0) {
      prompt += '\n\nMUST NOT DO (Prohibited):';
      for (const rule of rules.must_not_do) {
        prompt += `\n- ${rule.rule}`;
        if (rule.example) {
          prompt += ` (Example: ${rule.example})`;
        }
        if (rule.codeExample) {
          prompt += `\n  Code Example:\n${rule.codeExample}`;
        }
      }
    }

    prompt += `\n\nCODE TO REVIEW:
\`\`\`${this.getFileExtension(filePath)}
${fileContent}
\`\`\`

Provide your review in the specified JSON format.`;

    return prompt;
  }

  /**
   * Get file extension for syntax highlighting
   */
  private getFileExtension(filePath: string): string {
    const ext = path.extname(filePath).slice(1);
    const extensionMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      yaml: 'yaml',
      yml: 'yaml',
      json: 'json',
      md: 'markdown',
    };
    return extensionMap[ext] || ext;
  }

  /**
   * Get file content with inline diff annotations showing what changed
   */
  private async getFileWithDiff(filePath: string): Promise<string> {
    const dir = path.dirname(filePath);

    // Read current file content
    let currentContent: string;
    try {
      currentContent = await fs.readFile(filePath, 'utf-8');
    } catch (_error) {
      throw new Error(`Failed to read file: ${filePath}`);
    }

    try {
      // Get unified diff (staged + unstaged)
      const { stdout: unstagedDiff } = await execa('git', ['diff', '--', filePath], { cwd: dir });
      const { stdout: stagedDiff } = await execa('git', ['diff', '--cached', '--', filePath], {
        cwd: dir,
      });

      const diff = [stagedDiff, unstagedDiff].filter(Boolean).join('\n').trim();

      if (!diff) {
        // No changes, return current content as-is
        return currentContent;
      }

      // Return file with diff context - show diff first, then full file
      return `=== CHANGES (diff) ===
${diff}

=== CURRENT FILE ===
${currentContent}`;
    } catch (_error) {
      // Not a git repo, return current content
      return currentContent;
    }
  }

  /**
   * Compute fix_required from identified_issues
   * Returns true if must_do or must_not_do violations exist, false otherwise
   */
  private computeFixRequired(issues: Array<{ type: string }>): boolean {
    return issues.some((i) => i.type === 'must_do' || i.type === 'must_not_do');
  }

  /**
   * Parse the review response from LLM (supports Claude, Gemini, and other formats)
   */
  private parseReviewResponse(
    content: string,
  ): Pick<CodeReviewResult, 'feedback' | 'fix_required' | 'identified_issues'> {
    try {
      // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
      let cleanedContent = content.trim();
      const codeBlockMatch = cleanedContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        cleanedContent = codeBlockMatch[1].trim();
      }

      // Try to extract JSON from the response
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Standard format: { feedback, identified_issues }
        if (parsed.feedback && Array.isArray(parsed.identified_issues)) {
          return {
            feedback: parsed.feedback,
            fix_required: this.computeFixRequired(parsed.identified_issues),
            identified_issues: parsed.identified_issues,
          };
        }

        // Alternative format from some LLMs: { reviews: [...] }
        if (Array.isArray(parsed.reviews)) {
          const issues = parsed.reviews.map(
            (review: Record<string, unknown>) => {
              // Handle various field names from different LLMs
              const ruleField = review.rule || review.rule_id || review.ruleId;
              const descField = review.description || review.comment || review.content || review.message || review.suggestion;
              const locField = review.location || review.line_number || review.lineNumber || review.line;

              return {
                type: this.normalizeIssueType(review.type as string),
                rule: (ruleField as string) || this.extractRuleFromContent(descField as string),
                violation: [descField, locField ? `Line ${locField}` : null]
                  .filter(Boolean)
                  .join('. '),
              };
            },
          );

          return {
            feedback: this.generateFeedbackFromIssues(issues),
            fix_required: this.computeFixRequired(issues),
            identified_issues: issues,
          };
        }

        // Codex format: { status, issues: [...] }
        if (parsed.issues && Array.isArray(parsed.issues)) {
          const issues = parsed.issues.map(
            (issue: Record<string, unknown>) => {
              const ruleField = issue.rule || issue.rule_id;
              const descField = issue.details || issue.description || issue.message || issue.comment;
              const locField = issue.location || issue.line || issue.line_number;
              const severityField = issue.severity;

              // Map Codex severity (error/warning) to our type
              let issueType = 'should_do';
              if (severityField === 'error') issueType = 'must_not_do';
              else if (severityField === 'warning') issueType = 'must_do';

              return {
                type: issueType,
                rule: (ruleField as string) || this.extractRuleFromContent(descField as string),
                violation: [descField, locField ? `Location: ${locField}` : null]
                  .filter(Boolean)
                  .join('. '),
              };
            },
          );

          return {
            feedback: this.generateFeedbackFromIssues(issues),
            fix_required: this.computeFixRequired(issues),
            identified_issues: issues,
          };
        }

        // Alternative format: { review: { comments: [...] } }
        if (parsed.review && Array.isArray(parsed.review.comments)) {
          const issues = parsed.review.comments.map(
            (comment: Record<string, unknown>) => {
              // Handle various field names
              const ruleField = comment.rule || comment.rule_id || comment.ruleId;
              const descField = comment.content || comment.comment || comment.description || comment.message;
              const locField = comment.line || comment.line_number || comment.lineNumber;

              return {
                type: this.normalizeIssueType((ruleField || comment.type) as string),
                rule: (ruleField as string) || this.extractRuleFromContent(descField as string),
                violation: [descField, locField ? `Line ${locField}` : null]
                  .filter(Boolean)
                  .join('. '),
              };
            },
          );

          return {
            feedback: this.generateFeedbackFromIssues(issues),
            fix_required: this.computeFixRequired(issues),
            identified_issues: issues,
          };
        }
      }
    } catch (error) {
      log.error('Failed to parse review response:', error);
    }

    // Fallback if parsing fails
    return {
      feedback: content,
      fix_required: false,
      identified_issues: [],
    };
  }

  /**
   * Normalize issue type from various LLM response formats
   */
  private normalizeIssueType(type?: string): 'must_do' | 'should_do' | 'must_not_do' {
    if (!type) return 'should_do';
    const normalized = type.toLowerCase().replace(/\s+/g, '_');
    if (normalized.includes('must_not') || normalized.includes('mustnot')) return 'must_not_do';
    if (normalized.includes('must')) return 'must_do';
    if (normalized.includes('should')) return 'should_do';
    return 'should_do';
  }

  /**
   * Extract a rule name from content when rule field is missing
   */
  private extractRuleFromContent(content?: string): string {
    if (!content) return 'Code review issue';

    // Try to extract a concise rule from the content
    // Look for common patterns like "Avoid...", "Use...", "Add...", "Don't..."
    const patterns = [
      /^(Avoid\s+[^.]+)/i,
      /^(Use\s+[^.]+)/i,
      /^(Add\s+[^.]+)/i,
      /^(Don't\s+[^.]+)/i,
      /^(Do not\s+[^.]+)/i,
      /^(Never\s+[^.]+)/i,
      /^(Always\s+[^.]+)/i,
      /^(Prefer\s+[^.]+)/i,
      /^(Consider\s+[^.]+)/i,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        // Truncate to reasonable length
        const rule = match[1].trim();
        return rule.length > 80 ? `${rule.substring(0, 77)}...` : rule;
      }
    }

    // Fallback: use first sentence, truncated
    const firstSentence = content.split(/[.!?]/)[0].trim();
    if (firstSentence.length > 80) {
      return `${firstSentence.substring(0, 77)}...`;
    }
    return firstSentence || 'Code review issue';
  }

  /**
   * Generate feedback text from issues array
   */
  private generateFeedbackFromIssues(issues: Array<{ type: string; rule: string; violation?: string }>): string {
    if (issues.length === 0) return 'No issues found.';

    const grouped = {
      must_not_do: issues.filter(i => i.type === 'must_not_do'),
      must_do: issues.filter(i => i.type === 'must_do'),
      should_do: issues.filter(i => i.type === 'should_do'),
    };

    const parts: string[] = [];

    if (grouped.must_not_do.length > 0) {
      parts.push(`Found ${grouped.must_not_do.length} "Must Not Do" violation(s) that need immediate attention.`);
    }
    if (grouped.must_do.length > 0) {
      parts.push(`Found ${grouped.must_do.length} "Must Do" requirement(s) that are missing.`);
    }
    if (grouped.should_do.length > 0) {
      parts.push(`Found ${grouped.should_do.length} "Should Do" suggestion(s) for improvement.`);
    }

    return parts.join(' ');
  }
}
