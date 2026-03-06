/**
 * MCP Server Setup
 *
 * DESIGN PATTERNS:
 * - Factory pattern for server creation
 * - Tool registration pattern
 *
 * CODING STANDARDS:
 * - Register all tools, resources, and prompts here
 * - Keep server setup modular and extensible
 * - Import tools from ../tools/ and register them in the handlers
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Import Tool classes
import {
  GetCSSClassesTool,
  GetComponentVisualTool,
  ListAppComponentsTool,
  ListSharedComponentsTool,
  ListThemesTool,
} from '../tools';
import type { ToolDefinition } from '../types';

const TOOL_CAPABILITIES_META_KEY = 'agiflowai/capabilities';

function withCapabilities(definition: ToolDefinition, capabilities: string[]): ToolDefinition {
  return {
    ...definition,
    _meta: {
      ...definition._meta,
      [TOOL_CAPABILITIES_META_KEY]: capabilities,
    },
  };
}

export function createServer(themePath = 'packages/frontend/web-theme/src/agimon-theme.css'): Server {
  const server = new Server(
    {
      name: 'style-system-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
      instructions:
        'Use this MCP when you work on the frontend or design. You can use this to list supported themes, get the correct tailwind classes supported by the repo, list design system components, and get visual + detailed implementation of components.',
    },
  );

  // Initialize tools
  const listThemesTool = new ListThemesTool();
  const getCSSClassesTool = new GetCSSClassesTool(themePath);
  const getComponentVisualTool = new GetComponentVisualTool();
  const listSharedComponentsTool = new ListSharedComponentsTool();
  const listAppComponentsTool = new ListAppComponentsTool();

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = [
      withCapabilities(listThemesTool.getDefinition(), ['themes', 'design-system', 'styling']),
      withCapabilities(getCSSClassesTool.getDefinition(), [
        'css',
        'tailwind',
        'design-system',
        'styling',
      ]),
      withCapabilities(getComponentVisualTool.getDefinition(), [
        'components',
        'visual-preview',
        'design-review',
      ]),
      withCapabilities(listSharedComponentsTool.getDefinition(), [
        'components',
        'design-system',
        'component-discovery',
      ]),
      withCapabilities(listAppComponentsTool.getDefinition(), [
        'components',
        'app-components',
        'component-discovery',
      ]),
    ];

    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Route to appropriate tool based on name
    if (name === ListThemesTool.TOOL_NAME) {
      return await listThemesTool.execute({} as any);
    }

    if (name === GetCSSClassesTool.TOOL_NAME) {
      return await getCSSClassesTool.execute(args as any);
    }

    if (name === GetComponentVisualTool.TOOL_NAME) {
      return await getComponentVisualTool.execute(args as any);
    }

    if (name === ListSharedComponentsTool.TOOL_NAME) {
      return await listSharedComponentsTool.execute({} as any);
    }

    if (name === ListAppComponentsTool.TOOL_NAME) {
      return await listAppComponentsTool.execute(args as any);
    }

    return {
      content: [
        {
          type: 'text',
          text: `Error: Unknown tool: ${name}`,
        },
      ],
      isError: true,
    };
  });

  return server;
}
