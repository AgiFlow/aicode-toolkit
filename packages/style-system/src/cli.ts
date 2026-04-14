#!/usr/bin/env node
/**
 * MCP Server CLI Entry Point
 *
 * DESIGN PATTERNS:
 * - CLI pattern with Commander for argument parsing
 * - Command pattern for organizing CLI commands
 * - Transport abstraction for multiple communication methods
 *
 * CODING STANDARDS:
 * - Use async/await for asynchronous operations
 * - Handle errors gracefully with try-catch
 * - Log important events for debugging
 * - Register all commands in main entry point
 *
 * AVOID:
 * - Hardcoding command logic in index.ts (use separate command files)
 * - Missing error handling for command execution
 */

import { Command } from 'commander';
import { getCSSClassesCommand } from './commands/get-css-classes';
import { getUiComponentCommand } from './commands/get-ui-component';
import { listAppComponentsCommand } from './commands/list-app-components';
import { listThemesCommand } from './commands/list-themes';
import { listSharedComponentsCommand } from './commands/list-shared-components';
import { STYLE_SYSTEM_CLI_NAME, STYLE_SYSTEM_VERSION } from './metadata';
import { mcpServeCommand } from './commands/mcp-serve';

/**
 * Main entry point
 */
async function main() {
  const program = new Command();

  program
    .name(STYLE_SYSTEM_CLI_NAME)
    .description('MCP server for design system tools')
    .version(STYLE_SYSTEM_VERSION);

  // Add all commands
  program.addCommand(getCSSClassesCommand);
  program.addCommand(getUiComponentCommand);
  program.addCommand(listAppComponentsCommand);
  program.addCommand(listThemesCommand);
  program.addCommand(listSharedComponentsCommand);
  program.addCommand(mcpServeCommand);

  // Parse arguments
  await program.parseAsync(process.argv);
}

main();
