#!/usr/bin/env node
import { Command } from 'commander';
import packageJson from '../package.json' assert { type: 'json' };
import { addCommand, initCommand, syncCommand } from './commands';

/**
 * Main entry point
 */
async function main() {
  try {
    const program = new Command();

    program
      .name('aicode')
      .description(
        'AI-powered code toolkit CLI for scaffolding, architecture management, and development workflows',
      )
      .version(packageJson.version);

    // Add all commands
    program.addCommand(initCommand);
    program.addCommand(addCommand);
    program.addCommand(syncCommand);

    // Parse arguments
    await program.parseAsync(process.argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`aicode: ${message}`);
    process.exit(1);
  }
}

main();
