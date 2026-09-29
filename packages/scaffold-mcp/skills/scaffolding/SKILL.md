---
name: scaffolding
description: Use scaffold-mcp CLI commands for project boilerplates, feature
  scaffolds, template authoring, and scaffold-backed file creation. Trigger
  before creating new files, when adding
  routes/components/services/packages/apps, when listing available scaffolds, or
  when replacing legacy scaffold tool usage.
commands:
  - ^npx\s+--yes\s+@agiflowai/scaffold-mcp@2\.0\.0\b
metadata:
  paths:
    - templates/**/scaffold.yaml
    - templates/**/*.liquid
    - project.json
    - '**/project.json'
---

# Scaffolding

Use `npx --yes @agiflowai/scaffold-mcp@2.0.0`, not MCP tools, for scaffolding. Run a list or info command before manually creating files unless the user explicitly asks for hand-written files.

## Commands

```bash
npx --yes @agiflowai/scaffold-mcp@2.0.0 boilerplate list
npx --yes @agiflowai/scaffold-mcp@2.0.0 boilerplate info <name>
npx --yes @agiflowai/scaffold-mcp@2.0.0 boilerplate create <name> --vars '<json>'

npx --yes @agiflowai/scaffold-mcp@2.0.0 scaffold list <project-path>
npx --yes @agiflowai/scaffold-mcp@2.0.0 scaffold list --template <template-name>
npx --yes @agiflowai/scaffold-mcp@2.0.0 scaffold info <feature-name> --project <project-path>
npx --yes @agiflowai/scaffold-mcp@2.0.0 scaffold add <feature-name> --project <project-path> --vars '<json>'
```

## Template Authoring

```bash
npx --yes @agiflowai/scaffold-mcp@2.0.0 boilerplate generate <name> --template <template> --description '<text>' --target-folder <folder> --variables '<json>'
npx --yes @agiflowai/scaffold-mcp@2.0.0 scaffold generate <name> --template <template> --description '<text>' --variables '<json>'
npx --yes @agiflowai/scaffold-mcp@2.0.0 template file create <file-path> --template <template> --content-file <path>
npx --yes @agiflowai/scaffold-mcp@2.0.0 file write <file-path> --content-file <path>
```

## Rules

- Use `boilerplate list` before creating a new project or package.
- Use `scaffold list <project-path>` before adding files to an existing project.
- Use exact variable names from `boilerplate info` or `scaffold info`.
- Use `--vars '<json>'` with valid JSON. Prefer single quotes around the JSON in shell commands.
- Keep generated files within the target project and review them before custom edits.
- Run the relevant `nx typecheck`, `nx test-*`, or `nx fixcode` target after generated code is implemented.
