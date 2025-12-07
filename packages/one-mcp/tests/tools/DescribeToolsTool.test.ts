import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DescribeToolsTool } from '../../src/tools/DescribeToolsTool';
import type { McpClientManagerService } from '../../src/services/McpClientManagerService';
import type { SkillService } from '../../src/services/SkillService';
import type { McpClientConnection, Skill } from '../../src/types';

/**
 * Creates a mock MCP client connection
 */
function createMockClient(
  serverName: string,
  tools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>,
  options: {
    serverInstruction?: string;
    toolBlacklist?: string[];
    omitToolDescription?: boolean;
  } = {}
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

    it('should prefix skills when multiple skills have the same name', async () => {
      vi.mocked(mockSkillService.getSkills).mockResolvedValue([
        createMockSkill('duplicate-skill', 'First duplicate skill', 'project'),
        createMockSkill('duplicate-skill', 'Second duplicate skill', 'user'),
      ]);

      const tool = new DescribeToolsTool(mockClientManager, mockSkillService);
      const definition = await tool.getDefinition();

      // Both skills should be prefixed since they clash with each other
      expect(definition.description).toContain('skill__duplicate-skill');
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
      const text = (result.content[0] as { type: string; text: string }).text;
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
      const text = (result.content[0] as { type: string; text: string }).text;
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
      const text = (result.content[0] as { type: string; text: string }).text;
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

      const text = (result.content[0] as { type: string; text: string }).text;
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
      const text = (result.content[0] as { type: string; text: string }).text;
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
});
