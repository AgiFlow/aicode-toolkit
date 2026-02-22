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
// Input config interfaces (mirrors .toolkit/settings.yaml structure)
// ---------------------------------------------------------------------------

interface ClaudeCodeHookEntry {
  matcher?: string;
  commands: string[];
}

interface ClaudeCodeHooksConfig {
  PreToolUse?: ClaudeCodeHookEntry[];
  PostToolUse?: ClaudeCodeHookEntry[];
  Stop?: ClaudeCodeHookEntry[];
  UserPromptSubmit?: ClaudeCodeHookEntry[];
  TaskCompleted?: ClaudeCodeHookEntry[];
}

interface McpServerEntry {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  instruction?: string;
}

interface McpSkillsConfig {
  paths?: string[];
}

interface McpConfigSection {
  servers?: Record<string, McpServerEntry>;
  skills?: McpSkillsConfig;
}

interface RawSyncConfig {
  'claude-code'?: { hooks?: ClaudeCodeHooksConfig };
  'mcp-config'?: McpConfigSection;
}

// ---------------------------------------------------------------------------
// .claude/settings.json output schema
// ---------------------------------------------------------------------------

interface ClaudeHookCommand {
  type: 'command';
  command: string;
}

interface ClaudeHookEntry {
  matcher?: string;
  hooks: ClaudeHookCommand[];
}

interface ClaudeSettingsJson {
  hooks: Record<string, ClaudeHookEntry[]>;
}

// ---------------------------------------------------------------------------
// mcp-config.yaml output schema
// ---------------------------------------------------------------------------

interface McpServerOut {
  command: string;
  args?: string[];
  env: Record<string, string>;
  config?: { instruction: string };
}

interface McpConfigOut {
  mcpServers: Record<string, McpServerOut>;
  skills?: McpSkillsConfig;
}

// ---------------------------------------------------------------------------
// Runtime type guard
// ---------------------------------------------------------------------------

function isRawSyncConfig(value: unknown): value is RawSyncConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return 'claude-code' in value || 'mcp-config' in value;
}

// ---------------------------------------------------------------------------
// Helper: convert ClaudeCodeHookEntry[] to ClaudeHookEntry[]
// ---------------------------------------------------------------------------

function buildHookEntries(entries: ClaudeCodeHookEntry[]): ClaudeHookEntry[] {
  return entries.map((entry): ClaudeHookEntry => {
    const hookEntry: ClaudeHookEntry = {
      hooks: entry.commands.map((cmd): ClaudeHookCommand => ({ type: 'command', command: cmd })),
    };
    if (entry.matcher) {
      hookEntry.matcher = entry.matcher;
    }
    return hookEntry;
  });
}

// ---------------------------------------------------------------------------
// Helper: build and write .claude/settings.json
// ---------------------------------------------------------------------------

async function writeClaudeSettings(
  hooksConfig: ClaudeCodeHooksConfig,
  workspaceRoot: string,
): Promise<void> {
  try {
    const hooksOutput: Record<string, ClaudeHookEntry[]> = {};

    if (hooksConfig.PreToolUse?.length) {
      hooksOutput.PreToolUse = buildHookEntries(hooksConfig.PreToolUse);
    }
    if (hooksConfig.PostToolUse?.length) {
      hooksOutput.PostToolUse = buildHookEntries(hooksConfig.PostToolUse);
    }
    if (hooksConfig.Stop?.length) {
      hooksOutput.Stop = buildHookEntries(hooksConfig.Stop);
    }
    if (hooksConfig.UserPromptSubmit?.length) {
      hooksOutput.UserPromptSubmit = buildHookEntries(hooksConfig.UserPromptSubmit);
    }
    if (hooksConfig.TaskCompleted?.length) {
      hooksOutput.TaskCompleted = buildHookEntries(hooksConfig.TaskCompleted);
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

async function writeMcpConfig(mcpConfig: McpConfigSection, workspaceRoot: string): Promise<void> {
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
      const workspaceRoot = await TemplatesManagerService.getWorkspaceRoot();
      const rawConfig = await TemplatesManagerService.readToolkitConfig();

      if (!rawConfig) {
        throw new Error('No .toolkit/settings.yaml found. Run `aicode init` first.');
      }

      // Widen to unknown so isRawSyncConfig can narrow without an `as` cast
      const config: unknown = rawConfig;
      if (!isRawSyncConfig(config)) {
        throw new Error(
          "Unexpected toolkit configuration format: expected 'claude-code' or 'mcp-config' section.",
        );
      }

      const all = !options.hooks && !options.mcp;
      const doHooks = all || !!options.hooks;
      const doMcp = all || !!options.mcp;
      const hooksRaw = config['claude-code']?.hooks ?? null;
      const mcpRaw = config['mcp-config'] ?? null;

      const writeTasks: Array<Promise<void>> = [];
      if (doHooks && hooksRaw) writeTasks.push(writeClaudeSettings(hooksRaw, workspaceRoot));
      if (doMcp && mcpRaw) writeTasks.push(writeMcpConfig(mcpRaw, workspaceRoot));
      await Promise.all(writeTasks);

      if (doHooks) {
        if (hooksRaw) {
          print.success('Written .claude/settings.json');
        } else {
          print.warning('No claude-code.hooks section in settings.yaml — skipping');
        }
      }
      if (doMcp) {
        if (mcpRaw) {
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
