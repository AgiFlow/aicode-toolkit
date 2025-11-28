import * as path from 'node:path';
import { pathExists, ensureDir, readFile, writeFile, readdir } from '@agiflowai/aicode-utils';
import * as yaml from 'js-yaml';

interface BoilerplateDefinition {
  name: string;
  targetFolder: string;
  description: string;
  instruction?: string;
  variables_schema: any;
  includes: string[];
}

interface ScaffoldConfig {
  boilerplate?: BoilerplateDefinition[];
  features?: any[];
}

export interface GenerateBoilerplateOptions {
  templateName: string;
  boilerplateName: string;
  description: string;
  instruction?: string;
  targetFolder: string;
  variables: Array<{
    name: string;
    description: string;
    type: string;
    required: boolean;
    default?: any;
  }>;
  includes?: string[];
}

/**
 * Service for generating boilerplate configurations in scaffold.yaml files
 */
export class BoilerplateGeneratorService {
  private templatesPath: string;

  constructor(templatesPath: string) {
    this.templatesPath = templatesPath;
  }

  /**
   * Custom YAML dumper that forces literal block style (|) for description and instruction fields
   */
  private dumpYamlWithLiteralBlocks(config: ScaffoldConfig): string {
    // Create a custom type for literal blocks
    const LiteralBlockType = new yaml.Type('tag:yaml.org,2002:str', {
      kind: 'scalar',
      construct: (data) => data,
      represent: (data) => {
        return data;
      },
      defaultStyle: '|', // Force block literal style
    });

    const LITERAL_SCHEMA = yaml.DEFAULT_SCHEMA.extend([LiteralBlockType]);

    // Deep clone and mark description/instruction fields
    const processedConfig = this.processConfigForLiteralBlocks(config);

    return yaml.dump(processedConfig, {
      schema: LITERAL_SCHEMA,
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
      styles: {
        '!!str': 'literal',
      },
      replacer: (key, value) => {
        // Force literal block style for description and instruction
        if ((key === 'description' || key === 'instruction') && typeof value === 'string') {
          // Return a specially marked string
          return value;
        }
        return value;
      },
    });
  }

  /**
   * Process config to ensure description and instruction use literal block style
   */
  private processConfigForLiteralBlocks(config: ScaffoldConfig): any {
    const processed = JSON.parse(JSON.stringify(config));

    // Process boilerplate descriptions and instructions
    if (processed.boilerplate) {
      processed.boilerplate = processed.boilerplate.map((bp: any) => {
        const newBp = { ...bp };
        // Ensure description is formatted for block literal
        if (newBp.description && typeof newBp.description === 'string') {
          newBp.description = this.ensureMultilineFormat(newBp.description);
        }
        // Ensure instruction is formatted for block literal
        if (newBp.instruction && typeof newBp.instruction === 'string') {
          newBp.instruction = this.ensureMultilineFormat(newBp.instruction);
        }
        return newBp;
      });
    }

    // Process feature descriptions and instructions
    if (processed.features) {
      processed.features = processed.features.map((feature: any) => {
        const newFeature = { ...feature };
        if (newFeature.description && typeof newFeature.description === 'string') {
          newFeature.description = this.ensureMultilineFormat(newFeature.description);
        }
        if (newFeature.instruction && typeof newFeature.instruction === 'string') {
          newFeature.instruction = this.ensureMultilineFormat(newFeature.instruction);
        }
        return newFeature;
      });
    }

    return processed;
  }

  /**
   * Ensure string is properly formatted for YAML literal blocks
   */
  private ensureMultilineFormat(text: string): string {
    // Trim and normalize the text
    return text.trim();
  }

