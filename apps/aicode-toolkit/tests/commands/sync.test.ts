/**
 * sync command tests — argsToFlags & buildHookCommand
 *
 * TESTING PATTERNS:
 * - Unit tests with Arrange-Act-Assert
 * - Cover success cases, edge cases, and error handling
 * - Test behavior, not implementation
 */

import { describe, expect, it } from 'vitest';
import {
  argsToFlags,
  buildMcpConfigYaml,
  buildHookCommand,
  resolveArchitectClaudeMatcher,
  buildScaffoldHookCommand,
  mergeClaudeSettings,
} from '../../src/commands/sync';

// ---------------------------------------------------------------------------
// argsToFlags
// ---------------------------------------------------------------------------

describe('argsToFlags', () => {
  it('converts string values to --key value pairs', () => {
    expect(argsToFlags({ 'llm-tool': 'gemini-cli' })).toEqual(['--llm-tool', 'gemini-cli']);
  });

  it('converts numeric values to --key value pairs', () => {
    expect(argsToFlags({ port: 3000 })).toEqual(['--port', '3000']);
  });

  it('converts boolean true to flag-only (no value)', () => {
    expect(argsToFlags({ 'admin-enable': true })).toEqual(['--admin-enable']);
  });

  it('omits entries where value is false', () => {
    expect(argsToFlags({ 'admin-enable': false })).toEqual([]);
  });

  it('handles multiple entries in insertion order', () => {
    expect(argsToFlags({ 'llm-tool': 'gemini-cli', verbose: true, port: 8080 })).toEqual([
      '--llm-tool',
      'gemini-cli',
      '--verbose',
      '--port',
      '8080',
    ]);
  });

  it('returns empty array for empty object', () => {
    expect(argsToFlags({})).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildHookCommand — strategy 1: script file in args
// ---------------------------------------------------------------------------

describe('buildHookCommand — script file strategy', () => {
  it('strips args after the .ts script and inserts hook --type', () => {
    const server = {
      command: 'bun',
      args: ['run', 'packages/scaffold-mcp/src/cli.ts', 'mcp-serve', '--admin-enable'],
    };
    expect(buildHookCommand(server, 'claude-code.preToolUse', [])).toBe(
      'bun run packages/scaffold-mcp/src/cli.ts hook --type claude-code.preToolUse',
    );
  });

  it('appends extra flags after hook --type', () => {
    const server = {
      command: 'bun',
      args: ['run', 'packages/scaffold-mcp/src/cli.ts', 'mcp-serve'],
    };
    expect(buildHookCommand(server, 'claude-code.postToolUse', ['--llm-tool', 'gemini-cli'])).toBe(
      'bun run packages/scaffold-mcp/src/cli.ts hook --type claude-code.postToolUse --llm-tool gemini-cli',
    );
  });

  it('handles .js script files', () => {
    const server = {
      command: 'node',
      args: ['dist/cli.js', 'mcp-serve'],
    };
    expect(buildHookCommand(server, 'claude-code.stop', [])).toBe(
      'node dist/cli.js hook --type claude-code.stop',
    );
  });

  it('handles .mjs script files', () => {
    const server = {
      command: 'node',
      args: ['dist/cli.mjs', 'mcp-serve'],
    };
    expect(buildHookCommand(server, 'claude-code.preToolUse', [])).toBe(
      'node dist/cli.mjs hook --type claude-code.preToolUse',
    );
  });
});

// ---------------------------------------------------------------------------
// buildHookCommand — strategy 2: package name (no script file)
// ---------------------------------------------------------------------------

describe('buildHookCommand — package name strategy', () => {
  it('strips mcp-serve and inserts hook --type', () => {
    const server = {
      command: 'npx',
      args: ['@agiflowai/scaffold-mcp', 'mcp-serve'],
    };
    expect(buildHookCommand(server, 'claude-code.preToolUse', [])).toBe(
      'npx @agiflowai/scaffold-mcp hook --type claude-code.preToolUse',
    );
  });

  it('appends extra flags after hook --type', () => {
    const server = {
      command: 'npx',
      args: ['@agiflowai/architect-mcp', 'mcp-serve'],
    };
    expect(buildHookCommand(server, 'claude-code.postToolUse', ['--llm-tool', 'gemini-cli'])).toBe(
      'npx @agiflowai/architect-mcp hook --type claude-code.postToolUse --llm-tool gemini-cli',
    );
  });

  it('uses all args when mcp-serve is absent', () => {
    const server = {
      command: 'npx',
      args: ['@agiflowai/scaffold-mcp'],
    };
    expect(buildHookCommand(server, 'claude-code.preToolUse', [])).toBe(
      'npx @agiflowai/scaffold-mcp hook --type claude-code.preToolUse',
    );
  });

  it('works with no args at all', () => {
    const server = { command: 'scaffold-mcp' };
    expect(buildHookCommand(server, 'claude-code.preToolUse', [])).toBe(
      'scaffold-mcp hook --type claude-code.preToolUse',
    );
  });
});

// ---------------------------------------------------------------------------
// buildHookCommand combined with argsToFlags
// ---------------------------------------------------------------------------

describe('buildHookCommand with argsToFlags', () => {
  it('produces correct command with key-value args from settings', () => {
    const server = {
      command: 'bun',
      args: ['run', 'packages/scaffold-mcp/src/cli.ts', 'mcp-serve'],
    };
    const extraFlags = argsToFlags({ 'llm-tool': 'gemini-cli', verbose: true });

    expect(buildHookCommand(server, 'claude-code.preToolUse', extraFlags)).toBe(
      'bun run packages/scaffold-mcp/src/cli.ts hook --type claude-code.preToolUse --llm-tool gemini-cli --verbose',
    );
  });

  it('produces correct command when args is empty object', () => {
    const server = {
      command: 'npx',
      args: ['@agiflowai/architect-mcp', 'mcp-serve'],
    };
    expect(buildHookCommand(server, 'claude-code.postToolUse', argsToFlags({}))).toBe(
      'npx @agiflowai/architect-mcp hook --type claude-code.postToolUse',
    );
  });
});

describe('resolveArchitectClaudeMatcher', () => {
  it('returns the architect default matcher when unset', () => {
    expect(resolveArchitectClaudeMatcher(undefined)).toBe('Edit|MultiEdit|Write');
    expect(resolveArchitectClaudeMatcher({})).toBe('Edit|MultiEdit|Write');
  });

  it('preserves an explicit matcher override', () => {
    expect(resolveArchitectClaudeMatcher({ matcher: 'Write' })).toBe('Write');
  });
});

describe('buildMcpConfigYaml', () => {
  it('returns null when no mcp-config section is present', () => {
    expect(buildMcpConfigYaml({})).toBeNull();
  });

  it('preserves other servers, instructions, and skills while omitting CLI-backed servers', () => {
    expect(
      buildMcpConfigYaml({
        'mcp-config': {
          servers: {
            'scaffold-mcp': { command: 'npx', args: ['@agiflowai/scaffold-mcp', 'mcp-serve'] },
            'log-sink': { command: 'npx', args: ['@agimon-ai/log-sink-mcp', 'mcp-serve'] },
            'custom-scaffold-name': {
              command: 'bun',
              args: ['run', 'packages/scaffold-mcp/src/cli.ts', 'mcp-serve'],
            },
            'architect-mcp': {
              command: 'bun',
              args: ['run', 'packages/architect-mcp/src/cli.ts', 'mcp-serve'],
              instruction: 'Review architecture.',
              config: { keepAlive: true },
            },
          },
          skills: { paths: ['docs/skills'] },
        },
      }),
    ).toEqual({
      mcpServers: {
        'architect-mcp': {
          command: 'bun',
          args: ['run', 'packages/architect-mcp/src/cli.ts', 'mcp-serve'],
          config: { keepAlive: true, instruction: 'Review architecture.' },
        },
      },
      skills: { paths: ['docs/skills'] },
    });
  });

  it('writes an empty server map so obsolete registrations are cleared on sync', () => {
    expect(
      buildMcpConfigYaml({
        'mcp-config': {
          servers: { scaffolding: { command: 'scaffold-mcp', args: ['mcp-serve'] } },
        },
      }),
    ).toEqual({ mcpServers: {} });
  });
});

describe('CLI-only scaffolding hooks', () => {
  it('generates a hook command without an MCP server entry', () => {
    expect(buildScaffoldHookCommand('claude-code.preToolUse', ['--verbose'])).toBe(
      'npx --yes @agiflowai/scaffold-mcp@2.0.0 hook --type claude-code.preToolUse --verbose',
    );
  });

  it('preserves a legacy repository-specific executable during migration', () => {
    expect(
      buildScaffoldHookCommand('claude-code.stop', [], {
        command: 'bun',
        args: ['run', 'packages/scaffold-mcp/src/cli.ts', 'mcp-serve'],
      }),
    ).toBe('bun run packages/scaffold-mcp/src/cli.ts hook --type claude-code.stop');
  });
});

describe('mergeClaudeSettings', () => {
  it('preserves CLI permissions and unrelated hooks while replacing managed hooks idempotently', () => {
    const existing: Parameters<typeof mergeClaudeSettings>[0] = {
      permissions: { allow: ['Bash(pnpm exec log-sink-mcp logs search *)'] },
      hooks: {
        PreToolUse: [
          {
            matcher: 'Write',
            hooks: [
              { type: 'command', command: 'scaffold-mcp hook --type claude-code.preToolUse' },
              { type: 'command', command: 'node tools/preserve-this-hook.js' },
            ],
          },
        ],
        Notification: [{ hooks: [{ type: 'command', command: 'echo notified' }] }],
      },
    };
    const generated: Parameters<typeof mergeClaudeSettings>[1] = {
      PreToolUse: [
        {
          matcher: 'Write',
          hooks: [
            {
              type: 'command',
              command: buildScaffoldHookCommand('claude-code.preToolUse', []),
            },
          ],
        },
      ],
    };

    const merged = mergeClaudeSettings(existing, generated);

    expect(merged.permissions).toEqual(existing.permissions);
    expect(merged.hooks.Notification).toEqual(existing.hooks?.Notification);
    expect(merged.hooks.PreToolUse).toHaveLength(2);
    expect(merged.hooks.PreToolUse[0].hooks[0].command).toBe('node tools/preserve-this-hook.js');
    expect(mergeClaudeSettings(merged, generated)).toEqual(merged);
    expect(existing.hooks?.PreToolUse[0].hooks).toHaveLength(2);
  });
});
