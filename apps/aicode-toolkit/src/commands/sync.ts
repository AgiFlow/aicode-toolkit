/**
 * Sync Command
 *
 * DESIGN PATTERNS:
 * - Command pattern with Commander for CLI argument parsing
 * - Async/await pattern for asynchronous operations
 * - Error handling pattern with try-catch and proper exit codes
 *
 * CODING STANDARDS:
 * - Use async action handlers for asynchronous operations
 * - Provide clear option descriptions and default values
 * - Handle errors gracefully with process.exit()
 * - Log progress and errors to console
 * - Use Commander's .option() and .argument() for inputs
 *
 * AVOID:
 * - Synchronous blocking operations in action handlers
 * - Missing error handling (always use try-catch)
 * - Hardcoded values (use options or environment variables)
 * - Not exiting with appropriate exit codes on errors
 */

import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Command } from 'commander';
import { print, TemplatesManagerService } from '@agiflowai/aicode-utils';
import type { ToolkitConfig, HookAgentConfig, ArchitectHookAgentConfig } from '@agiflowai/aicode-utils';
import yaml from 'js-yaml';

// ---------------------------------------------------------------------------
// Output path constants
// ---------------------------------------------------------------------------

const CLAUDE_SETTINGS_DIR = '.claude';
const CLAUDE_SETTINGS_FILE = 'settings.json';
const MCP_CONFIG_FILE = 'mcp-config.yaml';

// ---------------------------------------------------------------------------
// Local interfaces
// ---------------------------------------------------------------------------

/** Shape of an mcp-config.yaml server entry used to derive the hook command. */
interface McpServerDefinition {
  command: string;
  args?: string[];
}

/** Parsed shape of mcp-config.yaml on disk. */
interface McpConfigYaml {
  mcpServers?: Record<string, McpServerDefinition>;
}

interface ClaudeHookCommand {
  type: 'command';
  command: string;
}

interface ClaudeHookEntry {
  hooks: ClaudeHookCommand[];
}

interface ClaudeSettingsJson {
  hooks: Record<string, ClaudeHookEntry[]>;
}

// ---------------------------------------------------------------------------
// Runtime type guard
// ---------------------------------------------------------------------------

/** Narrowed type asserting at least one MCP source has a claude-code hook section. */
type ToolkitConfigWithHooks = ToolkitConfig &
  (
    | {
        'scaffold-mcp': NonNullable<ToolkitConfig['scaffold-mcp']> & {
          hook: { 'claude-code': HookAgentConfig };
        };
      }
    | {
        'architect-mcp': NonNullable<ToolkitConfig['architect-mcp']> & {
          hook: { 'claude-code': ArchitectHookAgentConfig };
        };
      }
  );

function hasHookConfig(config: ToolkitConfig): config is ToolkitConfigWithHooks {
  return !!(
    config['scaffold-mcp']?.hook?.['claude-code'] || config['architect-mcp']?.hook?.['claude-code']
  );
}

// ---------------------------------------------------------------------------
// Helper: convert Record<string, string|boolean|number> to CLI flag array
// ---------------------------------------------------------------------------

export function argsToFlags(args: Record<string, string | boolean | number>): string[] {
  const flags: string[] = [];
  for (const [key, value] of Object.entries(args)) {
    if (value === false) continue;
    flags.push(`--${key}`);
    if (value !== true) flags.push(String(value));
  }
  return flags;
}

// ---------------------------------------------------------------------------
// Helper: derive hook command from mcp-config.yaml server definition
// ---------------------------------------------------------------------------

export function buildHookCommand(
  server: McpServerDefinition,
  hookType: string,
  extraFlags: string[],
): string {
  const serverArgs = server.args ?? [];

  // Strategy 1: script file present — take everything up to and including it
  const scriptIdx = serverArgs.findIndex((arg) => /\.(ts|js|mjs|cjs)$/.test(arg));
  if (scriptIdx >= 0) {
    const prefixArgs = serverArgs.slice(0, scriptIdx + 1);
    return [server.command, ...prefixArgs, 'hook', '--type', hookType, ...extraFlags].join(' ');
  }

  // Strategy 2: no script file (e.g. npx @agiflowai/scaffold-mcp mcp-serve)
  const mcpServeIdx = serverArgs.indexOf('mcp-serve');
  const prefixArgs = mcpServeIdx >= 0 ? serverArgs.slice(0, mcpServeIdx) : serverArgs;
  return [server.command, ...prefixArgs, 'hook', '--type', hookType, ...extraFlags].join(' ');
}

// ---------------------------------------------------------------------------
// Helper: push a hook entry into the output map
// ---------------------------------------------------------------------------

function addHookEntry(
  output: Record<string, ClaudeHookEntry[]>,
  event: string,
  command: string,
): void {
  if (!output[event]) output[event] = [];
  output[event].push({ hooks: [{ type: 'command', command }] });
}

