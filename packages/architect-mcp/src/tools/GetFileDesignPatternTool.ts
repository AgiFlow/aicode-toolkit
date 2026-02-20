import { log } from '@agiflowai/aicode-utils';
/**
 * GetFileDesignPatternTool
 *
 * DESIGN PATTERNS:
 * - Tool pattern with getDefinition() and execute() methods
 * - Service delegation for business logic
 * - JSON Schema validation for inputs
 *
 * CODING STANDARDS:
 * - Implement Tool interface from ../types
 * - Use TOOL_NAME constant with snake_case (e.g., 'file_read')
 * - Return CallToolResult with content array
 * - Handle errors with isError flag
 * - Delegate complex logic to services
 *
 * AVOID:
 * - Complex business logic in execute method
 * - Unhandled promise rejections
 * - Missing input validation
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type {
  Tool,
  ToolDefinition,
  FileDesignPatternResult,
  DesignPatternMatch,
} from '../types/index.js';
import { TemplateFinder } from '../services/TemplateFinder';
import { ArchitectParser } from '../services/ArchitectParser';
import { PatternMatcher } from '../services/PatternMatcher';
import { LlmProxyService, type LlmToolId, isValidLlmTool } from '@agiflowai/coding-agent-bridge';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

interface GetFileDesignPatternToolInput {
  file_path: string;
}

interface GetFileDesignPatternToolOptions {
  llmTool?: LlmToolId;
  toolConfig?: Record<string, unknown>;
}

export class GetFileDesignPatternTool implements Tool<GetFileDesignPatternToolInput> {
  static readonly TOOL_NAME = 'get-file-design-pattern';

  private templateFinder: TemplateFinder;
  private architectParser: ArchitectParser;
  private patternMatcher: PatternMatcher;
  private llmService?: LlmProxyService;

  constructor(options?: GetFileDesignPatternToolOptions) {
    this.templateFinder = new TemplateFinder();
    this.architectParser = new ArchitectParser();
    this.patternMatcher = new PatternMatcher();

    // Initialize LLM service if a valid llm_tool is specified
    if (options?.llmTool && isValidLlmTool(options.llmTool)) {
      this.llmService = new LlmProxyService({
        llmTool: options.llmTool,
        toolConfig: options?.toolConfig,
      });
    }
  }

  getDefinition(): ToolDefinition {
    return {
      name: GetFileDesignPatternTool.TOOL_NAME,
      description:
        'Review a file against template-specific and global design patterns with detailed guidance',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description:
              'The file path to check for design patterns (absolute or relative to workspace)',
          },
        },
        required: ['file_path'],
        additionalProperties: false,
      },
    };
  }

  async execute(input: GetFileDesignPatternToolInput): Promise<CallToolResult> {
    try {
      // Find the template for this file
      const templateMapping = await this.templateFinder.findTemplateForFile(input.file_path);

      // Parse architect.yaml files from project, template, and global (in parallel)
      const [projectConfig, templateConfig, globalConfig] = await Promise.all([
        templateMapping?.projectPath
          ? this.architectParser.parseProjectArchitectFile(templateMapping.projectPath)
          : Promise.resolve(null),
        templateMapping
          ? this.architectParser.parseArchitectFile(templateMapping.templatePath)
          : Promise.resolve(null),
        this.architectParser.parseGlobalArchitectFile(),
      ]);

      // Merge configs (project first = highest priority)
      const mergedConfig = this.architectParser.mergeConfigs(
        projectConfig,
        templateConfig,
        globalConfig,
      );

      // Match patterns against merged config
      const result = this.patternMatcher.matchFileToPatterns(
        input.file_path,
        mergedConfig,
        null,
        templateMapping?.projectPath,
      );

      // If LLM service is available, filter patterns based on file content
      let filteredPatterns = result.matched_patterns;
      if (this.llmService && result.matched_patterns.length > 0) {
        filteredPatterns = await this.filterPatternsWithLLM(
          input.file_path,
          result.matched_patterns,
        );
      }

      // Add additional metadata
      const enrichedResult: FileDesignPatternResult = {
        ...result,
        matched_patterns: filteredPatterns,
        project_name: templateMapping?.projectName,
        source_template: templateMapping?.sourceTemplate,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(enrichedResult, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: error instanceof Error ? error.message : 'Unknown error',
                file_path: input.file_path,
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Use LLM to filter patterns based on actual file content
   */
  private async filterPatternsWithLLM(
    filePath: string,
    patterns: DesignPatternMatch[],
  ): Promise<DesignPatternMatch[]> {
    if (!this.llmService) {
      return patterns;
    }

    try {
      // Read file content
      const normalizedPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath);
      const fileContent = await fs.readFile(normalizedPath, 'utf-8');

      // Build prompt for LLM
      const systemPrompt = `You are an expert code analyst. Your task is to analyze a code file and determine which design patterns are actually relevant to it based on the file's content, structure, and purpose.`;

      const userPrompt = `Given this code file and a list of potential design patterns, identify which patterns are ACTUALLY relevant to this specific file.

FILE PATH: ${filePath}

FILE CONTENT:
\`\`\`
${fileContent}
\`\`\`

POTENTIAL DESIGN PATTERNS:
${patterns.map((p, i) => `${i + 1}. ${p.name} - ${p.design_pattern}`).join('\n')}

Analyze the file content carefully and return ONLY the numbers (1-based index) of patterns that are truly relevant to this file, separated by commas. If none are relevant, return "none".

Example response: "1,3" or "2" or "none"

Your response (numbers only):`;

      // Pass system prompt directly to invokeAsLlm (don't write to CLAUDE.md)
      const response = await this.llmService.invokeAsLlm({
        prompt: userPrompt,
        systemPrompt,
      });

      // Parse LLM response
      const relevantIndices = this.parsePatternIndices(response.content.trim());

      if (relevantIndices.length === 0) {
        return [];
      }

      // Filter patterns based on LLM response
      return patterns.filter((_, index) => relevantIndices.includes(index + 1));
    } catch (error) {
      log.error('LLM filtering failed, returning all patterns:', error);
      // On error, return all patterns
      return patterns;
    }
  }

  /**
   * Parse LLM response to extract pattern indices
   */
  private parsePatternIndices(response: string): number[] {
    if (response.toLowerCase() === 'none') {
      return [];
    }

    const indices: number[] = [];
    const parts = response.split(',').map((s) => s.trim());

    for (const part of parts) {
      const num = parseInt(part, 10);
      if (!Number.isNaN(num) && num > 0) {
        indices.push(num);
      }
    }

    return indices;
  }
}
