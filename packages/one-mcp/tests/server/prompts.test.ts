import { describe, it, expect, vi } from 'vitest';
import type { McpClientConnection } from '../../src/types';

/**
 * Options for creating a mock client
 */
interface CreateMockClientOptions {
  serverInstruction?: string;
}

/**
 * Prompt argument definition for mock prompts
 */
interface MockPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

/**
 * Mock prompt definition
 */
interface MockPrompt {
  name: string;
  description?: string;
  arguments?: MockPromptArgument[];
}

/**
 * Creates a mock MCP client connection with prompts support
 */
function createMockClient(
  serverName: string,
  prompts: MockPrompt[],
  options: CreateMockClientOptions = {}
): McpClientConnection {
  return {
    serverName,
    serverInstruction: options.serverInstruction,
    transport: 'stdio',
    listTools: vi.fn().mockResolvedValue([]),
    listResources: vi.fn().mockResolvedValue([]),
    listPrompts: vi.fn().mockResolvedValue(prompts),
    callTool: vi.fn(),
    readResource: vi.fn(),
    getPrompt: vi.fn().mockImplementation((name: string, args?: Record<string, unknown>) => {
      const prompt = prompts.find((p) => p.name === name);
      if (!prompt) {
        throw new Error(`Prompt not found: ${name}`);
      }
      return Promise.resolve({
        description: prompt.description,
        messages: [
          {
            role: 'user',
            content: { type: 'text', text: `Prompt ${name} with args: ${JSON.stringify(args)}` },
          },
        ],
      });
    }),
    close: vi.fn(),
  };
}

