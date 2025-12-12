import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DescribeToolsTool } from '../../src/tools/DescribeToolsTool';
import type { McpClientManagerService } from '../../src/services/McpClientManagerService';
import type { SkillService } from '../../src/services/SkillService';
import type { McpClientConnection, Skill, PromptConfig } from '../../src/types';

/**
 * Text content shape returned by tool execution
 */
interface TextContent {
  type: string;
  text: string;
}

/**
 * Type guard to check if a value is a TextContent object
 */
function isTextContent(value: unknown): value is TextContent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'text' in value &&
    typeof (value as TextContent).type === 'string' &&
    typeof (value as TextContent).text === 'string'
  );
}

/**
 * Helper to extract text from tool result content
 */
function getTextFromResult(result: { content: unknown[] }): string {
  const content = result.content[0];
  if (!isTextContent(content)) {
    throw new Error('Expected TextContent in result');
  }
  return content.text;
}

/**
 * Tool definition shape for mock clients
 */
interface MockToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

/**
 * Options for creating mock clients
 */
interface MockClientOptions {
  serverInstruction?: string;
  toolBlacklist?: string[];
  omitToolDescription?: boolean;
}

/**
 * Creates a mock MCP client connection
 */
function createMockClient(
  serverName: string,
  tools: MockToolDefinition[],
  options: MockClientOptions = {}
): McpClientConnection {
  return {
    serverName,
    serverInstruction: options.serverInstruction,
    toolBlacklist: options.toolBlacklist,
    omitToolDescription: options.omitToolDescription,
    transport: 'stdio',
    listTools: vi.fn().mockResolvedValue(
      tools.map((t) => ({
        name: t.name,
        description: t.description || `Description for ${t.name}`,
        inputSchema: t.inputSchema || { type: 'object', properties: {} },
      }))
    ),
    listResources: vi.fn().mockResolvedValue([]),
    listPrompts: vi.fn().mockResolvedValue([]),
    callTool: vi.fn(),
    readResource: vi.fn(),
    getPrompt: vi.fn(),
    close: vi.fn(),
  };
}

/**
 * Creates a mock MCP client connection with prompt-based skill configuration
 */
function createMockClientWithPrompts(
  serverName: string,
  tools: MockToolDefinition[],
  prompts: Record<string, PromptConfig>,
  options: MockClientOptions = {}
): McpClientConnection {
  return {
    serverName,
    serverInstruction: options.serverInstruction,
    toolBlacklist: options.toolBlacklist,
    omitToolDescription: options.omitToolDescription,
    prompts,
    transport: 'stdio',
    listTools: vi.fn().mockResolvedValue(
      tools.map((t) => ({
        name: t.name,
        description: t.description || `Description for ${t.name}`,
        inputSchema: t.inputSchema || { type: 'object', properties: {} },
      }))
    ),
    listResources: vi.fn().mockResolvedValue([]),
    listPrompts: vi.fn().mockResolvedValue([]),
    callTool: vi.fn(),
    readResource: vi.fn(),
    getPrompt: vi.fn().mockImplementation((promptName: string) => {
      return Promise.resolve({
        messages: [
          {
            role: 'user',
            content: { type: 'text', text: `Instructions for prompt: ${promptName}` },
          },
        ],
      });
    }),
    close: vi.fn(),
  };
}

/**
 * Creates a mock skill
 */
function createMockSkill(
  name: string,
  description: string,
  location: 'project' | 'user' = 'project'
): Skill {
  return {
    name,
    description,
    location,
    content: `# ${name} skill content`,
    basePath: `/path/to/${name}`,
  };
}

