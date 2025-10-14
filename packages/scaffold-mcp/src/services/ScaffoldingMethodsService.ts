import path from 'node:path';
import { log, ProjectConfigResolver } from '@agiflowai/aicode-utils';
import yaml from 'js-yaml';
import type { IFileSystemService } from '../types/interfaces';
import type { ScaffoldResult } from '../types/scaffold';
import { TemplateService } from './TemplateService';

export interface ScaffoldMethod {
  name: string;
  description?: string;
  instruction?: string;
  variables_schema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
    additionalProperties: boolean;
  };
  generator?: string;
}

export interface ListScaffoldingMethodsResult {
  sourceTemplate: string;
  templatePath: string;
  methods: ScaffoldMethod[];
}

export interface UseScaffoldMethodRequest {
  projectPath: string;
  scaffold_feature_name: string;
  variables: Record<string, any>;
}

interface ArchitectConfig {
  [scaffoldType: string]: any;
}

export class ScaffoldingMethodsService {
  private templateService: TemplateService;

  constructor(
    private fileSystem: IFileSystemService,
    private templatesRootPath: string,
  ) {
    this.templateService = new TemplateService();
  }

  async listScaffoldingMethods(projectPath: string): Promise<ListScaffoldingMethodsResult> {
    const absoluteProjectPath = path.resolve(projectPath);

    // Use ProjectConfigResolver to get sourceTemplate
    // This supports both monolith (toolkit.yaml) and monorepo (project.json)
    const projectConfig = await ProjectConfigResolver.resolveProjectConfig(absoluteProjectPath);

    const sourceTemplate = projectConfig.sourceTemplate;
    return this.listScaffoldingMethodsByTemplate(sourceTemplate);
  }

  async listScaffoldingMethodsByTemplate(
    templateName: string,
  ): Promise<ListScaffoldingMethodsResult> {
    const templatePath = await this.findTemplatePath(templateName);

    if (!templatePath) {
      throw new Error(`Template not found for sourceTemplate: ${templateName}`);
    }

    const fullTemplatePath = path.join(this.templatesRootPath, templatePath);
    const scaffoldYamlPath = path.join(fullTemplatePath, 'scaffold.yaml');

    if (!(await this.fileSystem.pathExists(scaffoldYamlPath))) {
      throw new Error(`scaffold.yaml not found at ${scaffoldYamlPath}`);
    }

    const scaffoldContent = await this.fileSystem.readFile(scaffoldYamlPath, 'utf8');
    const architectConfig = yaml.load(scaffoldContent) as ArchitectConfig;

    const methods: ScaffoldMethod[] = [];

    if (architectConfig.features && Array.isArray(architectConfig.features)) {
      architectConfig.features.forEach((feature: any) => {
        // Use feature.name if available, otherwise fallback to sourceTemplate
        const featureName = feature.name || `scaffold-${templateName}`;

        methods.push({
          name: featureName,
          description: feature.description || '',
          instruction: feature.instruction || '',
          variables_schema: feature.variables_schema || {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false,
          },
          generator: feature.generator,
        });
      });
    }

    return {
      sourceTemplate: templateName,
      templatePath,
      methods,
    };
  }

  /**
   * Gets scaffolding methods with instructions rendered using provided variables
   */
  async listScaffoldingMethodsWithVariables(
    projectPath: string,
    variables: Record<string, any>,
  ): Promise<ListScaffoldingMethodsResult> {
    const result = await this.listScaffoldingMethods(projectPath);

    // Process instructions with nunjucks templating
    const processedMethods = result.methods.map((method) => ({
      ...method,
      instruction: method.instruction
        ? this.processScaffoldInstruction(method.instruction, variables)
        : undefined,
    }));

    return {
      ...result,
      methods: processedMethods,
    };
  }

  /**
   * Processes scaffold instruction with template service
   */
  processScaffoldInstruction(instruction: string, variables: Record<string, any>): string {
    if (this.templateService.containsTemplateVariables(instruction)) {
      return this.templateService.renderString(instruction, variables);
    }
    return instruction;
  }

  private async findTemplatePath(sourceTemplate: string): Promise<string | null> {
    // Dynamically discover all template directories by traversing /templates/*/*
    const templateDirs = await this.discoverTemplateDirs();

    // First, try to match by exact template directory name
    if (templateDirs.includes(sourceTemplate)) {
      return sourceTemplate;
    }

    // If no exact match, try other methods
    for (const templateDir of templateDirs) {
      const templatePath = path.join(this.templatesRootPath, templateDir);

      const scaffoldYamlPath = path.join(templatePath, 'scaffold.yaml');
      if (await this.fileSystem.pathExists(scaffoldYamlPath)) {
        try {
          const scaffoldContent = await this.fileSystem.readFile(scaffoldYamlPath, 'utf8');
          const architectConfig = yaml.load(scaffoldContent) as ArchitectConfig;

          if (architectConfig.boilerplate && Array.isArray(architectConfig.boilerplate)) {
            for (const boilerplate of architectConfig.boilerplate) {
              if (boilerplate.name?.includes(sourceTemplate)) {
                return templateDir;
              }
            }
          }
        } catch (error) {
          log.warn(`Failed to read scaffold.yaml at ${scaffoldYamlPath}:`, error);
        }
      }
    }

    return null;
  }

