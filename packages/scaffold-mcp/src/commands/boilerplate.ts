import { icons, messages, print, sections, TemplatesManagerService } from '@agiflowai/aicode-utils';
import { Command } from 'commander';
import { BoilerplateService } from '../services/BoilerplateService';
import { GenerateBoilerplateTool } from '../tools';
import {
  assertToolSuccess,
  collectOption,
  detectMonolithMode,
  loadTextOption,
  parseJsonOption,
  parseObjectOption,
  writeJson,
  failJson,
  toolResultData,
  resolveTemplatesPath,
} from './utils';

interface GenerateBoilerplateOptions {
  template?: string;
  description?: string;
  descriptionFile?: string;
  instruction?: string;
  instructionFile?: string;
  targetFolder?: string;
  variables?: string;
  include?: string[];
  json?: boolean;
}

/**
 * Boilerplate CLI command
 */
export const boilerplateCommand = new Command('boilerplate').description(
  'Manage boilerplate templates',
);

// List command
boilerplateCommand
  .command('list')
  .description('List all available boilerplate templates')
  .option('-c, --cursor <cursor>', 'Pagination cursor for next page')
  .option('--json', 'Print one structured JSON result')
  .action(async (options) => {
    try {
      const templatesDir = await TemplatesManagerService.findTemplatesPath();
      if (!templatesDir)
        throw new Error(
          'Templates folder not found. Create a templates folder or specify templatesPath in toolkit.yaml',
        );
      const boilerplateService = new BoilerplateService(templatesDir);
      const { boilerplates, nextCursor } = await boilerplateService.listBoilerplates(
        options.cursor,
      );

      if (options.json) {
        writeJson({ boilerplates, nextCursor });
        return;
      }
      if (boilerplates.length === 0) {
        messages.warning('No boilerplate templates found.');
        return;
      }

      print.header(`\n${icons.package} Available Boilerplate Templates:\n`);

      for (const bp of boilerplates) {
        print.highlight(`  ${bp.name}`);
        print.debug(`    ${bp.description}`);
        print.debug(`    Target: ${bp.target_folder}`);

        const required =
          typeof bp.variables_schema === 'object' &&
          bp.variables_schema !== null &&
          'required' in bp.variables_schema
            ? (bp.variables_schema.required as string[])
            : [];
        if (required && required.length > 0) {
          print.debug(`    Required: ${required.join(', ')}`);
        }
        print.newline();
      }

      // Show pagination info if there are more results
      if (nextCursor) {
        print.newline();
        print.info(`${icons.info} More results available. Use --cursor to fetch next page:`);
        print.debug(`  scaffold-mcp boilerplate list --cursor "${nextCursor}"`);
      }
    } catch (error) {
      if (options.json) failJson(error);
      messages.error('Error listing boilerplates:', error as Error);
      process.exit(1);
    }
  });

// Create command
boilerplateCommand
  .command('create <boilerplateName>')
  .description('Create a new project from a boilerplate template')
  .option('-v, --vars <json>', 'JSON string containing variables for the boilerplate')
  .option(
    '-m, --monolith',
    'Create as monolith project at workspace root with toolkit.yaml (default: false, creates as monorepo with project.json)',
  )
  .option(
    '-t, --target-folder <path>',
    'Override target folder (defaults to boilerplate targetFolder for monorepo, workspace root for monolith)',
  )
  .option('--marker <tag>', 'Custom scaffold marker tag to inject into generated code files')
  .option('--verbose', 'Enable verbose logging')
  .option('--json', 'Print one structured JSON result')
  .action(async (boilerplateName, options) => {
    try {
      const templatesDir = await TemplatesManagerService.findTemplatesPath();
      if (!templatesDir)
        throw new Error(
          'Templates folder not found. Create a templates folder or specify templatesPath in toolkit.yaml',
        );
      const boilerplateService = new BoilerplateService(templatesDir);

      // Absent variables default to an empty object.
      const variables = parseObjectOption(options.vars, '--vars');

      // Get boilerplate info
      const boilerplate = await boilerplateService.getBoilerplate(boilerplateName);
      if (!boilerplate) {
        throw new Error(
          `Boilerplate '${boilerplateName}' not found. Run scaffold-mcp boilerplate list to discover templates.`,
        );
      }

      // Check for required variables
      const required =
        typeof boilerplate.variables_schema === 'object' &&
        boilerplate.variables_schema !== null &&
        'required' in boilerplate.variables_schema
          ? (boilerplate.variables_schema.required as string[])
          : [];
      const missing = required.filter((key: string) => !Object.hasOwn(variables, key));

      if (missing.length > 0) {
        throw new Error(
          `Missing required variables: ${missing.join(', ')}. Run scaffold-mcp boilerplate info ${boilerplateName} for the schema.`,
        );
      }

      if (!options.json) {
        if (options.verbose) {
          print.info(`${icons.wrench} Boilerplate: ${boilerplateName}`);
          print.info(`${icons.chart} Variables: ${JSON.stringify(variables, null, 2)}`);
        }
        messages.loading(`Creating project from boilerplate '${boilerplateName}'...`);
      }

      const result = await boilerplateService.useBoilerplate({
        boilerplateName,
        variables,
        monolith: options.monolith,
        targetFolderOverride: options.targetFolder,
        marker: options.marker,
      });

      if (options.json) {
        if (!result.success) throw new Error(result.message);
        writeJson(result);
        return;
      }
      if (result.success) {
        messages.success('Project created successfully!');
        print.info(result.message);

        if (result.createdFiles && result.createdFiles.length > 0) {
          sections.createdFiles(result.createdFiles);
        }

        const projectName =
          (variables as Record<string, unknown>).appName ||
          (variables as Record<string, unknown>).packageName;
        if (typeof projectName === 'string' && projectName) {
          // Determine the correct path based on monolith flag
          const targetFolder =
            options.targetFolder || (options.monolith ? '.' : boilerplate.target_folder);
          const projectPath = options.monolith ? '.' : `${targetFolder}/${projectName}`;

          const steps =
            projectPath === '.'
              ? ['pnpm install', 'pnpm dev']
              : [`cd ${projectPath}`, 'pnpm install', 'pnpm dev'];

          sections.nextSteps(steps);
        }
      } else {
        messages.error(`Failed to create project: ${result.message}`);
        process.exit(1);
      }
    } catch (error) {
      if (options.json) failJson(error);
      messages.error('Error creating project:', error as Error);
      if (options.verbose) console.error('Stack trace:', (error as Error).stack);
      process.exit(1);
    }
  });

