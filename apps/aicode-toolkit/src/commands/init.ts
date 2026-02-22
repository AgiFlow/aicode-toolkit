import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  detectProjectType as detectProjectTypeUtil,
  ProjectType,
  print,
  findWorkspaceRoot,
} from '@agiflowai/aicode-utils';
import { confirm, input, select } from '@inquirer/prompts';
import { Command } from 'commander';
import { Liquid } from 'liquidjs';
import ora from 'ora';
import { createActor, fromPromise } from 'xstate';
import settingsLiquidTemplate from '../templates/settings.yaml.liquid?raw';
import { MCP_SERVER_INFO, MCPServer } from '../constants';
import {
  type CodingAgent,
  CodingAgentService,
  NewProjectService,
  SpecTool,
  SpecToolService,
  SPEC_TOOL_INFO,
  TemplateSelectionService,
} from '../services';
import { type InitMachineInput, initMachine } from '../states/init-machine';
import { displayBanner } from '../utils';

const DEFAULT_TEMPLATE_REPO = {
  owner: 'AgiFlow',
  repo: 'aicode-toolkit',
  branch: 'main',
  path: 'templates',
};

/**
 * Actor implementations for the init V2 state machine
 */
const initActors = {
  /**
   * Display welcome banner
   */
  displayBanner: fromPromise(async () => {
    displayBanner();
  }),

  /**
   * Check if workspace exists by looking for .git folder
   */
  checkWorkspaceExists: fromPromise(async () => {
    const workspaceRoot = await findWorkspaceRoot();
    if (workspaceRoot) {
      print.divider();
      print.info(`Found workspace at: ${workspaceRoot}`);
      return { exists: true, workspaceRoot };
    }
    return { exists: false };
  }),

  /**
   * Detect project type (monorepo vs monolith)
   * Uses shared utility function for deterministic detection
   */
  detectProjectType: fromPromise(async ({ input }: { input: { workspaceRoot: string } }) => {
    print.divider();
    print.info('Detecting project type...');

    const result = await detectProjectTypeUtil(input.workspaceRoot);

    if (result.projectType) {
      print.success(`Detected ${result.projectType} project`);
    }

    return result;
  }),

  /**
   * Prompt user to select project type
   * Only prompts if project type was not detected
   */
  promptProjectType: fromPromise(
    async ({
      input: actorInput,
    }: {
      input: {
        providedProjectType?: string;
        detectedProjectType?: ProjectType;
        detectionIndicators?: string[];
      };
    }) => {
      // If provided via CLI, use it
      if (actorInput.providedProjectType) {
        const projectType = actorInput.providedProjectType as ProjectType;
        print.info(`Project type: ${projectType}`);
        return projectType;
      }

      // If detected, use it without prompting
      if (actorInput.detectedProjectType) {
        print.info(`Using detected project type: ${actorInput.detectedProjectType}`);
        return actorInput.detectedProjectType;
      }

      // Show detection hints if available
      if (actorInput.detectionIndicators && actorInput.detectionIndicators.length > 0) {
        print.info('\nDetection results:');
        for (const indicator of actorInput.detectionIndicators) {
          print.indent(`• ${indicator}`);
        }
        print.newline();
      }

      // Prompt user to choose
      print.divider();
      const result = await select({
        message: 'Select project type:',
        choices: [
          {
            name: 'Monolith – Single application structure',
            value: ProjectType.MONOLITH,
            description: '\n  Traditional single-application project structure',
          },
          {
            name: 'Monorepo – Multiple packages/apps in one repository',
            value: ProjectType.MONOREPO,
            description: '\n  Multiple packages managed together (uses workspaces)',
          },
        ],
      });
      print.info(''); // Add spacing after prompt
      return result;
    },
  ),

  /**
   * Prompt for project name
   */
  promptProjectName: fromPromise(
    async ({ input: actorInput }: { input: { providedName?: string } }) => {
      const newProjectService = new NewProjectService(actorInput.providedName, undefined);
      const providedName = newProjectService.getProvidedName();

      if (providedName) {
        const trimmedName = providedName.trim();
        const validationResult = newProjectService.validateProjectName(trimmedName);
        if (validationResult !== true) {
          throw new Error(validationResult);
        }
        print.info(`Project name: ${trimmedName}`);
        return trimmedName;
      }

      print.divider();
      const result = await input({
        message: 'Enter your project name (press Enter to use current directory):',
        validate: (value: string) => {
          // Allow empty value to skip
          if (!value || value.trim() === '') {
            return true;
          }
          // Otherwise validate as project name
          return newProjectService.validateProjectName(value);
        },
      });
      print.info(''); // Add spacing after prompt

      // If empty, return special marker to use current directory
      if (!result || result.trim() === '') {
        return '.';
      }

      return result;
    },
  ),

  /**
   * Create project directory
   */
  createProjectDirectory: fromPromise(
    async ({ input: actorInput }: { input: { projectName: string } }) => {
      // Special case: '.' means use current directory
      if (actorInput.projectName === '.') {
        const projectPath = process.cwd();
        print.success(`Using current directory: ${projectPath}`);
        return { projectPath };
      }

      const spinner = ora('Creating project directory...').start();

      try {
        const projectPath = path.join(process.cwd(), actorInput.projectName.trim());
        const newProjectService = new NewProjectService(undefined, undefined);

        await newProjectService.createProjectDirectory(projectPath, actorInput.projectName);

        spinner.succeed(`Created project directory: ${projectPath}`);
        return { projectPath };
      } catch (error) {
        spinner.fail('Failed to create project directory');
        throw error;
      }
    },
  ),

  /**
   * Setup Git repository (clone or init)
   */
  promptGitSetup: fromPromise(async ({ input: actorInput }: { input: { projectPath: string } }) => {
    const newProjectService = new NewProjectService(undefined, undefined);

    print.divider();
    const hasExistingRepo = await confirm({
      message: 'Do you have an existing Git repository you want to use?',
      default: false,
    });
    print.info(''); // Add spacing after prompt

    if (hasExistingRepo) {
      print.divider();
      const repoUrl = await input({
        message: 'Enter Git repository URL (press Enter to skip):',
        validate: (value: string) => {
          // Allow empty value to skip
          if (!value || value.trim() === '') {
            return true;
          }
          // Otherwise validate as repository URL
          return newProjectService.validateRepositoryUrl(value);
        },
      });
      print.info(''); // Add spacing after prompt

      // Only clone if URL was provided
      if (repoUrl && repoUrl.trim() !== '') {
        const spinner = ora('Cloning repository...').start();
        try {
          await newProjectService.cloneExistingRepository(repoUrl.trim(), actorInput.projectPath);
          spinner.succeed('Repository cloned successfully');
        } catch (error) {
          spinner.fail('Failed to clone repository');
          throw error;
        }
      } else {
        print.info('Skipped cloning repository');
      }
    } else {
      print.divider();
      const initGit = await confirm({
        message: 'Initialize a new Git repository?',
        default: true,
      });
      print.info(''); // Add spacing after prompt

      if (initGit) {
        const spinner = ora('Initializing Git repository...').start();
        try {
          await newProjectService.initializeGitRepository(actorInput.projectPath);
          spinner.succeed('Git repository initialized');
        } catch (error) {
          spinner.fail('Failed to initialize Git repository');
          throw error;
        }
      }
    }
  }),

  /**
   * Prompt user to select MCP servers
   * If one-mcp is selected, mcp-config.yaml will be created with other selected servers
   */
  promptMcpSelection: fromPromise(async () => {
    const checkbox = await import('@inquirer/prompts').then((m) => m.checkbox);

    const choices = Object.values(MCPServer).map((server) => ({
      name: MCP_SERVER_INFO[server].name,
      value: server,
      description: `\n  ${MCP_SERVER_INFO[server].description}`,
      // one-mcp and all others selected by default
      checked: true,
    }));

    print.divider();

    const selected = await checkbox({
      message: 'Select MCP servers to configure:',
      choices,
      validate: (answer) => {
        if (answer.length === 0) {
          return 'Please select at least one MCP server';
        }
        return true;
      },
    });
    print.info(''); // Add spacing after prompt

    return selected as MCPServer[];
  }),

  /**
   * Check if templates folder exists and prompt for custom directory
   */
  checkTemplatesFolder: fromPromise(
    async ({ input: actorInput }: { input: { workspaceRoot: string } }) => {
      try {
        const fs = await import('node:fs/promises');
        const defaultTemplatesPath = path.join(actorInput.workspaceRoot, 'templates');

        // Check if templates folder exists
        let templatesExists = false;
        try {
          await fs.access(defaultTemplatesPath);
          templatesExists = true;
        } catch {
          // Folder doesn't exist
          templatesExists = false;
        }

        let finalTemplatesPath = defaultTemplatesPath;
        let skipDownload = false;

        if (templatesExists) {
          print.divider();
          print.info(`Templates folder already exists at: ${defaultTemplatesPath}`);

          const useDifferentDir = await confirm({
            message: 'Would you like to use a different directory for templates?',
            default: false,
          });
          print.info(''); // Add spacing after prompt

          if (useDifferentDir) {
            print.divider();
            const customDir = await input({
              message: 'Enter custom templates directory path (relative to workspace root):',
              default: 'templates',
              validate: (value: string) => {
                if (!value || value.trim() === '') {
                  return 'Please enter a valid directory path';
                }
                return true;
              },
            });
            print.info(''); // Add spacing after prompt

            finalTemplatesPath = path.join(actorInput.workspaceRoot, customDir.trim());

            // Create the directory if it doesn't exist
            try {
              await fs.mkdir(finalTemplatesPath, { recursive: true });
              print.success(`Created templates directory at: ${finalTemplatesPath}`);
            } catch (error) {
              throw new Error(
                `Failed to create templates directory at ${finalTemplatesPath}: ${(error as Error).message}`,
              );
            }
          } else {
            // User wants to keep existing templates folder - skip download
            skipDownload = true;
            print.info('Using existing templates folder');
          }
        }

        // If skipping download, read existing templates from the folder
        let existingTemplates: string[] | undefined;
        if (skipDownload) {
          try {
            const templateSelectionService = new TemplateSelectionService(finalTemplatesPath);
            const templates = await templateSelectionService.listTemplates();
            existingTemplates = templates.map((t) => t.name);
          } catch (_error) {
            print.warning('Could not read existing templates, will proceed anyway');
          }
        }

        return { templatesPath: finalTemplatesPath, skipDownload, existingTemplates };
      } catch (error) {
        throw new Error(`Failed to check templates folder: ${(error as Error).message}`);
      }
    },
  ),

  /**
   * Download templates to tmp folder
   * Gracefully handles errors and returns null to skip template steps
   */
  downloadTemplates: fromPromise(async () => {
    const spinner = ora('Downloading templates from AgiFlow/aicode-toolkit...').start();

    try {
      const templateSelectionService = new TemplateSelectionService();
      const tmpPath = await templateSelectionService.downloadTemplatesToTmp(DEFAULT_TEMPLATE_REPO);
      spinner.succeed('Templates downloaded successfully');
      return tmpPath;
    } catch (_error) {
      spinner.warn('Failed to download templates - skipping template setup');
      print.info('You can run "aicode-toolkit init" again later to set up templates');
      return null; // Return null to indicate download failed gracefully
    }
  }),

  /**
   * List templates
   */
  listTemplates: fromPromise(async ({ input }: { input: { tmpTemplatesPath: string } }) => {
    const templateSelectionService = new TemplateSelectionService(input.tmpTemplatesPath);
    const templates = await templateSelectionService.listTemplates();

    print.header('\nAvailable templates:');
    for (const template of templates) {
      print.item(`${template.name}${template.description ? ` - ${template.description}` : ''}`);
    }

    return templates;
  }),

  /**
   * Prompt user to select templates
   */
  promptTemplateSelection: fromPromise(
    async ({
      input: actorInput,
    }: {
      input: { tmpTemplatesPath: string; projectType: ProjectType };
    }) => {
      const templateSelectionService = new TemplateSelectionService(actorInput.tmpTemplatesPath);
      const templates = await templateSelectionService.listTemplates();

      if (templates.length === 0) {
        throw new Error('No templates available');
      }

      // For monolith, only allow single selection
      if (actorInput.projectType === ProjectType.MONOLITH) {
        const choices = templates.map((t) => ({
          name: t.name,
          value: t.name,
          description: t.description ? `\n  ${t.description}` : undefined,
        }));

        print.divider();
        const selected = await select({
          message: 'Select template (monolith allows only one):',
          choices,
        });
        print.info(''); // Add spacing after prompt

        return [selected];
      }

      // For monorepo, allow multiple selections
      const checkbox = await import('@inquirer/prompts').then((m) => m.checkbox);
      const choices = templates.map((t) => ({
        name: t.name,
        value: t.name,
        description: t.description ? `\n  ${t.description}` : undefined,
        checked: true, // All templates selected by default for monorepo
      }));

      print.divider();
      const selected = await checkbox({
        message: 'Select templates (use space to select, enter to confirm):',
        choices,
      });
      print.info(''); // Add spacing after prompt

      if (selected.length === 0) {
        throw new Error('Please select at least one template');
      }

      return selected;
    },
  ),

  /**
   * Copy templates to workspace
   */
  copyTemplates: fromPromise(
    async ({
      input: actorInput,
    }: {
      input: {
        tmpTemplatesPath: string;
        workspaceRoot: string;
        templatesPath: string;
        selectedTemplates: string[];
        projectType: ProjectType;
        selectedMcpServers?: MCPServer[];
      };
    }) => {
      const spinner = ora('Copying templates to workspace...').start();

      try {
        const templateSelectionService = new TemplateSelectionService(actorInput.tmpTemplatesPath);

        await templateSelectionService.copyTemplates(
          actorInput.selectedTemplates,
          actorInput.templatesPath,
          actorInput.projectType,
          actorInput.selectedMcpServers,
        );

        spinner.succeed(`Templates copied to ${actorInput.templatesPath}`);
        return actorInput.templatesPath;
      } catch (error) {
        spinner.fail('Failed to copy templates');
        throw error;
      }
    },
  ),

  /**
   * Create configuration (.toolkit/settings.yaml for monolith)
   */
  createConfig: fromPromise(
    async ({
      input: actorInput,
    }: {
      input: {
        workspaceRoot: string;
        projectType: ProjectType;
        templatesPath: string;
        selectedTemplates: string[];
      };
    }) => {
      // Only create settings.yaml for monolith
      if (actorInput.projectType === ProjectType.MONOLITH) {
        // Calculate relative path from workspace root
        const relativeTemplatesPath = path.relative(
          actorInput.workspaceRoot,
          actorInput.templatesPath,
        );

        const liquid = new Liquid();
        const content = await liquid.parseAndRender(settingsLiquidTemplate, {
          projectType: 'monolith',
          templatesPath: relativeTemplatesPath || 'templates',
          sourceTemplate: actorInput.selectedTemplates[0],
        });

        const toolkitDir = path.join(actorInput.workspaceRoot, '.toolkit');
        const settingsPath = path.join(toolkitDir, 'settings.yaml');

        print.info('\nCreating .toolkit/settings.yaml...');
        await mkdir(toolkitDir, { recursive: true });
        await writeFile(settingsPath, content, { encoding: 'utf-8', flag: 'w' });
        print.success('.toolkit/settings.yaml created');
      }
    },
  ),

  /**
   * Detect coding agent automatically
   */
  detectCodingAgent: fromPromise(
    async ({ input: actorInput }: { input: { workspaceRoot: string } }) => {
      print.info('\nDetecting coding agent...');
      const detectedAgent = await CodingAgentService.detectCodingAgent(actorInput.workspaceRoot);

      if (detectedAgent) {
        print.success(`Detected ${detectedAgent} in workspace`);
      } else {
        print.info('No coding agent detected automatically');
      }

      return detectedAgent;
    },
  ),

  /**
   * Prompt for coding agent selection
   */
  promptCodingAgent: fromPromise(
    async ({ input: actorInput }: { input: { detectedAgent?: CodingAgent | null } }) => {
      // If already detected, use it
      if (actorInput.detectedAgent) {
        print.info(`Using detected coding agent: ${actorInput.detectedAgent}`);
        return actorInput.detectedAgent;
      }

      const agents = CodingAgentService.getAvailableAgents();

      print.divider();
      const selected = await select({
        message: 'Select coding agent for MCP configuration:',
        choices: agents.map((agent) => ({
          name: agent.name,
          value: agent.value,
          description: `\n  ${agent.description}`,
        })),
      });
      print.info(''); // Add spacing after prompt

      return selected;
    },
  ),

  /**
   * Configure MCP for coding agent
   */
  configureMCP: fromPromise(
    async ({
      input: actorInput,
    }: {
      input: { workspaceRoot: string; codingAgent: CodingAgent; selectedMcpServers?: string[] };
    }) => {
      const spinner = ora(`Setting up MCP for ${actorInput.codingAgent}...`).start();

      try {
        const codingAgentService = new CodingAgentService(actorInput.workspaceRoot);
        await codingAgentService.setupMCP(actorInput.codingAgent, actorInput.selectedMcpServers);
        spinner.succeed('MCP configuration completed');
      } catch (error) {
        spinner.fail('Failed to configure MCP');
        throw error;
      }
    },
  ),

  /**
   * Cleanup temporary files
   */
  cleanup: fromPromise(async ({ input }: { input: { tmpTemplatesPath?: string } }) => {
    if (input.tmpTemplatesPath) {
      const spinner = ora('Cleaning up temporary files...').start();
      try {
        const templateSelectionService = new TemplateSelectionService(input.tmpTemplatesPath);
        await templateSelectionService.cleanup();
        spinner.succeed('Cleaned up temporary files');
      } catch (_error) {
        spinner.warn('Could not clean up all temporary files');
      }
    }
  }),

  /**
   * Detect if spec tool is installed
   */
  detectSpecTool: fromPromise(async ({ input }: { input: { workspaceRoot: string } }) => {
    print.info('\nDetecting spec tools...');
    const specToolService = new SpecToolService(input.workspaceRoot);
    const detectedTool = await specToolService.detectSpecTool();

    if (detectedTool) {
      print.success(`Detected ${SPEC_TOOL_INFO[detectedTool].name} in workspace`);
    } else {
      print.info('No spec tool detected');
    }

    return detectedTool;
  }),

  /**
   * Prompt user about spec-driven approach
   */
  promptSpecDrivenApproach: fromPromise(
    async ({ input: actorInput }: { input: { detectedSpecTool: SpecTool | null } }) => {
      if (actorInput.detectedSpecTool) {
        // Already installed, ask if they want to update instructions
        print.divider();
        const result = await confirm({
          message: `${SPEC_TOOL_INFO[actorInput.detectedSpecTool].name} is installed. Would you like to update the agent instructions for spec-driven development?`,
          default: true,
        });
        print.info(''); // Add spacing after prompt
        return result;
      }

      // Not installed, ask if they want to install
      print.divider();
      const result = await confirm({
        message:
          'Would you like to install OpenSpec for spec-driven development? This helps AI assistants agree on what to build before writing code.',
        default: false,
      });
      print.info(''); // Add spacing after prompt
      return result;
    },
  ),

  /**
   * Setup spec tool (init or update)
   */
  setupSpec: fromPromise(
    async ({
      input,
    }: {
      input: {
        workspaceRoot: string;
        isAlreadyInstalled: boolean;
        selectedMcpServers?: string[];
        codingAgent?: CodingAgent;
        projectType?: ProjectType;
      };
    }) => {
      // Create CodingAgentService for updating custom instructions
      const codingAgentService = new CodingAgentService(input.workspaceRoot);

      // Create SpecToolService with CodingAgentService dependency
      const specToolService = new SpecToolService(
        input.workspaceRoot,
        SpecTool.OPENSPEC,
        codingAgentService,
      );

      if (input.isAlreadyInstalled) {
        const spinner = ora('Updating OpenSpec agent instructions...').start();
        try {
          // Update existing installation - generate prompt based on enabled MCPs
          const enabledMcps = {
            scaffoldMcp: input.selectedMcpServers?.includes(MCPServer.SCAFFOLD) ?? false,
            architectMcp: input.selectedMcpServers?.includes(MCPServer.ARCHITECT) ?? false,
            projectType: input.projectType,
          };

          // Update instructions and automatically append to coding agent config
          await specToolService.updateInstructions(enabledMcps, input.codingAgent);
          spinner.succeed('OpenSpec agent instructions updated');
        } catch (error) {
          spinner.fail('Failed to update OpenSpec instructions');
          throw error;
        }
      } else {
        // Show spinner briefly, then stop for interactive initialization
        const spinner = ora('Initializing OpenSpec...').start();

        // Stop spinner after 1 second to allow interactive CLI
        await new Promise((resolve) => setTimeout(resolve, 1000));
        spinner.stop();

        try {
          // Initialize new installation (interactive)
          await specToolService.initializeSpec();
          print.success('OpenSpec initialized successfully');
        } catch (error) {
          print.error('Failed to initialize OpenSpec');
          throw error;
        }
      }
    },
  ),

  /**
   * Prompt user to update spec instructions after new installation
   */
  promptSpecInstructions: fromPromise(async () => {
    print.divider();
    const result = await confirm({
      message: 'Would you like to update the agent instructions with OpenSpec workflow guidance?',
      default: true,
    });
    print.info(''); // Add spacing after prompt
    return result;
  }),

  /**
   * Update spec instructions
   */
  updateSpecInstructions: fromPromise(
    async ({
      input,
    }: {
      input: {
        workspaceRoot: string;
        selectedMcpServers?: string[];
        codingAgent?: CodingAgent;
        projectType?: ProjectType;
      };
    }) => {
      const spinner = ora('Updating OpenSpec agent instructions...').start();

      try {
        const codingAgentService = new CodingAgentService(input.workspaceRoot);
        const specToolService = new SpecToolService(
          input.workspaceRoot,
          SpecTool.OPENSPEC,
          codingAgentService,
        );

        // Update instructions with enabled MCPs
        const enabledMcps = {
          scaffoldMcp: input.selectedMcpServers?.includes(MCPServer.SCAFFOLD) ?? false,
          architectMcp: input.selectedMcpServers?.includes(MCPServer.ARCHITECT) ?? false,
          projectType: input.projectType,
        };

        await specToolService.updateInstructions(enabledMcps, input.codingAgent);
        spinner.succeed('OpenSpec agent instructions updated');
      } catch (error) {
        spinner.fail('Failed to update OpenSpec instructions');
        throw error;
      }
    },
  ),
};

