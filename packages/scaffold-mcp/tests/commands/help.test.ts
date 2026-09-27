import { Command } from 'commander';
import { describe, expect, it } from 'vitest';
import { attachCliHelp } from '../../src/cli-help';

function program(): Command {
  const root = new Command('scaffold-mcp');
  const boilerplate = root.command('boilerplate');
  for (const name of ['list', 'info <name>', 'create <name>', 'generate <name>']) {
    boilerplate.command(name).description(name.split(' ')[0]);
  }
  const scaffold = root.command('scaffold');
  for (const name of ['list', 'info <name>', 'add <name>', 'generate <name>']) {
    scaffold.command(name).description(name.split(' ')[0]);
  }
  root.command('template').command('file').command('create <path>');
  root.command('file').command('write <path>');
  attachCliHelp(root);
  return root;
}

describe('progressive CLI help', () => {
  it('keeps root and group help concise and navigable', () => {
    const root = program();
    expect(root.helpInformation()).toContain('boilerplate');
    expect(root.helpInformation()).not.toContain('SCAFFOLD_ID');
    const group = root.commands.find((command) => command.name() === 'scaffold')!;
    expect(group.helpInformation()).toContain('add');
    expect(group.helpInformation()).not.toContain('SCAFFOLD_ID');
  });

  it('exposes tool-equivalent constraints and copyable examples at leaf level', () => {
    const root = program();
    const output: string[] = [];
    const leaf = root.commands
      .find((command) => command.name() === 'template')!
      .commands.find((command) => command.name() === 'file')!
      .commands.find((command) => command.name() === 'create')!;
    leaf.configureOutput({ writeOut: (text) => output.push(text) });
    leaf.outputHelp();
    expect(output.join('')).toContain('generate-boilerplate-file');
    expect(output.join('')).toContain('exactly one of --content');
    expect(output.join('')).toContain('scaffold-mcp template file create');
  });
});
