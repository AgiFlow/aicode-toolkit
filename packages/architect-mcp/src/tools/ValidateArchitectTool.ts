/**
 * ValidateArchitectTool
 *
 * DESIGN PATTERNS:
 * - Tool pattern with getDefinition() and execute() methods
 * - Service delegation for validation logic
 * - JSON Schema validation for inputs
 *
 * CODING STANDARDS:
 * - Implement Tool interface from ../types
 * - Use TOOL_NAME constant with kebab-case
 * - Return CallToolResult with content array
 * - Handle errors with isError flag
 * - Provide instructive error messages for AI to fix issues
 *
 * AVOID:
 * - Complex business logic in execute method
 * - Unhandled promise rejections
 * - Missing input validation
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Tool, ToolDefinition } from '../types';
import { ArchitectParser } from '../services/ArchitectParser';
import { TemplatesManagerService } from '@agiflowai/aicode-utils';
import { ParseArchitectError, InvalidConfigError } from '../utils/errors';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ARCHITECT_FILENAMES, PARENT_DIR_PREFIX } from '../constants';

interface ValidateArchitectToolInput {
  file_path?: string;
  template_name?: string;
}

interface ValidationError {
  type: 'yaml_syntax' | 'schema_validation' | 'file_not_found' | 'missing_input';
  message: string;
  details?: string;
  location?: string;
  fix_suggestion: string;
}

interface ValidationSuccess {
  valid: true;
  file_path: string;
  features_count: number;
  features: Array<{
    name?: string;
    design_pattern: string;
    includes_count: number;
  }>;
}

interface ValidationFailure {
  valid: false;
  file_path?: string;
  errors: ValidationError[];
}

type ValidationResult = ValidationSuccess | ValidationFailure;

export class ValidateArchitectTool implements Tool<ValidateArchitectToolInput> {
  static readonly TOOL_NAME = 'validate-architect';

  private architectParser: ArchitectParser;

  constructor() {
    this.architectParser = new ArchitectParser();
  }

  /**
   * Returns the tool definition including name, description and input schema
   * @returns ToolDefinition object for MCP registration
   */
  getDefinition(): ToolDefinition {
    return {
      name: ValidateArchitectTool.TOOL_NAME,
      description:
        'Validate an architect.yaml file for syntax and schema errors. Returns detailed, actionable error messages to help fix issues. Provide either file_path OR template_name.',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description:
              'Direct path to the architect.yaml file (e.g., "templates/nextjs-15/architect.yaml" or absolute path)',
          },
          template_name: {
            type: 'string',
            description:
              'Template name to validate its architect.yaml (e.g., "nextjs-15", "typescript-mcp-package")',
          },
        },
        additionalProperties: false,
      },
    };
  }

  /**
   * Execute the validation tool with the provided input
   * @param input - Tool input containing file_path or template_name
   * @returns CallToolResult with validation results or errors
   */
  async execute(input: ValidateArchitectToolInput): Promise<CallToolResult> {
    const result = await this.validate(input);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError: !result.valid,
    };
  }

  private async validate(input: ValidateArchitectToolInput): Promise<ValidationResult> {
    // Resolve file path
    const resolvedPath = await this.resolveFilePath(input);

    if (!resolvedPath.success) {
      return {
        valid: false,
        errors: [resolvedPath.error],
      };
    }

    const filePath = resolvedPath.path;

    // Check file exists
    try {
      await fs.access(filePath);
    } catch {
      return {
        valid: false,
        file_path: filePath,
        errors: [
          {
            type: 'file_not_found',
            message: `File not found: ${filePath}`,
            fix_suggestion: `Create the file at "${filePath}" with the following structure:\n\nfeatures:\n  - name: example-pattern\n    design_pattern: Example Pattern\n    includes:\n      - "src/**/*.ts"\n    description: |\n      Pattern description here.`,
          },
        ],
      };
    }

    // Parse and validate
    try {
      const config = await this.architectParser.parseArchitectFile(filePath);

      if (!config) {
        return {
          valid: false,
          file_path: filePath,
          errors: [
            {
              type: 'file_not_found',
              message: 'Failed to parse architect file',
              fix_suggestion: 'Ensure the file exists and contains valid YAML.',
            },
          ],
        };
      }

      // Success
      return {
        valid: true,
        file_path: filePath,
        features_count: config.features.length,
        features: config.features.map((f) => ({
          name: f.name || f.architecture,
          design_pattern: f.design_pattern,
          includes_count: f.includes.length,
        })),
      };
    } catch (error) {
      return this.formatError(filePath, error);
    }
  }

  private async resolveFilePath(
    input: ValidateArchitectToolInput,
  ): Promise<{ success: true; path: string } | { success: false; error: ValidationError }> {
    // Must provide at least one input
    if (!input.file_path && !input.template_name) {
      return {
        success: false,
        error: {
          type: 'missing_input',
          message: 'Either file_path or template_name must be provided',
          fix_suggestion:
            'Provide file_path (e.g., "templates/nextjs-15/architect.yaml") or template_name (e.g., "nextjs-15")',
        },
      };
    }

    // Direct file path
    if (input.file_path) {
      // Use path.resolve() for cross-platform safe absolute path resolution
      // This handles '..' sequences properly on all platforms
      const resolvedPath = path.resolve(process.cwd(), input.file_path);

      // Validate using path.relative() - if it starts with '..', target is outside base
      // This approach works correctly on Windows (case-insensitive) and Unix (case-sensitive)
      // Note: symlinks are resolved by path.resolve(), so linked files outside workspace will be rejected
      const workspaceRoot = path.resolve(process.cwd());
      const relativeToWorkspace = path.relative(workspaceRoot, resolvedPath);
      // Path validation checks:
      // 1. Starts with '..' means target is in a parent directory (outside workspace)
      // 2. isAbsolute check handles Windows cross-drive case: path.relative('C:\\workspace', 'D:\\file')
      //    returns 'D:\\file' (absolute) since no relative path exists between drives
      // 3. Empty relative path means file is at workspace root (valid)
      const isWithinWorkspace =
        !relativeToWorkspace.startsWith(PARENT_DIR_PREFIX) && !path.isAbsolute(relativeToWorkspace);

      if (!isWithinWorkspace) {
        // Check if it's within a templates directory
        const templatesRoot = await TemplatesManagerService.findTemplatesPath();
        if (templatesRoot) {
          const resolvedTemplatesRoot = path.resolve(templatesRoot);
          const relativeToTemplates = path.relative(resolvedTemplatesRoot, resolvedPath);
          const isWithinTemplates =
            !relativeToTemplates.startsWith(PARENT_DIR_PREFIX) &&
            !path.isAbsolute(relativeToTemplates);

          if (isWithinTemplates) {
            return { success: true, path: resolvedPath };
          }
        }

        return {
          success: false,
          error: {
            type: 'file_not_found',
            message: `Path "${input.file_path}" is outside the workspace directory`,
            fix_suggestion:
              'Provide a file path within the current workspace or use template_name to reference a template.',
          },
        };
      }

      return { success: true, path: resolvedPath };
    }

    // Template name - find templates directory
    const templatesRoot = await TemplatesManagerService.findTemplatesPath();
    if (!templatesRoot) {
      return {
        success: false,
        error: {
          type: 'file_not_found',
          message: 'Templates directory not found',
          fix_suggestion:
            'Ensure you are in a workspace with a templates/ directory, or provide an absolute file_path.',
        },
      };
    }

    // biome-ignore lint/style/noNonNullAssertion: value guaranteed by context
    const templatePath = path.join(templatesRoot, input.template_name!);

    // Check template directory exists
    try {
      await fs.access(templatePath);
    } catch {
      return {
        success: false,
        error: {
          type: 'file_not_found',
          message: `Template "${input.template_name}" not found at ${templatePath}`,
          fix_suggestion: `Check the template name. Available templates are in: ${templatesRoot}`,
        },
      };
    }

    // Find architect file in template
    for (const filename of ARCHITECT_FILENAMES) {
      const candidatePath = path.join(templatePath, filename);
      try {
        await fs.access(candidatePath);
        return { success: true, path: candidatePath };
      } catch {
        // Try next filename
      }
    }

    // No architect file found
    return {
      success: false,
      error: {
        type: 'file_not_found',
        message: `No architect.yaml or .architect.yaml found in template "${input.template_name}"`,
        location: templatePath,
        fix_suggestion: `Create "${path.join(templatePath, '.architect.yaml')}" with the following structure:\n\nfeatures:\n  - name: example-pattern\n    design_pattern: Example Pattern\n    includes:\n      - "src/**/*.ts"\n    description: |\n      Pattern description here.`,
      },
    };
  }

  private formatError(filePath: string, error: unknown): ValidationFailure {
    const errors: ValidationError[] = [];

    if (error instanceof ParseArchitectError) {
      // YAML syntax error
      const message = error.message;

      // Try to extract line/column from YAML error
      const lineMatch = message.match(/line (\d+)/i);
      const columnMatch = message.match(/column (\d+)/i);
      const location =
        lineMatch && columnMatch
          ? `Line ${lineMatch[1]}, Column ${columnMatch[1]}`
          : lineMatch
            ? `Line ${lineMatch[1]}`
            : undefined;

      errors.push({
        type: 'yaml_syntax',
        message: 'YAML syntax error',
        details: message,
        location,
        fix_suggestion: this.getYamlFixSuggestion(message),
      });
    } else if (error instanceof InvalidConfigError) {
      // Schema validation error - use structured issues directly
      if (error.issues && error.issues.length > 0) {
        for (const issue of error.issues) {
          const fieldPath = issue.path.join('.');
          errors.push({
            type: 'schema_validation',
            message: issue.message,
            location: fieldPath,
            fix_suggestion: this.getSchemaFixSuggestion(fieldPath, issue.message),
          });
        }
      } else {
        // Fallback to parsing error message for backward compatibility
        const zodErrors = this.parseZodErrorMessage(error.message);
        for (const zodError of zodErrors) {
          errors.push({
            type: 'schema_validation',
            message: zodError.message,
            location: zodError.path,
            fix_suggestion: this.getSchemaFixSuggestion(zodError.path, zodError.message),
          });
        }
      }
    } else {
      // Unknown error
      errors.push({
        type: 'schema_validation',
        message: error instanceof Error ? error.message : String(error),
        fix_suggestion: 'Check the file for syntax and structural issues.',
      });
    }

    return {
      valid: false,
      file_path: filePath,
      errors,
    };
  }

  private parseZodErrorMessage(message: string): Array<{ path: string; message: string }> {
    // Parse "path: message, path2: message2" format from InvalidConfigError
    const parts = message.split(', ');
    return parts.map((part) => {
      const colonIndex = part.indexOf(':');
      if (colonIndex > -1) {
        return {
          path: part.substring(0, colonIndex).trim(),
          message: part.substring(colonIndex + 1).trim(),
        };
      }
      return { path: '', message: part };
    });
  }

  private getYamlFixSuggestion(errorMessage: string): string {
    const lowerMessage = errorMessage.toLowerCase();

    if (lowerMessage.includes('indentation')) {
      return 'Check indentation. YAML uses spaces (not tabs) for indentation. Each level should be indented by 2 spaces.';
    }

    if (lowerMessage.includes('duplicate key')) {
      return 'Remove duplicate keys. Each key in a YAML mapping must be unique.';
    }

    if (lowerMessage.includes('unexpected') || lowerMessage.includes('expected')) {
      return 'Check for missing colons after keys, unquoted special characters, or mismatched brackets/quotes.';
    }

    if (lowerMessage.includes('mapping')) {
      return 'Ensure proper key: value format with a space after the colon.';
    }

    return `Check the YAML syntax. Common issues:\n- Indentation (use 2 spaces, not tabs)\n- Missing colon after keys\n- Unquoted special characters\n- Mismatched quotes or brackets`;
  }

  private getSchemaFixSuggestion(fieldPath: string, errorMessage: string): string {
    const lowerMessage = errorMessage.toLowerCase();
    const lowerPath = fieldPath.toLowerCase();

    // Feature-level errors
    if (lowerPath.includes('features')) {
      const featureIndex = fieldPath.match(/features\.(\d+)/)?.[1];
      const featurePrefix = featureIndex ? `In feature ${Number(featureIndex) + 1}:` : '';

      if (lowerPath.includes('design_pattern')) {
        return `${featurePrefix} Add a "design_pattern" field with a non-empty string describing the pattern.\n\nExample:\n  design_pattern: "Service Layer Pattern"`;
      }

      if (lowerPath.includes('includes')) {
        if (lowerMessage.includes('at least one')) {
          return `${featurePrefix} Add at least one glob pattern to the "includes" array.\n\nExample:\n  includes:\n    - "src/services/**/*.ts"`;
        }
        return `${featurePrefix} "includes" must be an array of glob patterns.\n\nExample:\n  includes:\n    - "src/**/*.ts"\n    - "lib/**/*.ts"`;
      }

      if (lowerPath.endsWith('.name') || lowerPath.endsWith('.architecture')) {
        return `${featurePrefix} "name" should be a string identifier for this pattern.`;
      }
    }

    // Root level
    if (lowerPath === 'features' || lowerPath === '') {
      return 'The root must have a "features" array (can be empty).\n\nMinimal valid structure:\nfeatures: []';
    }

    // Generic suggestion
    return `Fix the "${fieldPath}" field. ${errorMessage}`;
  }
}
