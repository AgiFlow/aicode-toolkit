import { TemplatesManagerService } from '@agiflowai/aicode-utils';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import packageJson from '../../package.json' assert { type: 'json' };
import serverInstructionsTemplate from '../instructions/server.md?raw';
import {
  GenerateBoilerplatePrompt,
  GenerateFeatureScaffoldPrompt,
  ScaffoldApplicationPrompt,
  ScaffoldFeaturePrompt,
} from '../prompts';
import { TemplateService } from '../services/TemplateService';
import {
  GenerateBoilerplateFileTool,
  GenerateBoilerplateTool,
  GenerateFeatureScaffoldTool,
  ListBoilerplatesTool,
  ListScaffoldingMethodsTool,
  UseBoilerplateTool,
  UseScaffoldMethodTool,
  WriteToFileTool,
} from '../tools';

export interface ServerOptions {
  adminEnabled?: boolean;
  isMonolith?: boolean;
  promptAsSkill?: boolean;
}

export function createServer(options: ServerOptions = {}) {
  const { adminEnabled = false, isMonolith = false, promptAsSkill = false } = options;

  // Find templates folder by searching upwards from current directory
  const templatesPath = TemplatesManagerService.findTemplatesPathSync();

  if (!templatesPath) {
    throw new Error(
      'Templates folder not found. Please create a "templates" folder in your workspace root, ' +
      'or specify "templatesPath" in toolkit.yaml to point to your templates directory.',
    );
  }

  // Initialize tools (conditional based on project type)
  const listBoilerplatesTool = !isMonolith ? new ListBoilerplatesTool(templatesPath, isMonolith) : null;
  const useBoilerplateTool = !isMonolith ? new UseBoilerplateTool(templatesPath, isMonolith) : null;
  const listScaffoldingMethodsTool = new ListScaffoldingMethodsTool(templatesPath, isMonolith);
  const useScaffoldMethodTool = new UseScaffoldMethodTool(templatesPath, isMonolith);
  const writeToFileTool = new WriteToFileTool();
  const generateBoilerplateTool = adminEnabled ? new GenerateBoilerplateTool(templatesPath, isMonolith) : null;
  const generateBoilerplateFileTool = adminEnabled
    ? new GenerateBoilerplateFileTool(templatesPath, isMonolith)
    : null;
  const generateFeatureScaffoldTool = adminEnabled
    ? new GenerateFeatureScaffoldTool(templatesPath, isMonolith)
    : null;

  // Initialize prompts (admin only)
  const generateBoilerplatePrompt = adminEnabled
    ? new GenerateBoilerplatePrompt({ isMonolith, promptAsSkill })
    : null;
  const generateFeatureScaffoldPrompt = adminEnabled
    ? new GenerateFeatureScaffoldPrompt({ isMonolith, promptAsSkill })
    : null;

  // Initialize user-facing prompts (always available)
  const scaffoldApplicationPrompt = new ScaffoldApplicationPrompt({ isMonolith, promptAsSkill });
  const scaffoldFeaturePrompt = new ScaffoldFeaturePrompt({ isMonolith, promptAsSkill });

  // Render instructions from template
  const templateService = new TemplateService();
  const instructions = templateService.renderString(serverInstructionsTemplate, {
    adminEnabled,
    isMonolith
  });

  const server = new Server(
    {
      name: 'scaffold-mcp',
      version: packageJson.version,
    },
    {
      instructions,
      capabilities: {
        tools: {},
        prompts: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Get tool definitions
    const listScaffoldingMethodsToolDef = listScaffoldingMethodsTool.getDefinition();
    const useScaffoldMethodToolDef = useScaffoldMethodTool.getDefinition();
    const writeToFileToolDef = writeToFileTool.getDefinition();

    const tools = [
      listScaffoldingMethodsToolDef,
      useScaffoldMethodToolDef,
      writeToFileToolDef,
    ];

    // Add boilerplate tools only for non-monolith projects
    if (!isMonolith) {
      if (listBoilerplatesTool) {
        tools.unshift(listBoilerplatesTool.getDefinition());
      }
      if (useBoilerplateTool) {
        tools.splice(1, 0, useBoilerplateTool.getDefinition());
      }
    }

    // Add admin tools if enabled
    if (adminEnabled) {
      if (generateBoilerplateTool) {
        tools.push(generateBoilerplateTool.getDefinition());
      }
      if (generateBoilerplateFileTool) {
        tools.push(generateBoilerplateFileTool.getDefinition());
      }
      if (generateFeatureScaffoldTool) {
        tools.push(generateFeatureScaffoldTool.getDefinition());
      }
    }

    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === ListBoilerplatesTool.TOOL_NAME) {
      if (isMonolith || !listBoilerplatesTool) {
        throw new Error('Boilerplate tools are not available for monolith projects');
      }
      return await listBoilerplatesTool.execute(args || {});
    }

    if (name === UseBoilerplateTool.TOOL_NAME) {
      if (isMonolith || !useBoilerplateTool) {
        throw new Error('Boilerplate tools are not available for monolith projects');
      }
      return await useBoilerplateTool.execute(args || {});
    }

    if (name === ListScaffoldingMethodsTool.TOOL_NAME) {
      return await listScaffoldingMethodsTool.execute(args || {});
    }

    if (name === UseScaffoldMethodTool.TOOL_NAME) {
      return await useScaffoldMethodTool.execute(args || {});
    }

    if (name === WriteToFileTool.TOOL_NAME) {
      return await writeToFileTool.execute(args || {});
    }

    if (name === GenerateBoilerplateTool.TOOL_NAME) {
      if (!adminEnabled || !generateBoilerplateTool) {
        throw new Error('Admin tools are not enabled. Use --admin-enable flag to enable.');
      }
      return await generateBoilerplateTool.execute(args as any);
    }

    if (name === GenerateBoilerplateFileTool.TOOL_NAME) {
      if (!adminEnabled || !generateBoilerplateFileTool) {
        throw new Error('Admin tools are not enabled. Use --admin-enable flag to enable.');
      }
      return await generateBoilerplateFileTool.execute(args as any);
    }

    if (name === GenerateFeatureScaffoldTool.TOOL_NAME) {
      if (!adminEnabled || !generateFeatureScaffoldTool) {
        throw new Error('Admin tools are not enabled. Use --admin-enable flag to enable.');
      }
      return await generateFeatureScaffoldTool.execute(args as any);
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  // Prompt handlers
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    const prompts = [];

    // User-facing prompts (always available)
    prompts.push(scaffoldApplicationPrompt.getDefinition());
    prompts.push(scaffoldFeaturePrompt.getDefinition());

    // Admin prompts (only in admin mode)
    if (adminEnabled) {
      if (generateBoilerplatePrompt) {
        prompts.push(generateBoilerplatePrompt.getDefinition());
      }

      if (generateFeatureScaffoldPrompt) {
        prompts.push(generateFeatureScaffoldPrompt.getDefinition());
      }
    }

    return { prompts };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // User-facing prompts (always available)
    if (name === ScaffoldApplicationPrompt.PROMPT_NAME) {
      return {
        messages: scaffoldApplicationPrompt.getMessages(args as any),
      };
    }

    if (name === ScaffoldFeaturePrompt.PROMPT_NAME) {
      return {
        messages: scaffoldFeaturePrompt.getMessages(args as any),
      };
    }

    // Admin prompts (only in admin mode)
    if (name === GenerateBoilerplatePrompt.PROMPT_NAME) {
      if (!generateBoilerplatePrompt) {
        throw new Error('Prompt not available');
      }
      return {
        messages: generateBoilerplatePrompt.getMessages(args as any),
      };
    }

    if (name === GenerateFeatureScaffoldPrompt.PROMPT_NAME) {
      if (!generateFeatureScaffoldPrompt) {
        throw new Error('Prompt not available');
      }
      return {
        messages: generateFeatureScaffoldPrompt.getMessages(args as any),
      };
    }

    throw new Error(`Unknown prompt: ${name}`);
  });

  return server;
}
