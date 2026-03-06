import { describe, expect, it, vi } from 'vitest';

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => {
  class MockServer {
    public name: string;
    public version: string;
    public requestHandlers: Map<any, (...args: unknown[]) => unknown>;

    constructor(info: any) {
      this.name = info.name;
      this.version = info.version;
      this.requestHandlers = new Map();
    }

    setRequestHandler(schema: any, handler: (...args: unknown[]) => unknown) {
      this.requestHandlers.set(schema, handler);
    }
  }

  return { Server: MockServer };
});

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
  CallToolRequestSchema: {},
  ListToolsRequestSchema: {},
}));

describe('style-system server capability metadata', () => {
  it('adds capability tags to listed tools', async () => {
    const { createServer } = await import('../../src/server');

    const server = createServer();
    const listToolsHandler = Array.from(server.requestHandlers.values())[0];
    const result = await listToolsHandler({});

    expect(result.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'list_themes',
          _meta: {
            'agiflowai/capabilities': expect.arrayContaining(['themes', 'design-system']),
          },
        }),
        expect.objectContaining({
          name: 'get_css_classes',
          _meta: {
            'agiflowai/capabilities': expect.arrayContaining(['css', 'tailwind']),
          },
        }),
        expect.objectContaining({
          name: 'get_component_visual',
          _meta: {
            'agiflowai/capabilities': expect.arrayContaining([
              'visual-preview',
              'design-review',
            ]),
          },
        }),
      ]),
    );
  });
});