  /**
   * Resolves the project path, handling both monorepo and monolith cases
   * Uses ProjectConfigResolver to find the correct workspace/project root
   */
  private async resolveProjectPath(projectPath: string): Promise<string> {
    const absolutePath = path.resolve(projectPath);

    try {
      // Use ProjectConfigResolver to handle both monorepo and monolith cases
      const projectConfig = await ProjectConfigResolver.resolveProjectConfig(absolutePath);

      // For monolith projects with workspaceRoot, use that
      // For monorepo projects, use the provided path
      return projectConfig.workspaceRoot || absolutePath;
    } catch (error) {
      // If config resolution fails, the error message from ProjectConfigResolver is already helpful
      throw error;
    }
  }

  /**
   * Dynamically discovers all template directories
   * Supports both flat structure (templates/nextjs-15) and nested structure (templates/apps/nextjs-15)
   **/
  private async discoverTemplateDirs(): Promise<string[]> {
    const templateDirs: string[] = [];

    try {
      const items = await this.fileSystem.readdir(this.templatesRootPath);

      for (const item of items) {
        const itemPath = path.join(this.templatesRootPath, item);

        // Skip files, only process directories
        const itemStats = await this.fileSystem.stat(itemPath);
        if (!itemStats.isDirectory()) continue;

        // Check if this directory has scaffold.yaml (flat structure)
        const scaffoldYamlPath = path.join(itemPath, 'scaffold.yaml');
        if (await this.fileSystem.pathExists(scaffoldYamlPath)) {
          templateDirs.push(item);
          continue;
        }

        // If no scaffold.yaml, it might be a category directory (nested structure)
        // Check subdirectories for templates
        try {
          const subItems = await this.fileSystem.readdir(itemPath);

          for (const subItem of subItems) {
            const subItemPath = path.join(itemPath, subItem);

            const subItemStats = await this.fileSystem.stat(subItemPath);
            if (!subItemStats.isDirectory()) continue;

            const subScaffoldYamlPath = path.join(subItemPath, 'scaffold.yaml');
            if (await this.fileSystem.pathExists(subScaffoldYamlPath)) {
              // Add the relative path from templates root (e.g., "apps/nextjs-15")
              const relativePath = path.join(item, subItem);
              templateDirs.push(relativePath);
            }
          }
        } catch (error) {
          log.warn(`Failed to read subdirectories in ${itemPath}:`, error);
        }
      }
    } catch (error) {
      log.warn(`Failed to read templates root directory ${this.templatesRootPath}:`, error);
    }

    return templateDirs;
  }

  async useScaffoldMethod(request: UseScaffoldMethodRequest): Promise<ScaffoldResult> {
    const { projectPath, scaffold_feature_name, variables } = request;

    // Resolve the actual project path (handle monolith vs monorepo)
    const absoluteProjectPath = await this.resolveProjectPath(projectPath);

    const scaffoldingMethods = await this.listScaffoldingMethods(absoluteProjectPath);

    const method = scaffoldingMethods.methods.find((m) => m.name === scaffold_feature_name);

    if (!method) {
      const availableMethods = scaffoldingMethods.methods.map((m) => m.name).join(', ');
      throw new Error(
        `Scaffold method '${scaffold_feature_name}' not found. Available methods: ${availableMethods}`,
      );
    }

    const ScaffoldService = (await import('./ScaffoldService')).ScaffoldService;
    const ScaffoldConfigLoader = (await import('./ScaffoldConfigLoader')).ScaffoldConfigLoader;
    const VariableReplacementService = (await import('./VariableReplacementService'))
      .VariableReplacementService;
    const TemplateService = (await import('./TemplateService')).TemplateService;

    const templateService = new TemplateService();
    const scaffoldConfigLoader = new ScaffoldConfigLoader(this.fileSystem, templateService);
    const variableReplacer = new VariableReplacementService(this.fileSystem, templateService);
    const scaffoldService = new ScaffoldService(
      this.fileSystem,
      scaffoldConfigLoader,
      variableReplacer,
      this.templatesRootPath,
    );

    const projectName = path.basename(absoluteProjectPath);

    const result = await scaffoldService.useFeature({
      projectPath: absoluteProjectPath,
      templateFolder: scaffoldingMethods.templatePath,
      featureName: scaffold_feature_name,
      variables: {
        ...variables,
        appPath: absoluteProjectPath,
        appName: projectName,
      },
    });

    if (!result.success) {
      throw new Error(result.message);
    }
    const message = `
Successfully scaffolded ${scaffold_feature_name} in ${projectPath}.
Please follow this **instruction**: \n ${method.instruction}.
-> Create or update the plan based on the instruction.
`;

    return {
      success: true,
      message,
      warnings: result.warnings,
      createdFiles: result.createdFiles,
      existingFiles: result.existingFiles,
    };
  }
}
