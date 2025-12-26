import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { log, TemplatesManagerService } from '@agiflowai/aicode-utils';
import type {
  IFileSystemService,
  IScaffoldConfigLoader,
  IScaffoldService,
  IVariableReplacementService,
} from '../types/interfaces';
import type {
  BoilerplateOptions,
  FeatureOptions,
  ParsedInclude,
  ScaffoldResult,
} from '../types/scaffold';
import { ScaffoldProcessingService } from './ScaffoldProcessingService';

export class ScaffoldService implements IScaffoldService {
  private readonly templatesRootPath: string;
  private readonly processingService: ScaffoldProcessingService;

  constructor(
    private fileSystem: IFileSystemService,
    private scaffoldConfigLoader: IScaffoldConfigLoader,
    private variableReplacer: IVariableReplacementService,
    templatesRootPath?: string,
  ) {
    const resolvedPath = templatesRootPath || TemplatesManagerService.findTemplatesPathSync();
    if (!resolvedPath) {
      throw new Error(
        'Templates folder not found. Please create a "templates" folder in your workspace root, ' +
          'or specify "templatesPath" in toolkit.yaml to point to your templates directory.',
      );
    }
    this.templatesRootPath = resolvedPath;
    this.processingService = new ScaffoldProcessingService(fileSystem, variableReplacer);
  }