  /**
   * Generate or update a boilerplate configuration in scaffold.yaml
   */
  async generateBoilerplate(options: GenerateBoilerplateOptions): Promise<{
    success: boolean;
    message: string;
    templatePath?: string;
    scaffoldYamlPath?: string;
  }> {
    const {
      templateName,
      boilerplateName,
      description,
      instruction,
      targetFolder,
      variables,
      includes = [],
    } = options;

    // Create template directory
    const templatePath = path.join(this.templatesPath, templateName);
    await ensureDir(templatePath);

    // Path to scaffold.yaml
    const scaffoldYamlPath = path.join(templatePath, 'scaffold.yaml');

    // Read existing scaffold.yaml if it exists
    let scaffoldConfig: ScaffoldConfig = {};
    if (await pathExists(scaffoldYamlPath)) {
      const yamlContent = await readFile(scaffoldYamlPath, 'utf-8');
      scaffoldConfig = yaml.load(yamlContent) as ScaffoldConfig;
    }

    // Initialize boilerplate array if it doesn't exist
    if (!scaffoldConfig.boilerplate) {
      scaffoldConfig.boilerplate = [];
    }

    // Check if boilerplate already exists
    const existingIndex = scaffoldConfig.boilerplate.findIndex((b) => b.name === boilerplateName);
    if (existingIndex !== -1) {
      return {
        success: false,
        message: `Boilerplate '${boilerplateName}' already exists in ${scaffoldYamlPath}`,
      };
    }

    // Build variables schema
    const requiredVars = variables.filter((v) => v.required).map((v) => v.name);
    const variablesSchema: any = {
      type: 'object',
      properties: variables.reduce(
        (acc, v) => {
          acc[v.name] = {
            type: v.type,
            description: v.description,
          };
          if (v.default !== undefined) {
            acc[v.name].default = v.default;
          }
          return acc;
        },
        {} as Record<string, any>,
      ),
      required: requiredVars,
      additionalProperties: false,
    };

    // Create boilerplate definition
    const boilerplateDefinition: BoilerplateDefinition = {
      name: boilerplateName,
      targetFolder,
      description,
      variables_schema: variablesSchema,
      includes: includes.length > 0 ? includes : [],
    };

    if (instruction) {
      boilerplateDefinition.instruction = instruction;
    }

    // Add to boilerplate array
    scaffoldConfig.boilerplate.push(boilerplateDefinition);

    // Write scaffold.yaml with proper formatting for multi-line strings
    // Custom replacer to force literal block style for description and instruction
    const yamlContent = this.dumpYamlWithLiteralBlocks(scaffoldConfig);

    await writeFile(scaffoldYamlPath, yamlContent, 'utf-8');

    return {
      success: true,
      message: `Boilerplate '${boilerplateName}' added to ${scaffoldYamlPath}`,
      templatePath,
      scaffoldYamlPath,
    };
  }

  /**
   * List all templates (directories in templates folder)
   */
  async listTemplates(): Promise<string[]> {
    const entries = await readdir(this.templatesPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  }

  /**
   * Check if a template exists
   */
  async templateExists(templateName: string): Promise<boolean> {
    const templatePath = path.join(this.templatesPath, templateName);
    return pathExists(templatePath);
  }

  /**
   * Create or update a template file for a boilerplate
   */
  async createTemplateFile(options: {
    templateName: string;
    filePath: string;
    content?: string;
    sourceFile?: string;
    header?: string;
  }): Promise<{
    success: boolean;
    message: string;
    filePath?: string;
    fullPath?: string;
  }> {
    const { templateName, filePath, content, sourceFile, header } = options;

    // Validate template exists
    const templatePath = path.join(this.templatesPath, templateName);
    if (!(await pathExists(templatePath))) {
      return {
        success: false,
        message: `Template directory '${templateName}' does not exist at ${templatePath}`,
      };
    }

    // Determine file content
    let fileContent = content || '';

    if (sourceFile) {
      // Copy from source file
      if (!(await pathExists(sourceFile))) {
        return {
          success: false,
          message: `Source file '${sourceFile}' does not exist`,
        };
      }
      fileContent = await readFile(sourceFile, 'utf-8');
    }

    if (!fileContent && !sourceFile) {
      return {
        success: false,
        message: 'Either content or sourceFile must be provided',
      };
    }

    // Add .liquid extension if not already present
    const templateFilePath = filePath.endsWith('.liquid') ? filePath : `${filePath}.liquid`;

    // Full path to the template file
    const fullPath = path.join(templatePath, templateFilePath);

    // Ensure directory exists
    await ensureDir(path.dirname(fullPath));

    // Prepend header if provided
    let finalContent = fileContent;
    if (header) {
      finalContent = `${header}\n\n${fileContent}`;
    }

    // Write the file
    await writeFile(fullPath, finalContent, 'utf-8');

    return {
      success: true,
      message: 'Template file created successfully',
      filePath: templateFilePath,
      fullPath,
    };
  }
}
