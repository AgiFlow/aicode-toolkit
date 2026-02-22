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
import { mkdir, writeFile } from 'node:fs/promises';
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
// Command options
// ---------------------------------------------------------------------------

interface SyncCommandOptions {
  hooks?: boolean;
  mcp?: boolean;
}

// ---------------------------------------------------------------------------
// Local interfaces
// ---------------------------------------------------------------------------

/** Shape of an mcp-config server entry used to derive the hook command. */
interface McpServerDefinition {
  command: string;
  args?: string[];
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

interface McpServerOut {
  command: string;
  args?: string[];
  env: Record<string, string>;
  config?: { instruction: string };
}

interface McpSkillsConfig {
  paths?: string[];
}

interface McpConfigOut {
  mcpServers: Record<string, McpServerOut>;
  skills?: McpSkillsConfig;
}

// ---------------------------------------------------------------------------
// Runtime type guard
// ---------------------------------------------------------------------------

/** Narrowed type asserting at least one MCP source has a claude-code hook section. */
type ToolkitConfigWithHooks = ToolkitConfig & (
  | { 'scaffold-mcp': NonNullable<ToolkitConfig['scaffold-mcp']> & { hook: { 'claude-code': HookAgentConfig } } }
  | { 'architect-mcp': NonNullable<ToolkitConfig['architect-mcp']> & { hook: { 'claude-code': ArchitectHookAgentConfig } } }
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
// Helper: derive hook command from mcp-config server definition
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
    const hooksOutput: Record<string, ClaudeHookEntry[]> = {};
    let hasAny = false;

    // --- scaffold-mcp ---
    const scaffoldAgent = config['scaffold-mcp']?.hook?.['claude-code'];
    const scaffoldServer = config['mcp-config']?.servers?.['scaffold-mcp'];
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
    const architectServer = config['mcp-config']?.servers?.['architect-mcp'];
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
// Helper: build and write mcp-config.yaml
// ---------------------------------------------------------------------------

async function writeMcpConfig(config: ToolkitConfig, workspaceRoot: string): Promise<void> {
  const mcpConfig = config['mcp-config'];
  if (!mcpConfig) return;

  try {
    const mcpServers: Record<string, McpServerOut> = {};

    for (const [name, server] of Object.entries(mcpConfig.servers ?? {})) {
      const entry: McpServerOut = {
        command: server.command,
        env: server.env ?? {},
      };
      if (server.args && server.args.length > 0) {
        entry.args = server.args;
      }
      if (server.instruction) {
        entry.config = { instruction: server.instruction };
      }
      mcpServers[name] = entry;
    }

    const output: McpConfigOut = { mcpServers };
    if (mcpConfig.skills) {
      output.skills = mcpConfig.skills;
    }

    const content = yaml.dump(output, { indent: 2, lineWidth: -1 });
    await writeFile(path.join(workspaceRoot, MCP_CONFIG_FILE), content, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to write ${MCP_CONFIG_FILE}: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Command definition
// ---------------------------------------------------------------------------

/**
 * Generate .claude/settings.json and mcp-config.yaml from .toolkit/settings.yaml
 */
export const syncCommand = new Command('sync')
  .description('Generate .claude/settings.json and mcp-config.yaml from .toolkit/settings.yaml')
  .option('--hooks', 'Generate .claude/settings.json only', false)
  .option('--mcp', 'Generate mcp-config.yaml only', false)
  .action(async (options: SyncCommandOptions): Promise<void> => {
    try {
      const [workspaceRoot, config] = await Promise.all([
        TemplatesManagerService.getWorkspaceRoot(),
        TemplatesManagerService.readToolkitConfig(),
      ]);

      if (!config) {
        throw new Error('No .toolkit/settings.yaml found. Run `aicode init` first.');
      }

      const all = !options.hooks && !options.mcp;
      const doHooks = all || !!options.hooks;
      const doMcp = all || !!options.mcp;

      const tasks: Array<Promise<void>> = [];
      if (doHooks) {
        if (hasHookConfig(config)) {
          tasks.push(writeClaudeSettings(config, workspaceRoot));
        } else {
          print.warning('No hook.claude-code config found in settings.yaml — skipping');
        }
      }
      if (doMcp && config['mcp-config']) tasks.push(writeMcpConfig(config, workspaceRoot));
      await Promise.all(tasks);

      if (doHooks && hasHookConfig(config)) print.success('Written .claude/settings.json');
      if (doMcp) {
        if (config['mcp-config']) {
          print.success('Written mcp-config.yaml');
        } else {
          print.warning('No mcp-config section in settings.yaml — skipping');
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      print.error(`sync failed: ${message}`);
      process.exit(1);
    }
  });