  /**
   * Scaffold a new project from a boilerplate template
   */
  async useBoilerplate(options: BoilerplateOptions): Promise<ScaffoldResult> {
    try {
      const {
        projectName,
        packageName,
        targetFolder,
        templateFolder,
        boilerplateName,
        variables = {},
      } = options;

      // For boilerplates, create a new directory (unless projectName is empty for monolith)
      // If projectName is empty, use targetFolder directly (monolith case)
      const targetPath = path.isAbsolute(targetFolder)
        ? projectName
          ? path.join(targetFolder, projectName)
          : targetFolder
        : projectName
          ? path.join(process.cwd(), targetFolder, projectName)
          : path.join(process.cwd(), targetFolder);
      const templatePath = path.join(this.templatesRootPath, templateFolder);

      // Validate template first
      const validationResult = await this.scaffoldConfigLoader.validateTemplate(
        templatePath,
        'boilerplate',
      );
      if (!validationResult.isValid) {
        const errorMessage = [
          ...validationResult.errors,
          ...validationResult.missingFiles.map((f: string) => `Template file not found: ${f}`),
        ].join('; ');

        return {
          success: false,
          message: `Template validation failed: ${errorMessage}`,
        };
      }

      // Check if target directory already exists - error if it does
      // Skip this check for monolith projects (projectName is empty) since workspace root exists
      if (projectName) {
        const targetExists = await this.fileSystem.pathExists(targetPath);
        if (targetExists) {
          return {
            success: false,
            message: `Directory ${targetPath} already exists`,
          };
        }
      }

      // Get architect config
      const architectConfig = await this.scaffoldConfigLoader.parseArchitectConfig(templatePath);
      if (!architectConfig || !architectConfig.boilerplate) {
        return {
          success: false,
          message: `Invalid architect configuration: missing 'boilerplate' section in scaffold.yaml`,
        };
      }

      // Find the specific boilerplate by name
      const boilerplateArray = architectConfig.boilerplate;
      let config;
      if (Array.isArray(boilerplateArray)) {
        config = boilerplateArray.find((b: any) => b.name === boilerplateName);
        if (!config) {
          return {
            success: false,
            message: `Boilerplate '${boilerplateName}' not found in scaffold configuration`,
          };
        }
      } else {
        config = architectConfig.boilerplate;
      }

      // Prepare all variables for replacement
      // If projectName is empty (monolith), use the package name for templates
      const effectiveProjectName =
        projectName || (packageName.includes('/') ? packageName.split('/')[1] : packageName);
      const allVariables = {
        ...variables,
        projectName: effectiveProjectName,
        packageName,
      };

      // Process the boilerplate
      return await this.processScaffold({
        config,
        targetPath,
        templatePath,
        allVariables,
        scaffoldType: 'boilerplate',
      });
    } catch (error) {
      return {
        success: false,
        message: `Error scaffolding boilerplate: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Scaffold a new feature into an existing project
   */
  async useFeature(options: FeatureOptions): Promise<ScaffoldResult> {
    try {
      const { projectPath, templateFolder, featureName, variables = {} } = options;

      // For features, targetPath is the project path itself (no new directory)
      const targetPath = path.resolve(projectPath);
      const templatePath = path.join(this.templatesRootPath, templateFolder);
      const projectName = path.basename(targetPath);

      // Validate template first
      const validationResult = await this.scaffoldConfigLoader.validateTemplate(
        templatePath,
        'features',
      );
      if (!validationResult.isValid) {
        const errorMessage = [
          ...validationResult.errors,
          ...validationResult.missingFiles.map((f: string) => `Template file not found: ${f}`),
        ].join('; ');

        return {
          success: false,
          message: `Template validation failed: ${errorMessage}`,
        };
      }

      // Check if target directory exists - error if it doesn't
      const targetExists = await this.fileSystem.pathExists(targetPath);
      if (!targetExists) {
        return {
          success: false,
          message: `Target directory ${targetPath} does not exist. Please create the parent directory first.`,
        };
      }

      // Get architect config
      const architectConfig = await this.scaffoldConfigLoader.parseArchitectConfig(templatePath);
      if (!architectConfig || !architectConfig.features) {
        return {
          success: false,
          message: `Invalid architect configuration: missing 'features' section in scaffold.yaml`,
        };
      }

      // Find the specific feature by name
      const featureArray = architectConfig.features;
      let config;
      if (Array.isArray(featureArray)) {
        config = featureArray.find((f: any) => f.name === featureName);
        if (!config) {
          return {
            success: false,
            message: `Feature '${featureName}' not found in scaffold configuration`,
          };
        }
      } else {
        config = architectConfig.features;
      }

      // Prepare all variables for replacement
      const allVariables = {
        ...variables,
        projectName,
        appPath: targetPath,
        appName: projectName,
      };

      // Process the feature
      return await this.processScaffold({
        config,
        targetPath,
        templatePath,
        allVariables,
        scaffoldType: 'feature',
      });
    } catch (error) {
      return {
        success: false,
        message: `Error scaffolding feature: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Common scaffolding processing logic shared by both useBoilerplate and useFeature
   */
  private async processScaffold(params: {
    config: any;
    targetPath: string;
    templatePath: string;
    allVariables: Record<string, any>;
    scaffoldType: 'boilerplate' | 'feature';
  }): Promise<ScaffoldResult> {
    const { config, targetPath, templatePath, allVariables, scaffoldType } = params;

    // Check if config has a custom generator
    log.debug('Config generator:', config.generator);
    log.debug('Config:', JSON.stringify(config, null, 2));
    if (config.generator) {
      log.info('Using custom generator:', config.generator);
      try {
        // Dynamically import the custom generator from the template's generators folder
        const generatorPath = path.join(templatePath, 'generators', config.generator);
        const generatorModule = await import(generatorPath);
        const generator = generatorModule.default;

        if (typeof generator !== 'function') {
          return {
            success: false,
            message: `Invalid generator: ${config.generator} does not export a default function`,
          };
        }

        // Call the custom generator with all necessary data and utilities
        const generatorResult = await generator({
          variables: allVariables,
          config,
          targetPath,
          templatePath,
          fileSystem: this.fileSystem,
          scaffoldConfigLoader: this.scaffoldConfigLoader,
          variableReplacer: this.variableReplacer,
          // Pass utilities to avoid import issues in generators
          ScaffoldProcessingService: this.processingService.constructor,
          getRootPath: () => {
            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            return path.join(__dirname, '../../../../..');
          },
          getProjectPath: (projectPath: string) => {
            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            const rootPath = path.join(__dirname, '../../../../..');
            return projectPath.replace(rootPath, '').replace('/', '');
          },
        });

        return generatorResult;
      } catch (error) {
        return {
          success: false,
          message: `Error loading or executing generator ${config.generator}: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // Default scaffolding logic (when no custom generator is specified)
    // Parse includes with new syntax support
    const parsedIncludes: ParsedInclude[] = [];
    const warnings: string[] = [];

    // Check if includes array exists before iterating
    if (config.includes && Array.isArray(config.includes)) {
      // Parse all includes and filter by conditions (sync operations)
      const filteredIncludes = (config.includes as string[])
        .map((includeEntry) =>
          this.scaffoldConfigLoader.parseIncludeEntry(includeEntry, allVariables),
        )
        .filter((parsed) =>
          this.scaffoldConfigLoader.shouldIncludeFile(parsed.conditions, allVariables),
        );

      // Check all target paths in parallel
      const existsResults = await Promise.all(
        filteredIncludes.map(async (parsed: ParsedInclude) => {
          const targetFilePath = path.join(targetPath, parsed.targetPath);
          const exists = await this.fileSystem.pathExists(targetFilePath);
          return { parsed, exists };
        }),
      );

      // Collect parsed includes and warnings
      for (const { parsed, exists } of existsResults) {
        parsedIncludes.push(parsed);
        if (exists) {
          warnings.push(`File/folder ${parsed.targetPath} already exists and will be preserved`);
        }
      }
    }

    // Create target directory
    await this.fileSystem.ensureDir(targetPath);

    // Track created and existing files
    const createdFiles: string[] = [];
    const existingFiles: string[] = [];

    // Copy and process all files in parallel
    await Promise.all(
      parsedIncludes.map(async (parsed) => {
        const sourcePath = path.join(templatePath, parsed.sourcePath);
        const targetFilePath = path.join(targetPath, parsed.targetPath);

        // Always pass existingFiles array to track and prevent overwriting existing files
        await this.processingService.copyAndProcess(
          sourcePath,
          targetFilePath,
          allVariables,
          createdFiles,
          existingFiles,
        );
      }),
    );

    // Prepare result message with information about existing files
    let message = `Successfully scaffolded ${scaffoldType} at ${targetPath}`;
    if (existingFiles.length > 0) {
      message += `. ${existingFiles.length} existing file(s) were preserved`;
    }
    message += ". Run 'pnpm install' to install dependencies.";

    return {
      success: true,
      message,
      warnings: warnings.length > 0 ? warnings : undefined,
      createdFiles: createdFiles.length > 0 ? createdFiles : undefined,
      existingFiles: existingFiles.length > 0 ? existingFiles : undefined,
    };
  }
}
