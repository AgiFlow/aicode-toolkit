#!/usr/bin/env node
import { Command } from 'commander';
import packageJson from '../package.json' assert { type: 'json' };
import { boilerplateCommand } from './commands/boilerplate';
import { mcpServeCommand } from './commands/mcp-serve';
import { scaffoldCommand } from './commands/scaffold';
import { hookCommand } from './commands/hook';

/**
 * Main entry point
 */
async function main() {
  const program = new Command();

  program
    .name('scaffold-mcp')
    .description('MCP server for scaffolding applications with boilerplate templates')
    .version(packageJson.version);

  // Add all commands
  program.addCommand(mcpServeCommand);
  program.addCommand(boilerplateCommand);
  program.addCommand(scaffoldCommand);
  program.addCommand(hookCommand);

  // Parse arguments
  await program.parseAsync(process.argv);
}

main();
