import type { Command } from 'commander';

/** Static, workspace-independent help. Short Commander descriptions remain readable at parent levels. */
export function attachCliHelp(program: Command): void {
  program.addHelpText(
    'after',
    `
Local workflow:
  scaffold-mcp boilerplate list
  scaffold-mcp boilerplate info <name>
  scaffold-mcp boilerplate create <name> --vars '{"appName":"demo"}'
  scaffold-mcp scaffold list [projectPath]
  scaffold-mcp scaffold info <name> [--project <path>]
  scaffold-mcp scaffold add <name> [--project <path>] --vars '{"featureName":"demo"}'

Discover commands progressively: scaffold-mcp <group> --help, then scaffold-mcp <group> <command> --help.
For scripts, pass --json to local commands. Run scaffold-mcp mcp-serve --help for server options.
`,
  );

  const boilerplate = program.commands.find((command) => command.name() === 'boilerplate');
  const scaffold = program.commands.find((command) => command.name() === 'scaffold');
  const template = program.commands.find((command) => command.name() === 'template');
  const file = program.commands.find((command) => command.name() === 'file');
  boilerplate?.addHelpText(
    'after',
    `
Workflow: list → info <name> (schema and instructions) → create <name>.
Use generate <name> to author a reusable boilerplate, not to instantiate a project.
Example: scaffold-mcp boilerplate list --json
`,
  );
  scaffold?.addHelpText(
    'after',
    `
Workflow: list [projectPath] → info <name> → add <name>.
With no project or template, discovery uses the current directory.
Use generate <name> to author a reusable feature scaffold, not to add a feature.
Example: scaffold-mcp scaffold list --template typescript-lib --json
`,
  );
  template?.addHelpText('after', '\nTemplate authoring: scaffold-mcp template file --help\n');
  template?.commands
    .find((command) => command.name() === 'file')
    ?.addHelpText(
      'after',
      '\nCreate Liquid source files for boilerplates/features: scaffold-mcp template file create --help\n',
    );
  file?.addHelpText('after', '\nWrite a workspace file: scaffold-mcp file write --help\n');

  const details: Record<string, string> = {
    'boilerplate list': `
MCP equivalent: list-boilerplates. Use when starting a project or choosing a template.
Returns names, descriptions and required variables; --cursor retrieves the next page.
Next: scaffold-mcp boilerplate info <name> (full schema and instructions).
Example: scaffold-mcp boilerplate list --json
`,
    'boilerplate info': `
Inspect the complete variables schema, included files, target folder and instructions before creating.
The name must match boilerplate list. This command does not create files.
Next: scaffold-mcp boilerplate create <name> --vars '<json-object>'
Example: scaffold-mcp boilerplate info typescript-lib --json
`,
    'boilerplate create': `
MCP equivalent: use-boilerplate. Use after boilerplate list and info to instantiate a project.
--vars accepts a JSON object matching the selected template's schema (inspect info for required keys).
--target-folder overrides the template destination; --monolith creates at workspace root.
--marker overrides the marker inserted into generated code. This command writes files.
Example: scaffold-mcp boilerplate create typescript-lib --vars '{"appName":"demo","packageName":"demo"}' --json
`,
    'boilerplate generate': `
MCP equivalent: generate-boilerplate. Authors an entry in a template's scaffold.yaml; does not create an app.
--description or --description-file and --variables <json-array> are required.
--target-folder is required outside monolith mode; --template selects a template (optional in monolith mode).
--instruction / --instruction-file are mutually exclusive; --include is repeatable.
Example: scaffold-mcp boilerplate generate scaffold-app --template typescript-lib --description 'App template' --target-folder apps --variables '[{"name":"appName","description":"Name","type":"string","required":true}]'
`,
    'scaffold list': `
MCP equivalent: list-scaffolding-methods. Discover features for [projectPath] (defaults to cwd).
Alternatively use --template <name>; a positional project takes precedence over --template.
--cursor retrieves another page. Lists are concise; inspect info for full schema and instructions.
Example: scaffold-mcp scaffold list ./apps/demo --json
Next: scaffold-mcp scaffold info <name> --project ./apps/demo
`,
    'scaffold info': `
Inspect a feature's variables schema, instructions and included files before adding it.
Use --project <path> (defaults to cwd) or --template <name> for discovery without a project.
Example: scaffold-mcp scaffold info scaffold-service --project ./apps/demo --json
Next: scaffold-mcp scaffold add scaffold-service --project ./apps/demo --vars '<json-object>'
`,
    'scaffold add': `
MCP equivalent: use-scaffold-method. Add a feature to --project <path> (defaults to cwd).
--vars accepts a JSON object matching the schema from scaffold info; --marker overrides generated markers.
Writes files, preserves existing files, and records SCAFFOLD_ID for pending-scaffold tracking.
Review generated files and the returned implementation instructions before running tests.
Example: scaffold-mcp scaffold add scaffold-service --project ./apps/demo --vars '{"serviceName":"UserService"}' --json
`,
    'scaffold generate': `
MCP equivalent: generate-feature-scaffold. Authors a feature entry in scaffold.yaml, not a project feature instance.
--description or --description-file and --variables <json-array> are required.
--template selects a template (optional in monolith mode); --include and --pattern are repeatable.
--instruction and --instruction-file are mutually exclusive.
Example: scaffold-mcp scaffold generate scaffold-service --template typescript-lib --description 'Service' --variables '[{"name":"serviceName","description":"Name","type":"string","required":true}]'
`,
    'template file create': `
MCP equivalent: generate-boilerplate-file. Creates/updates a Liquid source template (.liquid).
Provide exactly one of --content, --content-file, --source-file; --header and --header-file are mutually exclusive.
--template selects a template (optional in monolith mode). Liquid placeholders and filters render during scaffolding.
Example: scaffold-mcp template file create src/index.ts --template typescript-lib --content 'export const name = "{{ appName }}";' --json
`,
    'file write': `
MCP equivalent: write-to-file. Writes a file inside the current workspace.
Use exactly one of --content or --content-file. Check the destination before overwriting.
Example: scaffold-mcp file write .env.local --content 'API_URL=https://example.com' --json
`,
  };
  for (const [path, text] of Object.entries(details)) {
    let command: Command | undefined = program;
    for (const segment of path.split(' '))
      command = command?.commands.find((item) => item.name() === segment);
    command?.addHelpText('after', text);
  }
}
