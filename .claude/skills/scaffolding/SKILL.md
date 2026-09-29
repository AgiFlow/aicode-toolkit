---
name: scaffolding
description: Use scaffold-mcp CLI commands for project boilerplates, feature
  scaffolds, template authoring, and scaffold-backed file creation. Trigger
  before creating new files, when adding
  routes/components/services/packages/apps, when listing available scaffolds, or
  when replacing legacy scaffold tool usage.
commands:
  - ^bun\s+run\s+packages/scaffold-mcp/src/cli\.ts\b
metadata:
  paths:
    - templates/**/scaffold.yaml
    - templates/**/*.liquid
    - project.json
    - "**/project.json"
---

# Scaffolding

Use `bun run packages/scaffold-mcp/src/cli.ts`, not MCP tools, for scaffolding. Run a list or info command before manually creating files unless the user explicitly asks for hand-written files.

## Commands

```bash
bun run packages/scaffold-mcp/src/cli.ts boilerplate list
bun run packages/scaffold-mcp/src/cli.ts boilerplate info <name>
bun run packages/scaffold-mcp/src/cli.ts boilerplate create <name> --vars '<json>'

bun run packages/scaffold-mcp/src/cli.ts scaffold list <project-path>
bun run packages/scaffold-mcp/src/cli.ts scaffold list --template <template-name>
bun run packages/scaffold-mcp/src/cli.ts scaffold info <feature-name> --project <project-path>
bun run packages/scaffold-mcp/src/cli.ts scaffold add <feature-name> --project <project-path> --vars '<json>'
```

## Template Authoring

```bash
bun run packages/scaffold-mcp/src/cli.ts boilerplate generate <name> --template <template> --description '<text>' --target-folder <folder> --variables '<json>'
bun run packages/scaffold-mcp/src/cli.ts scaffold generate <name> --template <template> --description '<text>' --variables '<json>'
bun run packages/scaffold-mcp/src/cli.ts template file create <file-path> --template <template> --content-file <path>
bun run packages/scaffold-mcp/src/cli.ts file write <file-path> --content-file <path>
```

## Rules

- Use `boilerplate list` before creating a new project or package.
- Use `scaffold list <project-path>` before adding files to an existing project.
- Use exact variable names from `boilerplate info` or `scaffold info`.
- Use `--vars '<json>'` with valid JSON. Prefer single quotes around the JSON in shell commands.
- Keep generated files within the target project and review them before custom edits.
- Run the relevant `nx typecheck`, `nx test-*`, or `nx fixcode` target after generated code is implemented.