describe('DescribeToolsTool', () => {
  let mockClientManager: McpClientManagerService;
  let mockSkillService: SkillService;

  beforeEach(() => {
    mockClientManager = {
      getAllClients: vi.fn().mockReturnValue([]),
      getClient: vi.fn(),
      addClient: vi.fn(),
      removeClient: vi.fn(),
    } as unknown as McpClientManagerService;

    mockSkillService = {
      getSkills: vi.fn().mockResolvedValue([]),
      getSkill: vi.fn(),
      clearCache: vi.fn(),
    } as unknown as SkillService;
  });

  describe('constructor', () => {
    it('should create instance with client manager only', () => {
      const tool = new DescribeToolsTool(mockClientManager);
      expect(tool).toBeDefined();
    });

    it('should create instance with client manager and skill service', () => {
      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      expect(tool).toBeDefined();
    });
  });

  describe('getDefinition', () => {
    it('should return tool definition with correct name', async () => {
      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const definition = await tool.getDefinition();

      expect(definition.name).toBe('describe_tools');
      expect(definition.inputSchema).toBeDefined();
      expect(definition.inputSchema.properties.toolNames).toBeDefined();
    });

    it('should include MCP servers in description', async () => {
      const mockClient = createMockClient('test-server', [
        { name: 'tool_one', description: 'First tool' },
        { name: 'tool_two', description: 'Second tool' },
      ]);

      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient]);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const definition = await tool.getDefinition();

      expect(definition.description).toContain('test-server');
      expect(definition.description).toContain('tool_one');
      expect(definition.description).toContain('tool_two');
    });

    it('should include skills in description when available', async () => {
      vi.mocked(mockSkillService.getSkills).mockResolvedValue([
        createMockSkill('pdf-generator', 'Generate PDF documents'),
        createMockSkill('code-reviewer', 'Review code changes'),
      ]);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const definition = await tool.getDefinition();

      expect(definition.description).toContain('pdf-generator');
      expect(definition.description).toContain('code-reviewer');
    });

    it('should prefix tool names when they clash across servers', async () => {
      const mockClient1 = createMockClient('server-a', [
        { name: 'shared_tool', description: 'Tool from server A' },
      ]);
      const mockClient2 = createMockClient('server-b', [
        { name: 'shared_tool', description: 'Tool from server B' },
      ]);

      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient1, mockClient2]);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const definition = await tool.getDefinition();

      expect(definition.description).toContain('server-a__shared_tool');
      expect(definition.description).toContain('server-b__shared_tool');
    });

    it('should not prefix unique tool names', async () => {
      const mockClient1 = createMockClient('server-a', [{ name: 'unique_tool_a' }]);
      const mockClient2 = createMockClient('server-b', [{ name: 'unique_tool_b' }]);

      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient1, mockClient2]);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const definition = await tool.getDefinition();

      expect(definition.description).toContain('unique_tool_a');
      expect(definition.description).toContain('unique_tool_b');
      expect(definition.description).not.toContain('server-a__unique_tool_a');
      expect(definition.description).not.toContain('server-b__unique_tool_b');
    });
  });

  describe('skill prefix behavior', () => {
    it('should NOT prefix skills when they do not clash with MCP tools', async () => {
      vi.mocked(mockSkillService.getSkills).mockResolvedValue([
        createMockSkill('unique-skill', 'A unique skill'),
      ]);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const definition = await tool.getDefinition();

      expect(definition.description).toContain('unique-skill');
      expect(definition.description).not.toContain('skill__unique-skill');
    });

    it('should prefix skills when they clash with MCP tool names', async () => {
      const mockClient = createMockClient('test-server', [
        { name: 'shared-name', description: 'MCP tool' },
      ]);

      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient]);
      vi.mocked(mockSkillService.getSkills).mockResolvedValue([
        createMockSkill('shared-name', 'Skill with same name as tool'),
      ]);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const definition = await tool.getDefinition();

      // The skill should be prefixed since it clashes with an MCP tool
      expect(definition.description).toContain('skill__shared-name');
    });

    it('should NOT prefix skills when multiple skills have the same name (first wins)', async () => {
      vi.mocked(mockSkillService.getSkills).mockResolvedValue([
        createMockSkill('duplicate-skill', 'First duplicate skill', 'project'),
        createMockSkill('duplicate-skill', 'Second duplicate skill', 'user'),
      ]);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const definition = await tool.getDefinition();

      // Skills are de-duplicated (first wins) and NOT prefixed since no MCP tool clash
      expect(definition.description).toContain('name="duplicate-skill"');
      expect(definition.description).not.toContain('skill__duplicate-skill');
    });

    it('should handle mix of clashing and non-clashing skills', async () => {
      const mockClient = createMockClient('test-server', [
        { name: 'tool-name', description: 'MCP tool' },
      ]);

      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient]);
      vi.mocked(mockSkillService.getSkills).mockResolvedValue([
        createMockSkill('tool-name', 'Clashing skill'),
        createMockSkill('unique-skill', 'Non-clashing skill'),
      ]);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const definition = await tool.getDefinition();

      // Clashing skill should be prefixed
      expect(definition.description).toContain('skill__tool-name');
      // Non-clashing skill should NOT be prefixed
      expect(definition.description).toContain('unique-skill');
      expect(definition.description).not.toContain('skill__unique-skill');
    });
  });

  describe('execute', () => {
    it('should return error when no tool names provided', async () => {
      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const result = await tool.execute({ toolNames: [] });

      expect(result.isError).toBe(true);
      expect(result.content[0]).toHaveProperty('text');
    });

    it('should return tool descriptions for valid tool names', async () => {
      const mockClient = createMockClient('test-server', [
        {
          name: 'my_tool',
          description: 'My tool description',
          inputSchema: { type: 'object', properties: { arg1: { type: 'string' } } },
        },
      ]);

      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient]);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const result = await tool.execute({ toolNames: ['my_tool'] });

      expect(result.isError).toBeUndefined();
      const text = getTextFromResult(result);
      const parsed = JSON.parse(text);
      expect(parsed.tools).toHaveLength(1);
      expect(parsed.tools[0].tool.name).toBe('my_tool');
    });

    it('should return skill descriptions for skill__ prefixed names', async () => {
      vi.mocked(mockSkillService.getSkill).mockResolvedValue(
        createMockSkill('my-skill', 'My skill description')
      );

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const result = await tool.execute({ toolNames: ['skill__my-skill'] });

      expect(result.isError).toBeUndefined();
      const text = getTextFromResult(result);
      const parsed = JSON.parse(text);
      expect(parsed.skills).toHaveLength(1);
      expect(parsed.skills[0].name).toBe('my-skill');
    });

    it('should return skill descriptions for plain skill names (without skill__ prefix)', async () => {
      vi.mocked(mockSkillService.getSkill).mockResolvedValue(
        createMockSkill('my-skill', 'My skill description')
      );

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const result = await tool.execute({ toolNames: ['my-skill'] });

      expect(result.isError).toBeUndefined();
      const text = getTextFromResult(result);
      const parsed = JSON.parse(text);
      expect(parsed.skills).toHaveLength(1);
      expect(parsed.skills[0].name).toBe('my-skill');
    });

    it('should return notFound for unknown tools', async () => {
      vi.mocked(mockClientManager.getAllClients).mockReturnValue([]);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const result = await tool.execute({ toolNames: ['unknown_tool'] });

      expect(result.isError).toBe(true);
    });

    it('should handle mixed valid and invalid tool names', async () => {
      const mockClient = createMockClient('test-server', [
        { name: 'valid_tool', description: 'Valid tool' },
      ]);

      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient]);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const result = await tool.execute({ toolNames: ['valid_tool', 'invalid_tool'] });

      const text = getTextFromResult(result);
      const parsed = JSON.parse(text);
      expect(parsed.tools).toHaveLength(1);
      expect(parsed.notFound).toContain('invalid_tool');
    });

    it('should handle server-prefixed tool names', async () => {
      const mockClient = createMockClient('my-server', [
        { name: 'my_tool', description: 'Tool description' },
      ]);

      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient]);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const result = await tool.execute({ toolNames: ['my-server__my_tool'] });

      expect(result.isError).toBeUndefined();
      const text = getTextFromResult(result);
      const parsed = JSON.parse(text);
      expect(parsed.tools).toHaveLength(1);
      expect(parsed.tools[0].server).toBe('my-server');
    });
  });

  describe('error handling', () => {
    it('should handle client listTools errors gracefully', async () => {
      const mockClient = {
        serverName: 'failing-server',
        transport: 'stdio',
        listTools: vi.fn().mockRejectedValue(new Error('Connection failed')),
        listResources: vi.fn().mockResolvedValue([]),
        listPrompts: vi.fn().mockResolvedValue([]),
        callTool: vi.fn(),
        readResource: vi.fn(),
        getPrompt: vi.fn(),
        close: vi.fn(),
      } as unknown as McpClientConnection;

      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient]);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      // Should not throw, should handle error gracefully
      const definition = await tool.getDefinition();
      expect(definition).toBeDefined();
    });

    it('should filter out blacklisted tools', async () => {
      const mockClient = createMockClient(
        'test-server',
        [
          { name: 'allowed_tool', description: 'Allowed' },
          { name: 'blocked_tool', description: 'Blocked' },
        ],
        { toolBlacklist: ['blocked_tool'] }
      );

      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient]);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const definition = await tool.getDefinition();

      expect(definition.description).toContain('allowed_tool');
      expect(definition.description).not.toContain('blocked_tool');
    });
  });

  describe('prompt-based skills', () => {
    it('should include prompt-based skills in getDefinition', async () => {
      const mockClient = createMockClientWithPrompts(
        'test-server',
        [{ name: 'my_tool' }],
        {
          'code-review': {
            skill: {
              name: 'code-reviewer',
              description: 'Review code for best practices',
            },
          },
        }
      );

      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient]);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const definition = await tool.getDefinition();

      expect(definition.description).toContain('code-reviewer');
      expect(definition.description).toContain('Review code for best practices');
    });

    it('should return prompt-based skill content when executing with skill__ prefix', async () => {
      const mockClient = createMockClientWithPrompts(
        'test-server',
        [],
        {
          'code-review': {
            skill: {
              name: 'code-reviewer',
              description: 'Review code for best practices',
            },
          },
        }
      );

      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient]);
      vi.mocked(mockClientManager.getClient).mockReturnValue(mockClient);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const result = await tool.execute({ toolNames: ['skill__code-reviewer'] });

      expect(result.isError).toBeUndefined();
      const text = getTextFromResult(result);
      const parsed = JSON.parse(text);
      expect(parsed.skills).toHaveLength(1);
      expect(parsed.skills[0].name).toBe('code-reviewer');
      expect(parsed.skills[0].instructions).toContain('Instructions for prompt: code-review');
      // Should include command message prefix
      expect(parsed.skills[0].instructions).toContain('<command-message>The "code-reviewer" skill is loading</command-message>');
    });

    it('should return prompt-based skill content when executing with plain name', async () => {
      const mockClient = createMockClientWithPrompts(
        'test-server',
        [],
        {
          'doc-gen': {
            skill: {
              name: 'doc-generator',
              description: 'Generate documentation',
            },
          },
        }
      );

      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient]);
      vi.mocked(mockClientManager.getClient).mockReturnValue(mockClient);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const result = await tool.execute({ toolNames: ['doc-generator'] });

      expect(result.isError).toBeUndefined();
      const text = getTextFromResult(result);
      const parsed = JSON.parse(text);
      expect(parsed.skills).toHaveLength(1);
      expect(parsed.skills[0].name).toBe('doc-generator');
    });

    it('should include folder path in location when configured', async () => {
      const mockClient = createMockClientWithPrompts(
        'test-server',
        [],
        {
          'code-review': {
            skill: {
              name: 'code-reviewer',
              description: 'Review code',
              folder: './prompts/code-review',
            },
          },
        }
      );

      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient]);
      vi.mocked(mockClientManager.getClient).mockReturnValue(mockClient);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const result = await tool.execute({ toolNames: ['skill__code-reviewer'] });

      const text = getTextFromResult(result);
      const parsed = JSON.parse(text);
      expect(parsed.skills[0].location).toBe('./prompts/code-review');
    });

    it('should use prompt reference in location when folder not configured', async () => {
      const mockClient = createMockClientWithPrompts(
        'my-server',
        [],
        {
          'my-prompt': {
            skill: {
              name: 'my-skill',
              description: 'My skill description',
            },
          },
        }
      );

      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient]);
      vi.mocked(mockClientManager.getClient).mockReturnValue(mockClient);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const result = await tool.execute({ toolNames: ['skill__my-skill'] });

      const text = getTextFromResult(result);
      const parsed = JSON.parse(text);
      expect(parsed.skills[0].location).toBe('prompt:my-server/my-prompt');
    });

    it('should handle getPrompt errors gracefully', async () => {
      const mockClient = createMockClientWithPrompts(
        'test-server',
        [],
        {
          'failing-prompt': {
            skill: {
              name: 'failing-skill',
              description: 'This skill will fail',
            },
          },
        }
      );
      // Override getPrompt to throw an error
      mockClient.getPrompt = vi.fn().mockRejectedValue(new Error('Connection failed'));

      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient]);
      vi.mocked(mockClientManager.getClient).mockReturnValue(mockClient);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const result = await tool.execute({ toolNames: ['skill__failing-skill'] });

      // Should return not found since the prompt fetch failed
      expect(result.isError).toBe(true);
    });

    it('should handle client not found for prompt-based skill', async () => {
      const mockClient = createMockClientWithPrompts(
        'test-server',
        [],
        {
          'my-prompt': {
            skill: {
              name: 'orphan-skill',
              description: 'Skill with missing client',
            },
          },
        }
      );

      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient]);
      // Return undefined to simulate client not found
      vi.mocked(mockClientManager.getClient).mockReturnValue(undefined);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const result = await tool.execute({ toolNames: ['skill__orphan-skill'] });

      expect(result.isError).toBe(true);
    });
  });

  describe('interaction between file-based and prompt-based skills', () => {
    it('should combine file-based and prompt-based skills in getDefinition', async () => {
      // Set up file-based skill
      vi.mocked(mockSkillService.getSkills).mockResolvedValue([
        createMockSkill('file-skill', 'A file-based skill'),
      ]);

      // Set up prompt-based skill
      const mockClient = createMockClientWithPrompts('test-server', [], {
        'prompt-skill-def': {
          skill: {
            name: 'prompt-skill',
            description: 'A prompt-based skill',
          },
        },
      });
      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient]);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const definition = await tool.getDefinition();

      expect(definition.description).toContain('file-skill');
      expect(definition.description).toContain('prompt-skill');
    });

    it('should prefer file-based skill over prompt-based skill with same name', async () => {
      // Set up file-based skill
      vi.mocked(mockSkillService.getSkills).mockResolvedValue([
        createMockSkill('shared-skill', 'File-based version'),
      ]);
      vi.mocked(mockSkillService.getSkill).mockResolvedValue(
        createMockSkill('shared-skill', 'File-based version')
      );

      // Set up prompt-based skill with same name
      const mockClient = createMockClientWithPrompts('test-server', [], {
        'shared-prompt': {
          skill: {
            name: 'shared-skill',
            description: 'Prompt-based version',
          },
        },
      });
      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient]);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const result = await tool.execute({ toolNames: ['skill__shared-skill'] });

      const text = getTextFromResult(result);
      const parsed = JSON.parse(text);
      expect(parsed.skills).toHaveLength(1);
      // File-based skill is checked first, so it should be returned
      expect(parsed.skills[0].location).toBe('/path/to/shared-skill');
    });

    it('should fall back to prompt-based skill when file-based skill not found', async () => {
      // No file-based skill
      vi.mocked(mockSkillService.getSkills).mockResolvedValue([]);
      vi.mocked(mockSkillService.getSkill).mockResolvedValue(undefined);

      // Set up prompt-based skill
      const mockClient = createMockClientWithPrompts('test-server', [], {
        'fallback-prompt': {
          skill: {
            name: 'fallback-skill',
            description: 'Fallback prompt-based skill',
          },
        },
      });
      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient]);
      vi.mocked(mockClientManager.getClient).mockReturnValue(mockClient);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const result = await tool.execute({ toolNames: ['skill__fallback-skill'] });

      expect(result.isError).toBeUndefined();
      const text = getTextFromResult(result);
      const parsed = JSON.parse(text);
      expect(parsed.skills).toHaveLength(1);
      expect(parsed.skills[0].name).toBe('fallback-skill');
      expect(parsed.skills[0].location).toContain('prompt:');
    });

    it('should NOT prefix skill names when they only clash with each other (first wins)', async () => {
      // File-based skill and prompt-based skill with same name
      vi.mocked(mockSkillService.getSkills).mockResolvedValue([
        createMockSkill('duplicate-name', 'File-based duplicate'),
      ]);

      const mockClient = createMockClientWithPrompts('test-server', [], {
        'duplicate-prompt': {
          skill: {
            name: 'duplicate-name',
            description: 'Prompt-based duplicate',
          },
        },
      });
      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient]);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const definition = await tool.getDefinition();

      // Skills are de-duplicated (file-based wins) and NOT prefixed since no MCP tool clash
      expect(definition.description).toContain('name="duplicate-name"');
      expect(definition.description).not.toContain('skill__duplicate-name');
    });
  });

  describe('prompt name collision with file-based skill', () => {
    it('should handle collision where file skill and prompt skill have same name (first wins, no prefix)', async () => {
      // Set up file-based skill
      vi.mocked(mockSkillService.getSkills).mockResolvedValue([
        createMockSkill('pdf', 'Generate PDF documents from file'),
      ]);

      // Set up prompt-based skill with same name
      const mockClient = createMockClientWithPrompts('doc-server', [], {
        'pdf-prompt': {
          skill: {
            name: 'pdf',
            description: 'Generate PDF documents from prompt',
          },
        },
      });
      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient]);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const definition = await tool.getDefinition();

      // Skills are de-duplicated (file-based wins) and NOT prefixed since no MCP tool clash
      expect(definition.description).toContain('name="pdf"');
      expect(definition.description).not.toContain('skill__pdf');
      // Only one 'pdf' skill should appear (first wins)
      const matches = definition.description.match(/name="pdf"/g) || [];
      expect(matches.length).toBe(1);
    });

    it('should handle collision where prompt skill clashes with MCP tool name', async () => {
      // Set up MCP tool with name 'analyze'
      const mockClient: McpClientConnection = {
        serverName: 'test-server',
        prompts: {
          'analyze-prompt': {
            skill: {
              name: 'analyze',
              description: 'Analyze from prompt',
            },
          },
        },
        transport: 'stdio',
        listTools: vi.fn().mockResolvedValue([
          { name: 'analyze', description: 'Analyze tool', inputSchema: {} },
        ]),
        listResources: vi.fn().mockResolvedValue([]),
        listPrompts: vi.fn().mockResolvedValue([]),
        callTool: vi.fn(),
        readResource: vi.fn(),
        getPrompt: vi.fn().mockResolvedValue({
          messages: [{ role: 'user', content: { type: 'text', text: 'Analyze prompt' } }],
        }),
        close: vi.fn(),
      };

      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient]);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const definition = await tool.getDefinition();

      // The skill should be prefixed since it clashes with MCP tool
      expect(definition.description).toContain('name="skill__analyze"');
      // But the tool should NOT be prefixed (it's unique)
      expect(definition.description).toContain('name="analyze"');
    });

    it('should correctly handle collisions across file skills, prompt skills, and MCP tools', async () => {
      // Set up file-based skill
      vi.mocked(mockSkillService.getSkills).mockResolvedValue([
        createMockSkill('unique-file-skill', 'Unique file skill'),
        createMockSkill('shared-name', 'File skill with shared name'),
      ]);

      // Set up MCP client with tool and prompt skill
      const mockClient: McpClientConnection = {
        serverName: 'test-server',
        prompts: {
          'unique-prompt': {
            skill: {
              name: 'unique-prompt-skill',
              description: 'Unique prompt skill',
            },
          },
          'shared-prompt': {
            skill: {
              name: 'shared-name',
              description: 'Prompt skill with shared name',
            },
          },
        },
        transport: 'stdio',
        listTools: vi.fn().mockResolvedValue([
          { name: 'unique-tool', description: 'Unique tool', inputSchema: {} },
        ]),
        listResources: vi.fn().mockResolvedValue([]),
        listPrompts: vi.fn().mockResolvedValue([]),
        callTool: vi.fn(),
        readResource: vi.fn(),
        getPrompt: vi.fn().mockResolvedValue({
          messages: [{ role: 'user', content: { type: 'text', text: 'Content' } }],
        }),
        close: vi.fn(),
      };

      vi.mocked(mockClientManager.getAllClients).mockReturnValue([mockClient]);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const definition = await tool.getDefinition();

      // Unique names should NOT be prefixed
      expect(definition.description).toContain('name="unique-file-skill"');
      expect(definition.description).toContain('name="unique-prompt-skill"');
      expect(definition.description).toContain('name="unique-tool"');

      // Shared name between skills should NOT be prefixed (only MCP tool clashes trigger prefix)
      // File-based skill wins (first), prompt-based is de-duplicated
      expect(definition.description).toContain('name="shared-name"');
      expect(definition.description).not.toContain('skill__shared-name');
    });
  });
});
