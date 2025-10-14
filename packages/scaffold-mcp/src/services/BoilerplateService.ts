import * as path from 'node:path';
import { log, ProjectConfigResolver } from '@agiflowai/aicode-utils';
import { jsonSchemaToZod } from '@composio/json-schema-to-zod';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import type {
  BoilerplateInfo,
  ListBoilerplateResponse,
  ScaffoldYamlConfig,
  UseBoilerplateRequest,
} from '../types/boilerplateTypes';
import type { ScaffoldResult } from '../types/scaffold';
import { FileSystemService } from './FileSystemService';
import { ScaffoldConfigLoader } from './ScaffoldConfigLoader';
import { ScaffoldService } from './ScaffoldService';
import { TemplateService } from './TemplateService';
import { VariableReplacementService } from './VariableReplacementService';

export class BoilerplateService {
  private templatesPath: string;
  private templateService: TemplateService;
  private scaffoldService: ScaffoldService;

  constructor(templatesPath: string) {
    this.templatesPath = templatesPath;
    this.templateService = new TemplateService();

    // Set up ScaffoldService dependencies
    const fileSystemService = new FileSystemService();
    const scaffoldConfigLoader = new ScaffoldConfigLoader(fileSystemService, this.templateService);
    const variableReplacementService = new VariableReplacementService(
      fileSystemService,
      this.templateService,
    );

    this.scaffoldService = new ScaffoldService(
      fileSystemService,
      scaffoldConfigLoader,
      variableReplacementService,
      templatesPath,
    );
  }

  /**
   * Scans all scaffold.yaml files and returns available boilerplates
   */
  async listBoilerplates(): Promise<ListBoilerplateResponse> {
    const boilerplates: BoilerplateInfo[] = [];

    // Dynamically discover all template directories
    const templateDirs = await this.discoverTemplateDirectories();

    for (const templatePath of templateDirs) {
      const scaffoldYamlPath = path.join(this.templatesPath, templatePath, 'scaffold.yaml');

      if (fs.existsSync(scaffoldYamlPath)) {
        try {
          const scaffoldContent = fs.readFileSync(scaffoldYamlPath, 'utf8');
          const scaffoldConfig = yaml.load(scaffoldContent) as ScaffoldYamlConfig;

          // Extract boilerplate configurations
          if (scaffoldConfig.boilerplate) {
            for (const boilerplate of scaffoldConfig.boilerplate) {
              // targetFolder must be specified in scaffold.yaml
              if (!boilerplate.targetFolder) {
                log.warn(
                  `Skipping boilerplate '${boilerplate.name}' in ${templatePath}: ` +
                    `targetFolder is required in scaffold.yaml`,
                );
                continue;
              }

              boilerplates.push({
                name: boilerplate.name,
                description: boilerplate.description,
                instruction: boilerplate.instruction,
                variables_schema: boilerplate.variables_schema,
                template_path: templatePath,
                target_folder: boilerplate.targetFolder,
                includes: boilerplate.includes,
              });
            }
          }
        } catch (error) {
          log.warn(`Failed to load scaffold.yaml for ${templatePath}:`, error);
        }
      }
    }

    return { boilerplates };
  }

