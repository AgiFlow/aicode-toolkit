import path from 'node:path';
import {
  generateStableId,
  icons,
  messages,
  ProjectConfigResolver,
  print,
  TemplatesManagerService,
} from '@agiflowai/aicode-utils';
import { Command } from 'commander';
import { FileSystemService } from '../services/FileSystemService';
import {
  ScaffoldingMethodsService,
  type ListScaffoldingMethodsResult,
} from '../services/ScaffoldingMethodsService';
import { GenerateFeatureScaffoldTool } from '../tools';
import { writePendingScaffoldLog } from '../utils/scaffoldPendingLog';
import {
  assertToolSuccess,
  collectOption,
  detectMonolithMode,
  loadTextOption,
  parseJsonOption,
  resolveTemplatesPath,
} from './utils';

interface GenerateFeatureOptions {
  template?: string;
  description?: string;
  descriptionFile?: string;
  instruction?: string;
  instructionFile?: string;
  variables?: string;
  include?: string[];
  pattern?: string[];
}

/**
 * Scaffold CLI command
 */
export const scaffoldCommand = new Command('scaffold').description(
  'Add features to existing projects',
);

// List command
scaffoldCommand
  .command('list [projectPath]')
  .description('List available scaffolding methods for a project or template')
  .option('-t, --template <name>', 'Template name (e.g., nextjs-15, typescript-mcp-package)')
  .option('-c, --cursor <cursor>', 'Pagination cursor for next page')
  .action(async (projectPath, options) => {
    try {
      const templatesDir = await TemplatesManagerService.findTemplatesPath();
      if (!templatesDir) {
        messages.error(
          'Templates folder not found. Create a templates folder or specify templatesPath in toolkit.yaml',
        );
        process.exit(1);
      }
      const fileSystemService = new FileSystemService();
      const scaffoldingMethodsService = new ScaffoldingMethodsService(
        fileSystemService,
        templatesDir,
      );

      let result: ListScaffoldingMethodsResult;
      let displayName: string;

      if (projectPath || !options.template) {
        // Use project path
        const inputProjectPath = projectPath ?? process.cwd();
        const absolutePath = path.resolve(inputProjectPath);

        // Verify project configuration exists (supports both monolith and monorepo)
        const hasConfig = await ProjectConfigResolver.hasConfiguration(absolutePath);
        if (!hasConfig) {
          messages.error(`No project configuration found in ${absolutePath}`);
          messages.hint(
            'For monorepo: ensure project.json exists with sourceTemplate field\n' +
              'For monolith: ensure toolkit.yaml exists at workspace root\n' +
              'Or use --template option to list methods for a specific template',
          );
          process.exit(1);
        }

        result = await scaffoldingMethodsService.listScaffoldingMethods(
          absolutePath,
          options.cursor,
        );
        displayName = projectPath ?? absolutePath;
      } else {
        // Use template name
        result = await scaffoldingMethodsService.listScaffoldingMethodsByTemplate(
          options.template,
          options.cursor,
        );
        displayName = `template: ${options.template}`;
      }

      const methods = result.methods;

      if (methods.length === 0) {
        messages.warning(`No scaffolding methods available for ${displayName}.`);
        return;
      }

      print.header(`\n${icons.wrench} Available Scaffolding Methods for ${displayName}:\n`);

      for (const method of methods) {
        print.highlight(`  ${method.name}`);
        print.debug(
          `    ${method.instruction || method.description || 'No description available'}`,
        );

        if (method.variables_schema.required && method.variables_schema.required.length > 0) {
          print.debug(`    Required: ${method.variables_schema.required.join(', ')}`);
        }
        print.newline();
      }

      // Show pagination info if there are more results
      if (result.nextCursor) {
        print.newline();
        print.info(`${icons.info} More results available. Use --cursor to fetch next page:`);
        const cursorOption = `--cursor "${result.nextCursor}"`;
        if (projectPath) {
          print.debug(`  scaffold-mcp scaffold list ${projectPath} ${cursorOption}`);
        } else {
          print.debug(
            `  scaffold-mcp scaffold list --template ${options.template} ${cursorOption}`,
          );
        }
      }
    } catch (error) {
      messages.error('Error listing scaffolding methods:', error as Error);
      process.exit(1);
    }
  });

