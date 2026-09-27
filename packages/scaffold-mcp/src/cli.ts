#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { Command } from 'commander';
import packageJson from '../package.json' with { type: 'json' };
import { boilerplateCommand } from './commands/boilerplate';
import { fileCommand } from './commands/file';
import { mcpServeCommand } from './commands/mcp-serve';
import { scaffoldCommand } from './commands/scaffold';
import { hookCommand } from './commands/hook';
import { templateCommand } from './commands/template';
import { attachCliHelp } from './cli-help';

/** Build the local CLI without starting the server or parsing arguments. */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('scaffold-mcp')
    .description(
      'Scaffold projects and features locally from reusable templates (or run the MCP server)',
    )
    .version(packageJson.version);

  // Add all commands
  program.addCommand(mcpServeCommand);
  program.addCommand(boilerplateCommand);
  program.addCommand(scaffoldCommand);
  program.addCommand(templateCommand);
  program.addCommand(fileCommand);
  program.addCommand(hookCommand);
  attachCliHelp(program);
  const localGroups = [boilerplateCommand, scaffoldCommand, templateCommand, fileCommand];
  program.showHelpAfterError('Run scaffold-mcp --help to discover commands.');
  for (const group of localGroups) {
    group.showHelpAfterError(`Run scaffold-mcp ${group.name()} --help to discover commands.`);
    for (const child of group.commands) {
      child.showHelpAfterError(
        `Run scaffold-mcp ${group.name()} ${child.name()} --help for usage.`,
      );
      for (const leaf of child.commands) {
        leaf.showHelpAfterError(
          `Run scaffold-mcp ${group.name()} ${child.name()} ${leaf.name()} --help for usage.`,
        );
      }
    }
  }
  return program;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const program = createProgram();
  const args = process.argv.slice(2);
  const localCommands = ['boilerplate', 'scaffold', 'template', 'file'];
  if (args.includes('--json') && localCommands.includes(args[0])) {
    // Commander validation errors must obey the same JSON stream contract as action errors.
    const configure = (command: Command): void => {
      command.configureOutput({ writeErr: () => undefined });
      command.exitOverride();
      for (const child of command.commands) configure(child);
    };
    configure(program);
    void program.parseAsync(process.argv).catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'commander.helpDisplayed')
        return;
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `${JSON.stringify({ success: false, error: { code: 'INVALID_INPUT', message } })}\n`,
      );
      process.exitCode = 1;
    });
  } else {
    void program.parseAsync(process.argv);
  }
}