/**
 * Init command - improved V2 implementation
 */
export const initCommand = new Command('init')
  .description('Initialize project with templates and MCP configuration')
  .option('--name <name>', 'Project name (for new projects)')
  .option('--project-type <type>', 'Project type: monolith or monorepo (for new projects)')
  .option('--skip-templates', 'Skip template download and selection')
  .option('--skip-mcp', 'Skip MCP configuration')
  .action(async (options) => {
    try {
      // Create and start the actor
      const actor = createActor(
        initMachine.provide({
          actors: initActors,
        }),
        {
          input: {
            options: {
              name: options.name,
              projectType: options.projectType,
              skipTemplates: options.skipTemplates || false,
              skipMcp: options.skipMcp || false,
            },
          } as InitMachineInput,
        },
      );

      // Start the actor
      actor.start();

      // Wait for completion
      await new Promise<void>((resolve, reject) => {
        const subscription = actor.subscribe((state) => {
          // Uncomment for debugging:
          // console.log('Current state:', state.value);

          if (state.matches('completed')) {
            subscription.unsubscribe();
            resolve();
          } else if (state.matches('failed')) {
            subscription.unsubscribe();
            reject(new Error(state.context.error?.message || 'Unknown error'));
          }
        });
      });

      // Get final context for display
      const finalState = actor.getSnapshot();
      const { templatesPath, projectType } = finalState.context;

      // Display final information
      print.header('\nSetup Complete!');
      if (templatesPath) {
        print.info(`Templates location: ${templatesPath}`);
      }
      if (projectType) {
        print.info(`Project type: ${projectType}`);
      }

      // Display congratulations message with gradient
      const gradient = await import('gradient-string');
      print.newline();
      console.log(
        gradient.default.pastel.multiline('🎉 Congratulations! Your project is ready to go!'),
      );
      print.newline();
    } catch (error) {
      print.error(`\nError: ${(error as Error).message}`);
      process.exit(1);
    }
  });