// ---------------------------------------------------------------------------
// Helper: read mcp-config.yaml from disk
// ---------------------------------------------------------------------------

function isMcpConfigYaml(value: unknown): value is McpConfigYaml {
  return typeof value === 'object' && value !== null;
}

async function readMcpConfigYaml(workspaceRoot: string): Promise<McpConfigYaml> {
  try {
    const content = await readFile(path.join(workspaceRoot, MCP_CONFIG_FILE), 'utf-8');
    const parsed = yaml.load(content);
    if (!isMcpConfigYaml(parsed)) {
      throw new Error(`${MCP_CONFIG_FILE} has unexpected structure`);
    }
    return parsed;
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      return {};
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read ${MCP_CONFIG_FILE}: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Helper: build and write .claude/settings.json
// ---------------------------------------------------------------------------

const METHOD_TO_EVENT: Record<string, string> = {
  preToolUse: 'PreToolUse',
  postToolUse: 'PostToolUse',
  stop: 'Stop',
  userPromptSubmit: 'UserPromptSubmit',
  taskCompleted: 'TaskCompleted',
};

async function writeClaudeSettings(config: ToolkitConfig, workspaceRoot: string): Promise<void> {
  try {
    const mcpConfigYaml = await readMcpConfigYaml(workspaceRoot);
    const mcpServers = mcpConfigYaml.mcpServers ?? {};

    const hooksOutput: Record<string, ClaudeHookEntry[]> = {};
    let hasAny = false;

    // --- scaffold-mcp ---
    const scaffoldAgent = config['scaffold-mcp']?.hook?.['claude-code'];
    const scaffoldServer = mcpServers['scaffold-mcp'];
    if (scaffoldAgent && scaffoldServer) {
      for (const [method, methodConfig] of [
        ['preToolUse', scaffoldAgent.preToolUse],
        ['postToolUse', scaffoldAgent.postToolUse],
        ['stop', scaffoldAgent.stop],
        ['userPromptSubmit', scaffoldAgent.userPromptSubmit],
        ['taskCompleted', scaffoldAgent.taskCompleted],
      ] as const) {
        if (methodConfig === undefined) continue;
        const extraFlags = methodConfig?.args ? argsToFlags(methodConfig?.args) : [];
        const command = buildHookCommand(scaffoldServer, `claude-code.${method}`, extraFlags);
        addHookEntry(hooksOutput, METHOD_TO_EVENT[method], command);
        hasAny = true;
      }
    }

    // --- architect-mcp ---
    const architectAgent = config['architect-mcp']?.hook?.['claude-code'];
    const architectServer = mcpServers['architect-mcp'];
    if (architectAgent && architectServer) {
      for (const [method, methodConfig] of [
        ['preToolUse', architectAgent.preToolUse],
        ['postToolUse', architectAgent.postToolUse],
      ] as const) {
        if (methodConfig === undefined) continue;
        const extraFlags = methodConfig?.args ? argsToFlags(methodConfig?.args) : [];
        const command = buildHookCommand(architectServer, `claude-code.${method}`, extraFlags);
        addHookEntry(hooksOutput, METHOD_TO_EVENT[method], command);
        hasAny = true;
      }
    }

    if (!hasAny) {
      print.warning(
        'No scaffold-mcp/architect-mcp hook.claude-code config found — skipping .claude/settings.json',
      );
      return;
    }

    const settings: ClaudeSettingsJson = { hooks: hooksOutput };
    const claudeDir = path.join(workspaceRoot, CLAUDE_SETTINGS_DIR);
    await mkdir(claudeDir, { recursive: true });
    await writeFile(
      path.join(claudeDir, CLAUDE_SETTINGS_FILE),
      JSON.stringify(settings, null, 2),
      'utf-8',
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to write ${CLAUDE_SETTINGS_DIR}/${CLAUDE_SETTINGS_FILE}: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Command definition
// ---------------------------------------------------------------------------

/**
 * Generate .claude/settings.json from .toolkit/settings.yaml and mcp-config.yaml
 */
export const syncCommand = new Command('sync')
  .description('Generate .claude/settings.json from .toolkit/settings.yaml and mcp-config.yaml')
  .action(async (): Promise<void> => {
    try {
      const [workspaceRoot, config] = await Promise.all([
        TemplatesManagerService.getWorkspaceRoot(),
        TemplatesManagerService.readToolkitConfig(),
      ]);

      if (!config) {
        throw new Error('No .toolkit/settings.yaml found. Run `aicode init` first.');
      }

      if (hasHookConfig(config)) {
        await writeClaudeSettings(config, workspaceRoot);
        print.success('Written .claude/settings.json');
      } else {
        print.warning('No hook.claude-code config found in settings.yaml — skipping');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      print.error(`sync failed: ${message}`);
      process.exit(1);
    }
  });