  /**
   * Dynamically discovers template directories by finding all directories
   * that contain both package.json and scaffold.yaml files
   */
  private async discoverTemplateDirectories(): Promise<string[]> {
    const templateDirs: string[] = [];

    // Recursively find all directories with package.json
    const findTemplates = (dir: string, baseDir: string = ''): void => {
      if (!fs.existsSync(dir)) {
        return;
      }

      const items = fs.readdirSync(dir);

      // Check if current directory has both package.json (or package.json.liquid) and scaffold.yaml
      const hasPackageJson =
        items.includes('package.json') || items.includes('package.json.liquid');
      const hasScaffoldYaml = items.includes('scaffold.yaml');

      if (hasPackageJson && hasScaffoldYaml) {
        templateDirs.push(baseDir);
      }

      // Recursively search subdirectories
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          const newBaseDir = baseDir ? path.join(baseDir, item) : item;
          findTemplates(itemPath, newBaseDir);
        }
      }
    };

    findTemplates(this.templatesPath);

    return templateDirs;
  }

  /**
   * Executes a specific boilerplate with provided variables
   */
  async useBoilerplate(request: UseBoilerplateRequest): Promise<ScaffoldResult> {
    let { boilerplateName, variables, monolith, targetFolderOverride } = request;

    // Auto-detect project type if monolith parameter is not explicitly provided
    if (monolith === undefined) {
      try {
        const config = await ProjectConfigResolver.resolveProjectConfig(process.cwd());
        monolith = config.type === 'monolith';
        log.info(`Auto-detected project type: ${config.type}`);
      } catch (_error) {
        // If no config found, default to monorepo mode
        monolith = false;
        log.info('No project configuration found, defaulting to monorepo mode');
      }
    }

    // In monolith mode, read boilerplateName from toolkit.yaml if not provided
    if (monolith && !boilerplateName) {
      try {
        const config = await ProjectConfigResolver.resolveProjectConfig(process.cwd());
        boilerplateName = config.sourceTemplate;
        log.info(`Using boilerplate from toolkit.yaml: ${boilerplateName}`);
      } catch (error) {
        return {
          success: false,
          message: `Failed to read boilerplate name from toolkit.yaml: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // Validate boilerplateName is provided (either from parameter or toolkit.yaml)
    if (!boilerplateName) {
      return {
        success: false,
        message: 'Missing required parameter: boilerplateName',
      };
    }

    // Find the boilerplate configuration
    const boilerplateList = await this.listBoilerplates();
    const boilerplate = boilerplateList.boilerplates.find((b) => b.name === boilerplateName);

    if (!boilerplate) {
      return {
        success: false,
        message: `Boilerplate '${boilerplateName}' not found. Available boilerplates: ${boilerplateList.boilerplates.map((b) => b.name).join(', ')}`,
      };
    }

    // Validate variables using the boilerplate's schema
    const validationResult = this.validateBoilerplateVariables(boilerplate, variables);
    if (!validationResult.isValid) {
      return {
        success: false,
        message: `Validation failed: ${validationResult.errors.join(', ')}`,
      };
    }

    // Determine package name and folder name from variables
    const packageName = variables.packageName || variables.appName;
    if (!packageName) {
      return {
        success: false,
        message: 'Missing required parameter: packageName or appName',
      };
    }

    // Extract folder name from package name (remove scope if present)
    // e.g., "@agiflowai/test-package" -> "test-package"
    const folderName = packageName.includes('/') ? packageName.split('/')[1] : packageName;

    // Determine target folder based on monolith flag
    const targetFolder = targetFolderOverride || (monolith ? '.' : boilerplate.target_folder);

    // For monolith, don't create a subdirectory - use empty string as projectName
    // For monorepo, use folderName to create subdirectory
    const projectNameForPath = monolith ? '' : folderName;

    // Use ScaffoldService to perform the scaffolding
    try {
      const result = await this.scaffoldService.useBoilerplate({
        projectName: projectNameForPath,
        packageName: packageName,
        targetFolder,
        templateFolder: boilerplate.template_path,
        boilerplateName,
        variables: {
          ...variables,
          // Ensure all template variables are available
          packageName: packageName,
          appName: folderName,
          sourceTemplate: boilerplate.template_path,
        },
      });

      if (!result.success) {
        return result;
      }

      // After scaffolding, create appropriate config based on project type
      // NOTE: For monolith mode, toolkit.yaml is created at workspace root after scaffolding.
      // If running multiple operations concurrently, consider adding a locking mechanism
      // or creating the config file before scaffolding begins.
      if (monolith) {
        // Create toolkit.yaml for monolith projects
        await ProjectConfigResolver.createToolkitYaml(boilerplate.template_path);
      } else {
        // Create/update project.json for monorepo projects
        const projectPath = path.join(targetFolder, folderName);
        await ProjectConfigResolver.createProjectJson(
          projectPath,
          folderName,
          boilerplate.template_path,
        );
      }

      return {
        success: result.success,
        message: result.message,
        warnings: result.warnings,
        createdFiles: result.createdFiles,
        existingFiles: result.existingFiles,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to scaffold boilerplate: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Gets a specific boilerplate configuration by name with optional variable rendering
   */
  async getBoilerplate(
    name: string,
    variables?: Record<string, any>,
  ): Promise<BoilerplateInfo | null> {
    const boilerplateList = await this.listBoilerplates();
    const boilerplate = boilerplateList.boilerplates.find((b) => b.name === name);

    if (!boilerplate) {
      return null;
    }

    // If variables are provided, render the instruction with template service
    if (variables && this.templateService.containsTemplateVariables(boilerplate.instruction)) {
      return {
        ...boilerplate,
        instruction: this.templateService.renderString(boilerplate.instruction, variables),
      };
    }

    return boilerplate;
  }

  /**
   * Processes boilerplate instruction with template service
   */
  processBoilerplateInstruction(instruction: string, variables: Record<string, any>): string {
    if (this.templateService.containsTemplateVariables(instruction)) {
      return this.templateService.renderString(instruction, variables);
    }
    return instruction;
  }

  /**
   * Validates boilerplate variables against schema using Zod
   */
  validateBoilerplateVariables(
    boilerplate: BoilerplateInfo,
    variables: Record<string, any>,
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Convert JSON schema to Zod schema using @composio/json-schema-to-zod
      const zodSchema = jsonSchemaToZod(boilerplate.variables_schema);

      // Validate the variables
      zodSchema.parse(variables);

      return { isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const zodErrors = error.errors.map((err) => {
          const path = err.path.length > 0 ? err.path.join('.') : 'root';
          return `${path}: ${err.message}`;
        });
        errors.push(...zodErrors);
      } else {
        errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
      }

      return { isValid: false, errors };
    }
  }
}