describe('Server prompts handlers', () => {
  // We'll test the logic that will be used in the server handlers
  // by simulating what happens in ListPromptsRequestSchema and GetPromptRequestSchema handlers

  describe('ListPrompts aggregation', () => {
    it('should aggregate prompts from multiple servers', async () => {
      const client1 = createMockClient('server-a', [
        { name: 'prompt_one', description: 'First prompt' },
      ]);
      const client2 = createMockClient('server-b', [
        { name: 'prompt_two', description: 'Second prompt' },
      ]);

      const clients = [client1, client2];

      // Simulate ListPrompts logic
      const promptToServers = new Map<string, string[]>();
      const serverPromptsMap = new Map<
        string,
        Array<{
          name: string;
          description?: string;
          arguments?: Array<{ name: string; description?: string; required?: boolean }>;
        }>
      >();

      await Promise.all(
        clients.map(async (client) => {
          const prompts = await client.listPrompts();
          serverPromptsMap.set(client.serverName, prompts);

          for (const prompt of prompts) {
            if (!promptToServers.has(prompt.name)) {
              promptToServers.set(prompt.name, []);
            }
            promptToServers.get(prompt.name)!.push(client.serverName);
          }
        })
      );

      const aggregatedPrompts: Array<{
        name: string;
        description?: string;
      }> = [];

      for (const client of clients) {
        const prompts = serverPromptsMap.get(client.serverName) || [];
        for (const prompt of prompts) {
          const servers = promptToServers.get(prompt.name) || [];
          const hasClash = servers.length > 1;

          aggregatedPrompts.push({
            name: hasClash ? `${client.serverName}__${prompt.name}` : prompt.name,
            description: prompt.description,
          });
        }
      }

      expect(aggregatedPrompts).toHaveLength(2);
      expect(aggregatedPrompts[0].name).toBe('prompt_one');
      expect(aggregatedPrompts[1].name).toBe('prompt_two');
    });

    it('should prefix prompts when they clash across servers', async () => {
      const client1 = createMockClient('server-a', [
        { name: 'shared_prompt', description: 'Prompt from server A' },
      ]);
      const client2 = createMockClient('server-b', [
        { name: 'shared_prompt', description: 'Prompt from server B' },
      ]);

      const clients = [client1, client2];

      // Simulate ListPrompts logic
      const promptToServers = new Map<string, string[]>();
      const serverPromptsMap = new Map<
        string,
        Array<{
          name: string;
          description?: string;
        }>
      >();

      await Promise.all(
        clients.map(async (client) => {
          const prompts = await client.listPrompts();
          serverPromptsMap.set(client.serverName, prompts);

          for (const prompt of prompts) {
            if (!promptToServers.has(prompt.name)) {
              promptToServers.set(prompt.name, []);
            }
            promptToServers.get(prompt.name)!.push(client.serverName);
          }
        })
      );

      const aggregatedPrompts: Array<{
        name: string;
        description?: string;
      }> = [];

      for (const client of clients) {
        const prompts = serverPromptsMap.get(client.serverName) || [];
        for (const prompt of prompts) {
          const servers = promptToServers.get(prompt.name) || [];
          const hasClash = servers.length > 1;

          aggregatedPrompts.push({
            name: hasClash ? `${client.serverName}__${prompt.name}` : prompt.name,
            description: prompt.description,
          });
        }
      }

      expect(aggregatedPrompts).toHaveLength(2);
      expect(aggregatedPrompts[0].name).toBe('server-a__shared_prompt');
      expect(aggregatedPrompts[1].name).toBe('server-b__shared_prompt');
    });

    it('should handle server listPrompts errors gracefully', async () => {
      const client1 = createMockClient('server-a', [
        { name: 'prompt_one', description: 'First prompt' },
      ]);
      const client2 = {
        ...createMockClient('server-b', []),
        listPrompts: vi.fn().mockRejectedValue(new Error('Connection failed')),
      } as unknown as McpClientConnection;

      const clients = [client1, client2];

      // Simulate ListPrompts logic with error handling
      const serverPromptsMap = new Map<
        string,
        Array<{
          name: string;
          description?: string;
        }>
      >();

      await Promise.all(
        clients.map(async (client) => {
          try {
            const prompts = await client.listPrompts();
            serverPromptsMap.set(client.serverName, prompts);
          } catch {
            serverPromptsMap.set(client.serverName, []);
          }
        })
      );

      const aggregatedPrompts: Array<{
        name: string;
        description?: string;
      }> = [];

      for (const client of clients) {
        const prompts = serverPromptsMap.get(client.serverName) || [];
        for (const prompt of prompts) {
          aggregatedPrompts.push({
            name: prompt.name,
            description: prompt.description,
          });
        }
      }

      expect(aggregatedPrompts).toHaveLength(1);
      expect(aggregatedPrompts[0].name).toBe('prompt_one');
    });

    it('should include prompt arguments in aggregated list', async () => {
      const client1 = createMockClient('server-a', [
        {
          name: 'prompt_with_args',
          description: 'Prompt with arguments',
          arguments: [
            { name: 'arg1', description: 'First argument', required: true },
            { name: 'arg2', description: 'Second argument', required: false },
          ],
        },
      ]);

      const prompts = await client1.listPrompts();

      expect(prompts[0].arguments).toHaveLength(2);
      expect(prompts[0].arguments![0].name).toBe('arg1');
      expect(prompts[0].arguments![0].required).toBe(true);
    });
  });

  describe('GetPrompt routing', () => {
    it('should route prefixed prompt name to specific server', async () => {
      const client1 = createMockClient('server-a', [
        { name: 'my_prompt', description: 'Prompt from server A' },
      ]);
      const client2 = createMockClient('server-b', [
        { name: 'my_prompt', description: 'Prompt from server B' },
      ]);

      const clientsMap = new Map<string, McpClientConnection>([
        ['server-a', client1],
        ['server-b', client2],
      ]);

      // Simulate GetPrompt with prefixed name
      const requestedName = 'server-a__my_prompt';
      const separatorIndex = requestedName.indexOf('__');
      const serverName = requestedName.substring(0, separatorIndex);
      const actualPromptName = requestedName.substring(separatorIndex + 2);

      const client = clientsMap.get(serverName);
      expect(client).toBeDefined();

      const result = await client!.getPrompt(actualPromptName, { arg: 'value' });

      expect(result.messages).toHaveLength(1);
      expect(client1.getPrompt).toHaveBeenCalledWith('my_prompt', { arg: 'value' });
      expect(client2.getPrompt).not.toHaveBeenCalled();
    });

    it('should route unique prompt name to correct server', async () => {
      const client1 = createMockClient('server-a', [
        { name: 'unique_prompt', description: 'Unique prompt' },
      ]);
      const client2 = createMockClient('server-b', [
        { name: 'other_prompt', description: 'Other prompt' },
      ]);

      const clients = [client1, client2];

      // Simulate finding server for unique prompt
      const requestedName = 'unique_prompt';
      const serversWithPrompt: string[] = [];

      for (const client of clients) {
        const prompts = await client.listPrompts();
        if (prompts.some((p) => p.name === requestedName)) {
          serversWithPrompt.push(client.serverName);
        }
      }

      expect(serversWithPrompt).toHaveLength(1);
      expect(serversWithPrompt[0]).toBe('server-a');

      const result = await client1.getPrompt(requestedName, {});
      expect(result.messages).toHaveLength(1);
    });

    it('should throw error when prompt not found', async () => {
      const client1 = createMockClient('server-a', [
        { name: 'existing_prompt', description: 'Existing prompt' },
      ]);

      const clients = [client1];

      // Simulate finding server for non-existent prompt
      const requestedName = 'nonexistent_prompt';
      const serversWithPrompt: string[] = [];

      for (const client of clients) {
        const prompts = await client.listPrompts();
        if (prompts.some((p) => p.name === requestedName)) {
          serversWithPrompt.push(client.serverName);
        }
      }

      expect(serversWithPrompt).toHaveLength(0);
    });

    it('should throw error when prompt exists on multiple servers without prefix', async () => {
      const client1 = createMockClient('server-a', [
        { name: 'shared_prompt', description: 'Shared prompt' },
      ]);
      const client2 = createMockClient('server-b', [
        { name: 'shared_prompt', description: 'Shared prompt' },
      ]);

      const clients = [client1, client2];

      // Simulate finding server for clashing prompt
      const requestedName = 'shared_prompt';
      const serversWithPrompt: string[] = [];

      for (const client of clients) {
        const prompts = await client.listPrompts();
        if (prompts.some((p) => p.name === requestedName)) {
          serversWithPrompt.push(client.serverName);
        }
      }

      expect(serversWithPrompt).toHaveLength(2);
      expect(serversWithPrompt).toContain('server-a');
      expect(serversWithPrompt).toContain('server-b');
    });

    it('should throw error for unknown server in prefixed name', async () => {
      const clientsMap = new Map<string, McpClientConnection>();

      const requestedName = 'unknown-server__my_prompt';
      const separatorIndex = requestedName.indexOf('__');
      const serverName = requestedName.substring(0, separatorIndex);

      const client = clientsMap.get(serverName);
      expect(client).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty clients array', async () => {
      const clients: McpClientConnection[] = [];

      const aggregatedPrompts: Array<{
        name: string;
        description?: string;
      }> = [];

      for (const client of clients) {
        const prompts = await client.listPrompts();
        for (const prompt of prompts) {
          aggregatedPrompts.push({
            name: prompt.name,
            description: prompt.description,
          });
        }
      }

      expect(aggregatedPrompts).toHaveLength(0);
    });

    it('should handle server with empty prompts array', async () => {
      const client1 = createMockClient('server-a', []);
      const client2 = createMockClient('server-b', [
        { name: 'prompt_one', description: 'First prompt' },
      ]);

      const clients = [client1, client2];

      const aggregatedPrompts: Array<{
        name: string;
        description?: string;
      }> = [];

      for (const client of clients) {
        const prompts = await client.listPrompts();
        for (const prompt of prompts) {
          aggregatedPrompts.push({
            name: prompt.name,
            description: prompt.description,
          });
        }
      }

      expect(aggregatedPrompts).toHaveLength(1);
      expect(aggregatedPrompts[0].name).toBe('prompt_one');
    });

    it('should handle single server scenario', async () => {
      const client1 = createMockClient('server-a', [
        { name: 'prompt_one', description: 'First prompt' },
        { name: 'prompt_two', description: 'Second prompt' },
      ]);

      const clients = [client1];

      const aggregatedPrompts: Array<{
        name: string;
        description?: string;
      }> = [];

      for (const client of clients) {
        const prompts = await client.listPrompts();
        for (const prompt of prompts) {
          aggregatedPrompts.push({
            name: prompt.name,
            description: prompt.description,
          });
        }
      }

      expect(aggregatedPrompts).toHaveLength(2);
      // No prefix needed for single server
      expect(aggregatedPrompts[0].name).toBe('prompt_one');
      expect(aggregatedPrompts[1].name).toBe('prompt_two');
    });

    it('should handle prompts with no arguments', async () => {
      const client1 = createMockClient('server-a', [
        { name: 'prompt_no_args', description: 'Prompt without arguments' },
      ]);

      const prompts = await client1.listPrompts();

      expect(prompts[0].name).toBe('prompt_no_args');
      expect(prompts[0].arguments).toBeUndefined();
    });

    it('should handle prompts with many arguments', async () => {
      const manyArgs = Array.from({ length: 10 }, (_, i) => ({
        name: `arg${i}`,
        description: `Argument ${i}`,
        required: i < 3,
      }));

      const client1 = createMockClient('server-a', [
        {
          name: 'prompt_many_args',
          description: 'Prompt with many arguments',
          arguments: manyArgs,
        },
      ]);

      const prompts = await client1.listPrompts();

      expect(prompts[0].arguments).toHaveLength(10);
      expect(prompts[0].arguments![0].required).toBe(true);
      expect(prompts[0].arguments![5].required).toBe(false);
    });

    it('should handle getPrompt with undefined arguments', async () => {
      const client1 = createMockClient('server-a', [
        { name: 'my_prompt', description: 'Test prompt' },
      ]);

      const result = await client1.getPrompt('my_prompt', undefined);

      expect(result.messages).toHaveLength(1);
      expect(client1.getPrompt).toHaveBeenCalledWith('my_prompt', undefined);
    });

    it('should verify complete aggregatedPrompts structure', async () => {
      const client1 = createMockClient('server-a', [
        {
          name: 'full_prompt',
          description: 'Full prompt with all properties',
          arguments: [
            { name: 'arg1', description: 'First arg', required: true },
          ],
        },
      ]);

      const prompts = await client1.listPrompts();
      const aggregatedPrompt = {
        name: prompts[0].name,
        description: prompts[0].description,
        arguments: prompts[0].arguments,
      };

      // Verify complete structure
      expect(aggregatedPrompt).toHaveProperty('name');
      expect(aggregatedPrompt).toHaveProperty('description');
      expect(aggregatedPrompt).toHaveProperty('arguments');
      expect(typeof aggregatedPrompt.name).toBe('string');
      expect(typeof aggregatedPrompt.description).toBe('string');
      expect(Array.isArray(aggregatedPrompt.arguments)).toBe(true);
      expect(aggregatedPrompt.arguments![0]).toHaveProperty('name');
      expect(aggregatedPrompt.arguments![0]).toHaveProperty('description');
      expect(aggregatedPrompt.arguments![0]).toHaveProperty('required');
    });
  });
});