// Add command
scaffoldCommand
  .command('add <featureName>')
  .description('Add a feature to an existing project')
  .option('-p, --project <path>', 'Project path', process.cwd())
  .option('-v, --vars <json>', 'JSON string containing variables for the feature')
  .option('--marker <tag>', 'Custom scaffold marker tag to inject into generated code files')
  .option('--verbose', 'Enable verbose logging')
  .action(async (featureName, options) => {
    try {
      const projectPath = path.resolve(options.project);

      // Verify project configuration exists (supports both monolith and monorepo)
      const hasConfig = await ProjectConfigResolver.hasConfiguration(projectPath);
      if (!hasConfig) {
        messages.error(`No project configuration found in ${projectPath}`);
        messages.hint(
          'For monorepo: ensure project.json exists with sourceTemplate field\n' +
            'For monolith: ensure toolkit.yaml exists at workspace root',
        );
        process.exit(1);
      }

      // Parse variables
      let variables = {};
      if (options.vars) {
        try {
          variables = JSON.parse(options.vars);
        } catch (error) {
          messages.error('Error parsing variables JSON:', error as Error);
          messages.hint(
            'Example: --vars \'{"componentName": "UserProfile", "description": "User profile component"}\'',
          );
          process.exit(1);
        }
      }

      const templatesDir = await TemplatesManagerService.findTemplatesPath();
      if (!templatesDir) {
        messages.error(
          'Templates folder not found. Create a templates folder or specify templatesPath in toolkit.yaml',
        );
        process.exit(1);
      }
      const fileSystemService = new FileSystemService();
      const scaffoldingMethodsService = new ScaffoldingMethodsService(
        fileSystemService,
        templatesDir,
      );

      // Get scaffold method info - fetch all pages to find the method
      let allMethods: any[] = [];
      let cursor: string | undefined;
      do {
        const listResult = await scaffoldingMethodsService.listScaffoldingMethods(
          projectPath,
          cursor,
        );
        allMethods = allMethods.concat(listResult.methods);
        cursor = listResult.nextCursor;
      } while (cursor);

      const method = allMethods.find((m) => m.name === featureName);

      if (!method) {
        messages.error(`Scaffold method '${featureName}' not found.`);
        print.warning(`Available methods: ${allMethods.map((m) => m.name).join(', ')}`);
        print.debug(
          `Run 'scaffold-mcp scaffold list ${options.project}' to see all available methods`,
        );
        process.exit(1);
      }

      // Check for required variables
      const required =
        typeof method.variables_schema === 'object' &&
        method.variables_schema !== null &&
        'required' in method.variables_schema
          ? (method.variables_schema.required as string[])
          : [];
      const missing = required.filter(
        (key: string) => !(variables as Record<string, unknown>)[key],
      );

      if (missing.length > 0) {
        messages.error(`❌ Missing required variables: ${missing.join(', ')}`);
        messages.hint(`💡 Use --vars with a JSON object containing: ${missing.join(', ')}`);

        const exampleVars: Record<string, any> = {};
        for (const key of required) {
          if (key.includes('Name')) {
            exampleVars[key] = 'MyFeature';
          } else if (key === 'description') {
            exampleVars[key] = 'Feature description';
          } else {
            exampleVars[key] = `<${key}>`;
          }
        }
        print.debug(
          `Example: scaffold-mcp scaffold add ${featureName} --project ${options.project} --vars '${JSON.stringify(exampleVars)}'`,
        );
        process.exit(1);
      }

      if (options.verbose) {
        print.info(`🔧 Feature: ${featureName}`);
        print.info(`📊 Variables: ${JSON.stringify(variables, null, 2)}`);
        print.info(`📁 Project Path: ${projectPath}`);
      }

      print.info(`🚀 Adding '${featureName}' to project...`);

      const result = await scaffoldingMethodsService.useScaffoldMethod({
        projectPath,
        scaffold_feature_name: featureName,
        variables,
        marker: options.marker,
      });

      if (result.success) {
        const scaffoldId = generateStableId(6);
        if (result.createdFiles && result.createdFiles.length > 0) {
          await writePendingScaffoldLog({
            scaffoldId,
            projectPath,
            featureName,
            generatedFiles: result.createdFiles,
          });
        }

        messages.success('✅ Feature added successfully!');

        if (result.createdFiles && result.createdFiles.length > 0) {
          print.header('\n📁 Created files:');
          result.createdFiles.forEach((file) => {
            print.debug(`   - ${file}`);
          });
        }

        if (result.warnings && result.warnings.length > 0) {
          messages.warning('\n⚠️  Warnings:');
          result.warnings.forEach((warning) => {
            print.debug(`   - ${warning}`);
          });
        }

        print.debug(`\nSCAFFOLD_ID:${scaffoldId}`);

        print.header('\n📋 Next steps:');
        print.debug('   - Review the generated files');
        print.debug('   - Update imports if necessary');
        print.debug('   - Run tests to ensure everything works');
      } else {
        messages.error(`❌ Failed to add feature: ${result.message}`);
        process.exit(1);
      }
    } catch (error) {
      messages.error(`❌ Error adding feature: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// Generate command
scaffoldCommand
  .command('generate <featureName>')
  .description("Create a new feature scaffold configuration in a template's scaffold.yaml")
  .option('-t, --template <name>', 'Template name (optional in monolith mode)')
  .option('--description <text>', 'Feature description')
  .option('--description-file <path>', 'Read feature description from a file')
  .option('--instruction <text>', 'Detailed feature instructions')
  .option('--instruction-file <path>', 'Read detailed feature instructions from a file')
  .option(
    '--variables <json>',
    'JSON array of variable definitions: [{"name":"featureName","description":"Feature name","type":"string","required":true}]',
  )
  .option('-i, --include <path>', 'Template include path (repeatable)', collectOption, [])
  .option(
    '--pattern <glob>',
    'File pattern this scaffold applies to (repeatable)',
    collectOption,
    [],
  )
  .action(async (featureName: string, options: GenerateFeatureOptions) => {
    try {
      const templatesPath = await resolveTemplatesPath();
      const isMonolith = await detectMonolithMode();
      const description = await loadTextOption({
        value: options.description,
        filePath: options.descriptionFile,
        valueFlag: '--description',
        fileFlag: '--description-file',
        required: true,
      });
      const instruction = await loadTextOption({
        value: options.instruction,
        filePath: options.instructionFile,
        valueFlag: '--instruction',
        fileFlag: '--instruction-file',
      });
      const variables = parseJsonOption<
        Array<{
          name: string;
          description: string;
          type: string;
          required: boolean;
          default?: unknown;
        }>
      >(options.variables, '--variables');

      if (!Array.isArray(variables)) {
        throw new Error('--variables must be a JSON array');
      }

      const tool = new GenerateFeatureScaffoldTool(templatesPath, isMonolith);
      const result = await tool.execute({
        templateName: options.template,
        featureName,
        description: description ?? '',
        instruction,
        variables,
        includes: options.include ?? [],
        patterns: options.pattern ?? [],
      });

      print.info(assertToolSuccess(result));
    } catch (error) {
      print.error(
        'Error generating feature scaffold:',
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

// Info command
scaffoldCommand
  .command('info <featureName>')
  .description('Show detailed information about a scaffold method')
  .option('-p, --project <path>', 'Project path')
  .option('-t, --template <name>', 'Template name (e.g., nextjs-15, typescript-mcp-package)')
  .action(async (featureName, options) => {
    try {
      // Require either project or template option
      if (!options.project && !options.template) {
        messages.error('Either --project or --template option must be provided');
        messages.hint('Examples:');
        print.debug('  scaffold-mcp scaffold info scaffold-route --project ./my-app');
        print.debug('  scaffold-mcp scaffold info scaffold-route --template nextjs-15');
        process.exit(1);
      }

      const templatesDir = await TemplatesManagerService.findTemplatesPath();
      if (!templatesDir) {
        messages.error(
          'Templates folder not found. Create a templates folder or specify templatesPath in toolkit.yaml',
        );
        process.exit(1);
      }
      const fileSystemService = new FileSystemService();
      const scaffoldingMethodsService = new ScaffoldingMethodsService(
        fileSystemService,
        templatesDir,
      );

      // Fetch all pages to find the method
      let allMethods: any[] = [];
      let cursor: string | undefined;

      if (options.project) {
        // Use project path
        const projectPath = path.resolve(options.project);

        // Verify project configuration exists (supports both monolith and monorepo)
        const hasConfig = await ProjectConfigResolver.hasConfiguration(projectPath);
        if (!hasConfig) {
          messages.error(`No project configuration found in ${projectPath}`);
          messages.hint(
            'For monorepo: ensure project.json exists with sourceTemplate field\n' +
              'For monolith: ensure toolkit.yaml exists at workspace root\n' +
              'Or use --template option to view info for a specific template',
          );
          process.exit(1);
        }

        // Fetch all pages
        do {
          const result = await scaffoldingMethodsService.listScaffoldingMethods(
            projectPath,
            cursor,
          );
          allMethods = allMethods.concat(result.methods);
          cursor = result.nextCursor;
        } while (cursor);
      } else {
        // Use template name - fetch all pages
        do {
          const result = await scaffoldingMethodsService.listScaffoldingMethodsByTemplate(
            options.template,
            cursor,
          );
          allMethods = allMethods.concat(result.methods);
          cursor = result.nextCursor;
        } while (cursor);
      }

      const method = allMethods.find((m) => m.name === featureName);

      if (!method) {
        messages.error(`❌ Scaffold method '${featureName}' not found.`);
        process.exit(1);
      }

      print.header(`\n🔧 Scaffold Method: ${method.name}\n`);
      print.debug(`Description: ${method.description}`);

      print.header('\n📝 Variables Schema:');
      print.debug(JSON.stringify(method.variables_schema, null, 2));

      const includes = 'includes' in method ? (method.includes as string[]) : [];
      if (includes && includes.length > 0) {
        print.header('\n📁 Files to be created:');
        includes.forEach((include: string) => {
          const parts = include.split('>>');
          if (parts.length === 2) {
            print.debug(`  - ${parts[1].trim()}`);
          } else {
            print.debug(`  - ${include}`);
          }
        });
      }
    } catch (error) {
      messages.error(`❌ Error getting scaffold info: ${(error as Error).message}`);
      process.exit(1);
    }
  });
