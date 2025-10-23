import { log } from '@agiflowai/aicode-utils';
import { ClaudeCodeService } from '@agiflowai/coding-agent-bridge';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { RuleFinder } from './RuleFinder.js';
import type { CodeReviewResult, RuleSection, RulesYamlConfig } from '../types';

interface CodeReviewServiceOptions {
  llmTool?: string;
}

export class CodeReviewService {
  private claudeService?: ClaudeCodeService;
  private ruleFinder: RuleFinder;
  private llmTool?: string;

  constructor(options?: CodeReviewServiceOptions) {
    this.llmTool = options?.llmTool;

    // Only initialize Claude service if llmTool is 'claude-code'
    if (this.llmTool === 'claude-code') {
      this.claudeService = new ClaudeCodeService({
        defaultTimeout: 120000, // 2 minutes for code review
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
        review_feedback: 'No project found for this file. Cannot determine coding standards.',
        severity: 'LOW',
        issues_found: [],
      };
    }

    if (!rulesConfig || !templatePath) {
      return {
        file_path: filePath,
        project_name: project.name,
        source_template: project.sourceTemplate,
        review_feedback: 'No RULES.yaml found for this template. Generic code review applied.',
        severity: 'LOW',
        issues_found: [],
      };
    }

    if (!matchedRule) {
      return {
        file_path: filePath,
        project_name: project.name,
        source_template: project.sourceTemplate,
        review_feedback: 'No specific rules found for this file pattern.',
        severity: 'LOW',
        issues_found: [],
      };
    }

    // If llmTool is not 'claude-code', return rules for agent to review
    if (this.llmTool !== 'claude-code') {
      return {
        file_path: filePath,
        project_name: project.name,
        source_template: project.sourceTemplate,
        review_feedback: 'Rules provided for agent review. LLM-based review not enabled.',
        severity: 'LOW',
        issues_found: [],
        rules: matchedRule, // Include the rules for the agent to use
      };
    }

    // Read the file content
    const normalizedPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    let fileContent: string;
    try {
      fileContent = await fs.readFile(normalizedPath, 'utf-8');
    } catch (_error) {
      throw new Error(`Failed to read file: ${normalizedPath}`);
    }

    // Perform the code review using Claude
    const reviewResult = await this.performCodeReview(
      fileContent,
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
   * Perform code review using Claude
   */
  private async performCodeReview(
    fileContent: string,
    filePath: string,
    rules: RuleSection,
    rulesConfig: RulesYamlConfig,
  ): Promise<Pick<CodeReviewResult, 'review_feedback' | 'severity' | 'issues_found'>> {
    if (!this.claudeService) {
      throw new Error(
        'Claude service not initialized. Use llmTool="claude-code" to enable LLM-based review.',
      );
    }

    // Build the review prompt
    const systemPrompt = this.buildSystemPrompt(rulesConfig);
    const userPrompt = this.buildUserPrompt(fileContent, filePath, rules);

    try {
      // Pass system prompt directly to invokeAsLlm (don't write to CLAUDE.md)
      const response = await this.claudeService.invokeAsLlm({
        prompt: userPrompt,
        systemPrompt,
        maxTokens: 4000,
      });

      // Parse the response
      return this.parseReviewResponse(response.content);
    } catch (error) {
      log.error('Code review failed:', error);
      return {
        review_feedback: 'Code review failed due to an error.',
        severity: 'LOW',
        issues_found: [],
      };
    }
  }

  /**
   * Build system prompt for code review
   */
  private buildSystemPrompt(rulesConfig: RulesYamlConfig): string {
    const responseSchema = {
      type: 'object',
      properties: {
        review_feedback: {
          type: 'string',
          description: 'Detailed feedback about the code quality and compliance with rules',
        },
        severity: {
          type: 'string',
          enum: ['LOW', 'MEDIUM', 'HIGH'],
          description: 'Severity level of the issues found',
        },
        issues_found: {
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
            },
            required: ['type', 'rule'],
            additionalProperties: false,
          },
        },
      },
      required: ['review_feedback', 'severity', 'issues_found'],
      additionalProperties: false,
    };

    return `You are a code reviewer for a ${rulesConfig.template} template project.

${rulesConfig.description}

Your task is to review code changes against specific rules and provide actionable feedback.

You must respond with valid JSON that follows this exact schema:
${JSON.stringify(responseSchema, null, 2)}

Severity levels:
- HIGH: Critical violations that will cause bugs or serious issues
- MEDIUM: Violations of important should_do rules or minor must_do violations
- LOW: Minor style or convention issues that don't affect functionality

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
   * Parse the review response from Claude
   */
  private parseReviewResponse(
    content: string,
  ): Pick<CodeReviewResult, 'review_feedback' | 'severity' | 'issues_found'> {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Validate the response structure
        if (parsed.review_feedback && parsed.severity && Array.isArray(parsed.issues_found)) {
          return {
            review_feedback: parsed.review_feedback,
            severity: parsed.severity as 'LOW' | 'MEDIUM' | 'HIGH',
            issues_found: parsed.issues_found,
          };
        }
      }
    } catch (error) {
      log.error('Failed to parse review response:', error);
    }

    // Fallback if parsing fails
    return {
      review_feedback: content,
      severity: 'MEDIUM',
      issues_found: [],
    };
  }
}
