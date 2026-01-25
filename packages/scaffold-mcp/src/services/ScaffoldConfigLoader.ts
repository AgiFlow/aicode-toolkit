import path from 'node:path';
import yaml from 'js-yaml';
import { z } from 'zod';
import type {
  IFileSystemService,
  IScaffoldConfigLoader,
  ITemplateService,
} from '../types/interfaces';
import type { ArchitectConfig, ParsedInclude, TemplateValidationResult } from '../types/scaffold';

// Zod schema for variables_schema structure
const VariablesSchemaSchema = z.object({
  type: z.literal('object'),
  properties: z.record(z.any()),
  required: z.array(z.string()),
  additionalProperties: z.boolean(),
});

// Zod schema for scaffold config entry (boilerplate or feature)
const ScaffoldConfigEntrySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  instruction: z.string().optional(),
  targetFolder: z.string().optional(),
  variables_schema: VariablesSchemaSchema,
  includes: z.array(z.string()),
  generator: z.string().optional(),
  patterns: z.array(z.string()).optional(),
});

// Zod schema for the entire scaffold.yaml structure
const ScaffoldYamlSchema = z
  .object({
    boilerplate: z
      .union([ScaffoldConfigEntrySchema, z.array(ScaffoldConfigEntrySchema)])
      .optional(),
    features: z.union([ScaffoldConfigEntrySchema, z.array(ScaffoldConfigEntrySchema)]).optional(),
  })
  .catchall(z.union([ScaffoldConfigEntrySchema, z.array(ScaffoldConfigEntrySchema)]));

export type ScaffoldYaml = z.infer<typeof ScaffoldYamlSchema>;

export class ScaffoldConfigLoader implements IScaffoldConfigLoader {
  constructor(
    private fileSystem: IFileSystemService,
    private templateService: ITemplateService,
  ) {}

  async parseArchitectConfig(templatePath: string): Promise<ArchitectConfig | null> {
    const architectPath = path.join(templatePath, 'scaffold.yaml');

    if (!(await this.fileSystem.pathExists(architectPath))) {
      return null;
    }

    try {
      const content = await this.fileSystem.readFile(architectPath, 'utf8');
      const rawConfig = yaml.load(content);

      // Validate with Zod
      const validatedConfig = ScaffoldYamlSchema.parse(rawConfig);

      // Return as ArchitectConfig type for backwards compatibility
      return validatedConfig as unknown as ArchitectConfig;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors
          .map((err) => `${err.path.join('.')}: ${err.message}`)
          .join('; ');
        throw new Error(`scaffold.yaml validation failed: ${errorMessages}`);
      }
      throw new Error(
        `Failed to parse scaffold.yaml: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  parseIncludeEntry(includeEntry: string, variables: Record<string, any>): ParsedInclude {
    // Split by ? to separate path from conditions
    const [pathPart, conditionsPart] = includeEntry.split('?');

    // Parse conditions if they exist
    const conditions: Record<string, string> = {};
    if (conditionsPart) {
      const conditionPairs = conditionsPart.split('&');
      for (const pair of conditionPairs) {
        const [key, value] = pair.split('=');
        if (key && value) {
          conditions[key.trim()] = value.trim();
        }
      }
    }

    // Check for arrow syntax (source->target)
    if (pathPart.includes('->')) {
      const [sourcePath, targetPath] = pathPart.split('->').map((p) => p.trim());
      return {
        sourcePath,
        targetPath: this.replaceVariablesInPath(targetPath, variables),
        conditions,
      };
    }

    // No arrow syntax, source and target are the same
    const processedPath = this.replaceVariablesInPath(pathPart.trim(), variables);
    return {
      sourcePath: pathPart.trim(), // Keep original for template lookup
      targetPath: processedPath, // Process variables for target path
      conditions,
    };
  }

  replaceVariablesInPath(pathStr: string, variables: Record<string, any>): string {
    return this.templateService.renderString(pathStr, variables);
  }

  shouldIncludeFile(
    conditions: Record<string, string> | undefined,
    variables: Record<string, any>,
  ): boolean {
    if (!conditions || Object.keys(conditions).length === 0) {
      return true;
    }

    for (const [conditionKey, conditionValue] of Object.entries(conditions)) {
      const variableValue = variables[conditionKey];

      // Handle boolean conditions
      if (conditionValue === 'true' || conditionValue === 'false') {
        const expectedBoolean = conditionValue === 'true';
        // Convert variable value to boolean, handling string 'true'/'false' as well
        let actualBoolean: boolean;
        if (typeof variableValue === 'string') {
          actualBoolean = variableValue.toLowerCase() === 'true';
        } else {
          actualBoolean = Boolean(variableValue);
        }
        if (actualBoolean !== expectedBoolean) {
          return false;
        }
      } else {
        // Handle string conditions
        if (String(variableValue) !== conditionValue) {
          return false;
        }
      }
    }

    return true;
  }

  async validateTemplate(
    templatePath: string,
    scaffoldType: string,
  ): Promise<TemplateValidationResult> {
    const errors: string[] = [];
    const missingFiles: string[] = [];

    // Check if template directory exists
    if (!(await this.fileSystem.pathExists(templatePath))) {
      errors.push(`Template directory ${templatePath} does not exist`);
      return { isValid: false, errors, missingFiles };
    }

    // Parse scaffold.yaml
    let architectConfig: ArchitectConfig | null;
    try {
      architectConfig = await this.parseArchitectConfig(templatePath);
    } catch (error) {
      errors.push(
        `Failed to parse scaffold.yaml: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { isValid: false, errors, missingFiles };
    }

    if (!architectConfig) {
      errors.push('scaffold.yaml not found in template directory');
      return { isValid: false, errors, missingFiles };
    }

    if (!architectConfig[scaffoldType]) {
      const availableTypes = Object.keys(architectConfig).join(', ');
      errors.push(
        `Scaffold type '${scaffoldType}' not found in scaffold.yaml. Available types: ${availableTypes}`,
      );
      return { isValid: false, errors, missingFiles };
    }

    // Check if template files exist
    const config = architectConfig[scaffoldType];

    // Check if includes array exists before iterating
    if (config.includes && Array.isArray(config.includes)) {
      for (const includeFile of config.includes) {
        const parsed = this.parseIncludeEntry(includeFile, {});
        const sourcePath = path.join(templatePath, parsed.sourcePath);
        const liquidSourcePath = `${sourcePath}.liquid`;

        // Check if either the file or its .liquid version exists
        const sourceExists = await this.fileSystem.pathExists(sourcePath);
        const liquidExists = await this.fileSystem.pathExists(liquidSourcePath);

        if (!sourceExists && !liquidExists) {
          missingFiles.push(includeFile); // Show the original include entry in error
        }
      }
    }

    return {
      isValid: errors.length === 0 && missingFiles.length === 0,
      errors,
      missingFiles,
    };
  }
}
