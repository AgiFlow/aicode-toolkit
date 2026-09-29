import { afterEach, describe, expect, it, vi } from 'vitest';
import { ListSharedComponentsTool, ListThemesTool } from '../../src/tools';

vi.mock('@modelcontextprotocol/server', () => {
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

/** Shape of the mocked Server above, which records handlers instead of serving them. */
interface MockedServer {
  requestHandlers: Map<unknown, (request: unknown) => Promise<{ tools: unknown[] }>>;
}

describe('style-system server capability metadata', () => {
  it('adds capability tags to listed tools', async () => {
    const { createServer } = await import('../../src/server');

    const server = createServer() as unknown as MockedServer;
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
            'agiflowai/capabilities': expect.arrayContaining(['visual-preview', 'design-review']),
          },
        }),
      ]),
    );
  });
});

afterEach(() => vi.restoreAllMocks());

describe('style-system request dispatch', () => {
  it.each([
    ['list_themes', ListThemesTool, { appPath: 'apps/site' }],
    ['list_shared_components', ListSharedComponentsTool, { tags: ['button'], cursor: 'next' }],
  ] as const)('forwards %s arguments to its tool', async (name, Tool, args) => {
    const execute = vi.spyOn(Tool.prototype, 'execute').mockResolvedValue({ content: [] });
    const { createServer } = await import('../../src/server');
    const server = createServer() as unknown as MockedServer;
    const call = Array.from(server.requestHandlers.values())[1];

    await call({ params: { name, arguments: args } });
    expect(execute).toHaveBeenCalledWith(args);
  });

  it('uses an empty object for omitted optional arguments', async () => {
    const execute = vi
      .spyOn(ListThemesTool.prototype, 'execute')
      .mockResolvedValue({ content: [] });
    const { createServer } = await import('../../src/server');
    const server = createServer() as unknown as MockedServer;
    const call = Array.from(server.requestHandlers.values())[1];

    await call({ params: { name: 'list_themes' } });
    expect(execute).toHaveBeenCalledWith({});
  });
});