// Generate command
boilerplateCommand
  .command('generate <boilerplateName>')
  .description("Create a new boilerplate configuration in a template's scaffold.yaml")
  .option('-t, --template <name>', 'Template name (optional in monolith mode)')
  .option('--description <text>', 'Boilerplate description')
  .option('--description-file <path>', 'Read boilerplate description from a file')
  .option('--instruction <text>', 'Detailed boilerplate instructions')
  .option('--instruction-file <path>', 'Read detailed boilerplate instructions from a file')
  .option('--target-folder <path>', 'Target folder for generated projects')
  .option(
    '--variables <json>',
    'JSON array of variable definitions: [{"name":"appName","description":"App name","type":"string","required":true}]',
  )
  .option('-i, --include <path>', 'Template include path (repeatable)', collectOption, [])
  .option('--json', 'Print one structured JSON result')
  .action(async (boilerplateName: string, options: GenerateBoilerplateOptions) => {
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

      const targetFolder = options.targetFolder ?? (isMonolith ? '.' : undefined);
      if (!targetFolder) {
        throw new Error('--target-folder is required outside monolith mode');
      }

      const tool = new GenerateBoilerplateTool(templatesPath, isMonolith);
      const result = await tool.execute({
        templateName: options.template,
        boilerplateName,
        description: description ?? '',
        instruction,
        targetFolder,
        variables,
        includes: options.include ?? [],
      });

      if (options.json) writeJson(toolResultData(result));
      else print.info(assertToolSuccess(result));
    } catch (error) {
      if (options.json) failJson(error);
      print.error(
        'Error generating boilerplate:',
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

// Info command
boilerplateCommand
  .command('info <boilerplateName>')
  .description('Show detailed information about a boilerplate template')
  .option('--json', 'Print one structured JSON result')
  .action(async (boilerplateName, options) => {
    try {
      const templatesDir = await TemplatesManagerService.findTemplatesPath();
      if (!templatesDir)
        throw new Error(
          'Templates folder not found. Create a templates folder or specify templatesPath in toolkit.yaml',
        );
      const boilerplateService = new BoilerplateService(templatesDir);
      const bp = await boilerplateService.getBoilerplate(boilerplateName);

      if (!bp) throw new Error(`Boilerplate '${boilerplateName}' not found.`);

      if (options.json) {
        writeJson(bp);
        return;
      }
      print.header(`\n${icons.package} Boilerplate: ${bp.name}\n`);
      print.debug(`Description: ${bp.description}`);
      print.debug(`Template Path: ${bp.template_path}`);
      print.debug(`Target Folder: ${bp.target_folder}`);
      if (bp.instruction) print.debug(`Instructions: ${bp.instruction}`);
      print.header(`\n${icons.config} Variables Schema:`);
      console.log(JSON.stringify(bp.variables_schema, null, 2));

      if (bp.includes && bp.includes.length > 0) {
        sections.list(`${icons.folder} Included Files:`, bp.includes);
      }
    } catch (error) {
      if (options.json) failJson(error);
      messages.error('Error getting boilerplate info:', error as Error);
      process.exit(1);
    }
  });
