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
import { GetFileDesignPatternTool } from '../tools/GetFileDesignPatternTool';
import { ReviewCodeChangeTool } from '../tools/ReviewCodeChangeTool';
import { AddDesignPatternTool } from '../tools/AddDesignPatternTool';
import { AddRuleTool } from '../tools/AddRuleTool';
import type { LlmToolId } from '@agiflowai/coding-agent-bridge';

export function createServer(options?: {
  designPatternTool?: LlmToolId;
  reviewTool?: LlmToolId;
  adminEnabled?: boolean;
}): Server {
  const adminEnabled = options?.adminEnabled ?? false;

  // Build instructions based on admin mode
  const baseInstructions = `Use this MCP server to enforce design patterns and coding standards in your codebase.

## Workflow:

1. **Before Editing Files**: Use \`get-file-design-pattern\` to understand applicable patterns and rules
2. **After Editing Files**: Use \`review-code-change\` to check for violations and code smells

## AI Usage Guidelines:

- Always call \`get-file-design-pattern\` BEFORE editing a file to understand:
  - Project information and source template
  - Applicable design patterns from architect.yaml
  - Coding rules from RULES.yaml (must_do, should_do, must_not_do)
  - Code examples showing the patterns
- Always call \`review-code-change\` AFTER editing a file to check for:
  - Must not do violations (critical issues)
  - Must do missing (required patterns not followed)
  - Should do suggestions (best practices)
- Fix any violations found before proceeding to the next task
- The tools work with architect.yaml (project patterns) and RULES.yaml (coding rules) in your project`;

  const adminInstructions = adminEnabled
    ? `

## Admin Mode (Pattern Configuration):

When setting up or customizing design patterns and coding rules:

1. **Add Design Pattern**: Use \`add-design-pattern\` to register a new design pattern in architect.yaml
   - Specify pattern name, description, and glob patterns to match files
   - Add code examples demonstrating the pattern
   - Patterns are automatically applied to matching files

2. **Add Coding Rule**: Use \`add-rule\` to add a new coding rule in RULES.yaml
   - Specify rule category (must_do, should_do, must_not_do)
   - Add rule description and glob patterns
   - Include examples of good and bad code
   - Rules are enforced during code review

Example workflow:
\`\`\`
1. add-design-pattern { name: "service-pattern", description: "...", patterns: ["**/*Service.ts"], ... }
2. add-rule { category: "must_do", rule: "All services must implement error handling", patterns: ["**/*Service.ts"], ... }
3. get-file-design-pattern { filePath: "src/MyService.ts" } (verify pattern appears)
4. review-code-change { filePath: "src/MyService.ts" } (verify rule is enforced)
\`\`\`
`
    : '';

  const instructions = baseInstructions + adminInstructions;

  const server = new Server(
    {
      name: 'architect-mcp',
      version: '0.4.0',
    },
    {
      instructions,
      capabilities: {
        tools: {},
      },
    },
  );

  // Initialize core tools with optional LLM support
  const getFileDesignPatternTool = new GetFileDesignPatternTool({
    llmTool: options?.designPatternTool,
  });
  const reviewCodeChangeTool = new ReviewCodeChangeTool({ llmTool: options?.reviewTool });

  // Initialize admin tools if enabled
  const addDesignPatternTool = adminEnabled ? new AddDesignPatternTool() : null;
  const addRuleTool = adminEnabled ? new AddRuleTool() : null;

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = [getFileDesignPatternTool.getDefinition(), reviewCodeChangeTool.getDefinition()];

    // Add admin tools if enabled
    if (adminEnabled && addDesignPatternTool && addRuleTool) {
      tools.push(addDesignPatternTool.getDefinition());
      tools.push(addRuleTool.getDefinition());
    }

    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === GetFileDesignPatternTool.TOOL_NAME) {
      return await getFileDesignPatternTool.execute(args as any);
    }

    if (name === ReviewCodeChangeTool.TOOL_NAME) {
      return await reviewCodeChangeTool.execute(args as any);
    }

    // Admin tools
    if (adminEnabled) {
      if (name === AddDesignPatternTool.TOOL_NAME && addDesignPatternTool) {
        return await addDesignPatternTool.execute(args as any);
      }

      if (name === AddRuleTool.TOOL_NAME && addRuleTool) {
        return await addRuleTool.execute(args as any);
      }
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}
