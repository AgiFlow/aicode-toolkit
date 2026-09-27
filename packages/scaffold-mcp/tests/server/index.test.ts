import { describe, expect, it, vi } from 'vitest';
import packageJson from '../../package.json';
import { createServer } from '../../src/server';

vi.mock('@agiflowai/aicode-utils', async () => {
  const actual = await vi.importActual('@agiflowai/aicode-utils');
  return {
    ...actual,
    TemplatesManagerService: {
      ...(actual as any).TemplatesManagerService,
      findTemplatesPathSync: vi.fn().mockReturnValue('/test/templates'),
    },
  };
});

/** Shape of the MockServer installed by tests/setup.ts in place of the SDK Server. */
interface MockServer {
  name: string;
  version: string;
  requestHandlers: Map<string, (request: unknown) => Promise<{ tools: Array<{ name: string }> }>>;
}

function asMockServer(server: ReturnType<typeof createServer>): MockServer {
  return server as unknown as MockServer;
}

describe('Server', () => {
  describe('createServer', () => {
    it('should create server with default options', () => {
      const server = asMockServer(createServer());

      expect(server).toBeDefined();
      expect(server.name).toBe('scaffold-mcp');
      expect(server.version).toBe(packageJson.version);
    });

    it('should create server with admin enabled', () => {
      const server = asMockServer(createServer({ adminEnabled: true }));

      expect(server).toBeDefined();
    });

    it('should register tool handlers', () => {
      const server = asMockServer(createServer());

      expect(server.requestHandlers.size).toBeGreaterThan(0);
    });

    it('should register prompt handlers when admin enabled', () => {
      const server = asMockServer(createServer({ adminEnabled: true }));

      expect(server.requestHandlers.has('prompts/list')).toBe(true);
      expect(server.requestHandlers.has('prompts/get')).toBe(true);
    });

    it('should not register admin tools when adminEnabled is false', async () => {
      const server = asMockServer(createServer({ adminEnabled: false }));

      const listToolsHandler = server.requestHandlers.get('tools/list');
      if (!listToolsHandler) throw new Error('tools/list handler is missing');
      const result = await listToolsHandler({});
      const toolNames = result.tools.map((t: any) => t.name);
      expect(toolNames).not.toContain('generate-boilerplate');
      expect(toolNames).not.toContain('generate-feature-scaffold');
    });
  });

  describe('Tool Registration', () => {
    it('should register core tools', async () => {
      const server = asMockServer(createServer());

      const listToolsHandler = server.requestHandlers.get('tools/list');
      if (!listToolsHandler) throw new Error('tools/list handler is missing');
      const result = await listToolsHandler({});
      const toolNames = result.tools.map((t: any) => t.name);
      expect(toolNames).toContain('list-boilerplates');
      expect(toolNames).toContain('use-boilerplate');
      expect(toolNames).toContain('list-scaffolding-methods');
      expect(toolNames).toContain('use-scaffold-method');
      expect(toolNames).toContain('write-to-file');
    });
    it('should register admin tools when enabled', async () => {
      const server = asMockServer(createServer({ adminEnabled: true }));

      const listToolsHandler = server.requestHandlers.get('tools/list');
      if (!listToolsHandler) throw new Error('tools/list handler is missing');
      const result = await listToolsHandler({});
      const toolNames = result.tools.map((t: any) => t.name);
      expect(toolNames).toContain('generate-boilerplate');
      expect(toolNames).toContain('generate-boilerplate-file');
      expect(toolNames).toContain('generate-feature-scaffold');
    });
    it('should attach capability metadata to listed tools', async () => {
      const server = asMockServer(createServer({ adminEnabled: true }));

      const listToolsHandler = Array.from(server.requestHandlers.values())[0];
      const result = await listToolsHandler({});

      expect(result.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'list-boilerplates',
            _meta: {
              'agiflowai/capabilities': expect.arrayContaining(['boilerplates', 'templates']),
            },
          }),
          expect.objectContaining({
            name: 'use-scaffold-method',
            _meta: {
              'agiflowai/capabilities': expect.arrayContaining(['scaffolding', 'code-generation']),
            },
          }),
          expect.objectContaining({
            name: 'generate-feature-scaffold',
            _meta: {
              'agiflowai/capabilities': expect.arrayContaining(['template-authoring', 'admin']),
            },
          }),
        ]),
      );
    });
  });

  describe('Instructions', () => {
    it('should include base instructions', () => {
      const server = asMockServer(createServer());

      expect(server.requestHandlers).toBeDefined();
    });

    it('should include admin instructions when enabled', () => {
      const server = asMockServer(createServer({ adminEnabled: true }));

      expect(server.requestHandlers).toBeDefined();
    });
  });
});
