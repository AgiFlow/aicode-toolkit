import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListBoilerplatesTool } from '../../src/tools/ListBoilerplatesTool';
import { PaginationHelper } from '../../src/utils/pagination';

// Mock the service
vi.mock('../../src/services/BoilerplateService');

describe('ListBoilerplatesTool - Pagination', () => {
  let tool: ListBoilerplatesTool;
  const templatesPath = '/test/templates';

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new ListBoilerplatesTool(templatesPath, false);
  });

  it('should include cursor parameter in schema', () => {
    const definition = tool.getDefinition();

    expect(definition.inputSchema.properties).toHaveProperty('cursor');
    expect(definition.inputSchema.properties.cursor).toEqual({
      type: 'string',
      description:
        'Optional pagination cursor to fetch the next page of results. Omit to fetch the first page.',
    });
  });

  it('should return paginated results on first page', async () => {
    // Create mock data with 15 items to test pagination
    const mockBoilerplates = Array.from({ length: 15 }, (_, i) => ({
      name: `scaffold-app-${i + 1}`,
      description: `Application template ${i + 1}`,
      instruction: 'Follow the instructions',
      variables_schema: {
        type: 'object',
        properties: {
          appName: { type: 'string', description: 'App name' },
        },
        required: ['appName'],
      },
      template_path: `template-${i + 1}`,
      target_folder: 'apps',
      includes: ['**/*'],
    }));

    // Mock the paginated response
    const paginatedResult = PaginationHelper.paginate(mockBoilerplates);
    const spy = vi.spyOn(tool['boilerplateService'], 'listBoilerplates');
    spy.mockResolvedValue({
      boilerplates: paginatedResult.items,
      nextCursor: paginatedResult.nextCursor,
    });

    const result = await tool.execute({});

    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0].type).toBe('text');

    const response = JSON.parse(result.content[0].text);
    expect(response).toHaveProperty('boilerplates');
    expect(Array.isArray(response.boilerplates)).toBe(true);
    expect(response.boilerplates).toHaveLength(10);
    expect(response).toHaveProperty('nextCursor');
    expect(typeof response.nextCursor).toBe('string');
  });

  it('should return next page when cursor is provided', async () => {
    // Create mock data with 15 items
    const mockBoilerplates = Array.from({ length: 15 }, (_, i) => ({
      name: `scaffold-app-${i + 1}`,
      description: `Application template ${i + 1}`,
      instruction: 'Follow the instructions',
      variables_schema: {
        type: 'object',
        properties: {
          appName: { type: 'string', description: 'App name' },
        },
        required: ['appName'],
      },
      template_path: `template-${i + 1}`,
      target_folder: 'apps',
      includes: ['**/*'],
    }));

    const spy = vi.spyOn(tool['boilerplateService'], 'listBoilerplates');

    // Mock first page
    const firstPageResult = PaginationHelper.paginate(mockBoilerplates);
    spy.mockResolvedValueOnce({
      boilerplates: firstPageResult.items,
      nextCursor: firstPageResult.nextCursor,
    });

    const firstPageResponse = await tool.execute({});
    const firstPage = JSON.parse(firstPageResponse.content[0].text);

    expect(firstPage.boilerplates).toHaveLength(10);
    expect(firstPage.nextCursor).toBeDefined();

    // Mock second page
    const secondPageResult = PaginationHelper.paginate(mockBoilerplates, firstPage.nextCursor);
    spy.mockResolvedValueOnce({
      boilerplates: secondPageResult.items,
      nextCursor: secondPageResult.nextCursor,
    });

    const secondPageResponse = await tool.execute({ cursor: firstPage.nextCursor });
    const secondPage = JSON.parse(secondPageResponse.content[0].text);

    expect(secondPage).toHaveProperty('boilerplates');
    expect(Array.isArray(secondPage.boilerplates)).toBe(true);
    expect(secondPage.boilerplates).toHaveLength(5);
    expect(firstPage.boilerplates[0].name).not.toBe(secondPage.boilerplates[0].name);
  });

  it('should pass cursor parameter to service', async () => {
    const cursor = PaginationHelper.encodeCursor(1);
    const spy = vi.spyOn(tool['boilerplateService'], 'listBoilerplates');
    spy.mockResolvedValue({
      boilerplates: [],
      nextCursor: undefined,
    });

    await tool.execute({ cursor });

    expect(spy).toHaveBeenCalledWith(cursor);
  });

  it('should respect page size of 10 items', async () => {
    // Create mock data with 25 items
    const mockBoilerplates = Array.from({ length: 25 }, (_, i) => ({
      name: `scaffold-app-${i + 1}`,
      description: `Application template ${i + 1}`,
      instruction: 'Follow the instructions',
      variables_schema: {
        type: 'object',
        properties: {
          appName: { type: 'string', description: 'App name' },
        },
        required: ['appName'],
      },
      template_path: `template-${i + 1}`,
      target_folder: 'apps',
      includes: ['**/*'],
    }));

    const paginatedResult = PaginationHelper.paginate(mockBoilerplates);
    const spy = vi.spyOn(tool['boilerplateService'], 'listBoilerplates');
    spy.mockResolvedValue({
      boilerplates: paginatedResult.items,
      nextCursor: paginatedResult.nextCursor,
    });

    const result = await tool.execute({});
    const response = JSON.parse(result.content[0].text);

    // Should have exactly 10 items on first page
    expect(response.boilerplates.length).toBe(10);
  });

  it('should correctly encode/decode cursor between pages', async () => {
    const mockBoilerplates = Array.from({ length: 25 }, (_, i) => ({
      name: `scaffold-app-${i + 1}`,
      description: `Application template ${i + 1}`,
      instruction: 'Follow the instructions',
      variables_schema: {
        type: 'object',
        properties: {
          appName: { type: 'string', description: 'App name' },
        },
        required: ['appName'],
      },
      template_path: `template-${i + 1}`,
      target_folder: 'apps',
      includes: ['**/*'],
    }));

    const spy = vi.spyOn(tool['boilerplateService'], 'listBoilerplates');

    // First page
    const firstPageResult = PaginationHelper.paginate(mockBoilerplates);
    spy.mockResolvedValueOnce({
      boilerplates: firstPageResult.items,
      nextCursor: firstPageResult.nextCursor,
      _meta: firstPageResult._meta,
    });

    const firstPageResponse = await tool.execute({});
    const firstPage = JSON.parse(firstPageResponse.content[0].text);

    expect(firstPage.nextCursor).toBe('10'); // Points to index 10
    expect(firstPage._meta).toEqual({ total: 25, offset: 0, limit: 10 });

    // Decode cursor to verify it points to index 10
    const decoded = PaginationHelper.decodeCursor(firstPage.nextCursor!);
    expect(decoded).toBe(10);

    // Second page
    const secondPageResult = PaginationHelper.paginate(mockBoilerplates, firstPage.nextCursor);
    spy.mockResolvedValueOnce({
      boilerplates: secondPageResult.items,
      nextCursor: secondPageResult.nextCursor,
      _meta: secondPageResult._meta,
    });

    const secondPageResponse = await tool.execute({ cursor: firstPage.nextCursor });
    const secondPage = JSON.parse(secondPageResponse.content[0].text);

    expect(secondPage.nextCursor).toBe('20'); // Points to index 20
    expect(secondPage._meta).toEqual({ total: 25, offset: 10, limit: 10 });

    // Decode cursor to verify it points to index 20
    const decoded2 = PaginationHelper.decodeCursor(secondPage.nextCursor!);
    expect(decoded2).toBe(20);
  });
});
