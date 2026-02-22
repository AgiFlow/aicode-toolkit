/**
 * sync command tests — argsToFlags & buildHookCommand
 *
 * TESTING PATTERNS:
 * - Unit tests with Arrange-Act-Assert
 * - Cover success cases, edge cases, and error handling
 * - Test behavior, not implementation
 */

import { describe, expect, it } from 'vitest';
import { argsToFlags, buildHookCommand } from '../../src/commands/sync';

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
