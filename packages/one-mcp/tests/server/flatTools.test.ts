import { describe, expect, it } from 'vitest';
import {
  buildProxyInstructions,
  buildSearchDescribeDefinition,
  buildFlatToolDefinitions,
  buildSkillsDescribeDefinition,
} from '../../src/server';
import type { CachedServerDefinition } from '../../src/types';

const baseServer = (overrides?: Partial<CachedServerDefinition>): CachedServerDefinition => ({
  serverName: 'filesystem',
  serverInstruction: 'Access files on disk',
  omitToolDescription: false,
  toolBlacklist: [],
  tools: [
    {
      name: 'read_file',
      description: 'Read a file',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
  resources: [
    {
      uri: 'file:///tmp/example.txt',
      name: 'example.txt',
    },
  ],
  prompts: [],
  promptSkills: [],
  ...overrides,
});

describe('flat tool exposure helpers', () => {
  it('keeps unique tool names flat and includes proxy summary in descriptions', () => {
    const definitions = buildFlatToolDefinitions([baseServer()]);

    expect(definitions).toHaveLength(1);
    expect(definitions[0].name).toBe('read_file');
    expect(definitions[0].description).toContain('Proxied from server "filesystem"');
    expect(definitions[0].description).toContain('Access files on disk');
  });

  it('prefixes only clashing tool names with the server name', () => {
    const definitions = buildFlatToolDefinitions([
      baseServer(),
      baseServer({
        serverName: 'workspace',
        tools: [
          {
            name: 'read_file',
            description: 'Read another file',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        resources: [],
      }),
    ]);

    expect(definitions.map((tool) => tool.name)).toEqual([
      'filesystem__read_file',
      'workspace__read_file',
    ]);
  });

  it('builds a describe_tools definition for skills with proxied server summary', () => {
    const definition = buildSkillsDescribeDefinition(
      [
        baseServer(),
        baseServer({
          serverName: 'git',
          tools: [
            {
              name: 'git_status',
              description: 'Get git status',
              inputSchema: { type: 'object', properties: {} },
            },
          ],
          resources: [],
        }),
      ],
      'server-id',
    );

    expect(definition.name).toBe('describe_tools');
    expect(definition.description).toContain('filesystem (read_file)');
    expect(definition.description).toContain('git (git_status)');
    expect(definition.description).toContain('id="server-id"');
  });

  it('builds top-level flat proxy instructions for server descriptions', () => {
    const instructions = buildProxyInstructions([baseServer()], 'flat', true);

    expect(instructions).toContain('one-mcp proxies downstream MCP servers');
    expect(instructions).toContain('filesystem (read_file)');
    expect(instructions).toContain('Skills are still exposed through describe_tools');
  });

  it('builds compact search-mode describe_tools definitions', () => {
    const definition = buildSearchDescribeDefinition([baseServer()], 'server-id');

    expect(definition.name).toBe('describe_tools');
    expect(definition.description).toContain('Use list_tools first');
    expect(definition.description).toContain('filesystem (read_file)');
    expect(definition.description).not.toContain('<available_capabilities>');
  });
});
