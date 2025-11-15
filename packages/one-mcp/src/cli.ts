#!/usr/bin/env node
/**
 * MCP Server Entry Point
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
import { mcpServeCommand } from './commands/mcp-serve';
import { listToolsCommand } from './commands/list-tools';
import { describeToolsCommand } from './commands/describe-tools';
import { useToolCommand } from './commands/use-tool';
import { initCommand } from './commands/init';
import packageJson from '../package.json' assert { type: 'json' };

/**
 * Main entry point
 */
async function main() {
  const program = new Command();

  program
    .name('one-mcp')
    .description('One MCP server package')
    .version(packageJson.version);

  // Add all commands
  program.addCommand(initCommand);
  program.addCommand(mcpServeCommand);
  program.addCommand(listToolsCommand);
  program.addCommand(describeToolsCommand);
  program.addCommand(useToolCommand);

  // Parse arguments
  await program.parseAsync(process.argv);
}

main();
