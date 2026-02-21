# @agiflowai/scaffold-mcp

> MCP server for scaffolding applications with templates and feature generators

Generate consistent, convention-following code for your AI coding agents. scaffold-mcp provides templates for common patterns (routes, components, services) so agents don't write boilerplate from scratch.

## Why Use This?

When you ask an AI agent to "add a new page," it generates working code—but not necessarily code that follows your team's patterns. scaffold-mcp solves this by:

1. **Providing templates** for common patterns your team has standardized
2. **Enforcing structure** so every route, component, or service looks the same
3. **Reducing boilerplate** by generating the repetitive parts automatically

Think of it as "Rails generators" or "Angular schematics" for any stack.

---

## Quick Start

### 1. Install Templates

```bash
# Downloads built-in templates to your workspace
npx @agiflowai/aicode-toolkit init
```

### 2. Configure Your AI Agent

Add to your MCP config (`.mcp.json`, `.cursor/mcp.json`, etc.):

```json
{
  "mcpServers": {
    "scaffold-mcp": {
      "command": "npx",
      "args": ["-y", "@agiflowai/scaffold-mcp", "mcp-serve", "--admin-enable"]
    }
  }
}
```

**Flags:**
- `--admin-enable`: Enables tools for creating new templates (optional, useful during setup)

### 3. Start Using

Your AI agent now has access to scaffolding tools:

```
You: "Create a new Next.js app called dashboard"
Agent: [calls list-boilerplates, then use-boilerplate]

You: "Add a products page"
Agent: [calls list-scaffolding-methods, then use-scaffold-method]
```

---

## Available Tools

### Standard Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `list-boilerplates` | Show available project templates | Starting a new project |
| `use-boilerplate` | Create project from template | After choosing a template |
| `list-scaffolding-methods` | Show features for a project | Adding to existing project |
| `use-scaffold-method` | Add feature to project | After choosing a feature |
| `write-to-file` | Write content to file | Custom files not in templates |

### Admin Tools (with `--admin-enable`)

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `generate-boilerplate` | Create new project template | Building custom templates |
| `generate-feature-scaffold` | Create new feature scaffold | Adding feature generators |
| `generate-boilerplate-file` | Add files to templates | Populating template files |

---

## How It Works

```
Your Project                          Templates Directory
─────────────                         ───────────────────
apps/
├── my-app/                           templates/
│   ├── project.json ──────────────►  └── nextjs-15/
│   │   └── sourceTemplate: "nextjs-15"    ├── scaffold.yaml    ← Defines what can be generated
│   └── src/                               ├── architect.yaml   ← Design patterns (optional)
│       └── app/                           ├── RULES.yaml       ← Coding rules (optional)
│           └── page.tsx                   └── src/             ← Template files (.liquid)
```

1. **Templates define patterns**: Each template has a `scaffold.yaml` that defines boilerplates and features
2. **Projects reference templates**: Your `project.json` has a `sourceTemplate` field pointing to the template
3. **Tools generate code**: MCP tools read the template and generate files in your project

---

## Built-in Templates

| Template | Stack | What You Can Generate |
|----------|-------|----------------------|
| `nextjs-15-drizzle` | Next.js 15 + App Router | Pages, layouts, components, API routes |
| `typescript-lib` | TypeScript library | Library structure, tests |
| `typescript-mcp-package` | MCP server | CLI commands, MCP tools |

---

## CLI Commands

scaffold-mcp also works as a standalone CLI:

```bash
# List available boilerplates
npx @agiflowai/scaffold-mcp boilerplate list

# Get info about a boilerplate
npx @agiflowai/scaffold-mcp boilerplate info nextjs-15-drizzle

# Create project from boilerplate
npx @agiflowai/scaffold-mcp boilerplate create nextjs-15-drizzle \
  --vars '{"projectName":"my-app","packageName":"@myorg/my-app"}'

# List features for a project
npx @agiflowai/scaffold-mcp scaffold list ./apps/my-app

# Add feature to project
npx @agiflowai/scaffold-mcp scaffold add scaffold-nextjs-page \
  --project ./apps/my-app \
  --vars '{"pageTitle":"About","nextjsPagePath":"/about"}'
```

---

## Server Options

```bash
# stdio transport (default) - for Claude Code, Cursor
npx @agiflowai/scaffold-mcp mcp-serve

# HTTP transport - for web applications
npx @agiflowai/scaffold-mcp mcp-serve --type http --port 3000

# SSE transport - for streaming clients
npx @agiflowai/scaffold-mcp mcp-serve --type sse --port 3000

# With admin tools enabled
npx @agiflowai/scaffold-mcp mcp-serve --admin-enable

# With Claude Code skill front matter on prompts
npx @agiflowai/scaffold-mcp mcp-serve --prompt-as-skill

# With a fallback LLM tool for scaffold operations
npx @agiflowai/scaffold-mcp mcp-serve --fallback-tool claude-code

# Fallback tool with a specific model config
npx @agiflowai/scaffold-mcp mcp-serve \
  --fallback-tool claude-code \
  --fallback-tool-config '{"model":"claude-sonnet-4-6"}'
```

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --type` | Transport: `stdio`, `http`, `sse` | `stdio` |
| `-p, --port` | Port for HTTP/SSE | `3000` |
| `--host` | Host for HTTP/SSE | `localhost` |
| `--admin-enable` | Enable template creation tools | `false` |
| `--prompt-as-skill` | Render MCP prompts with Claude Code skill front matter, exposing them as `/skill` commands | `false` |
| `--fallback-tool` | LLM tool for scaffold operations (`claude-code`, `gemini-cli`, `codex`) | disabled |
| `--fallback-tool-config` | JSON config for the fallback tool (e.g., `{"model":"claude-sonnet-4-6"}`) | `{}` |

---

## Creating Custom Templates

### Option 1: Using Admin Tools (Recommended)

Ask your AI agent:
```
"Create a boilerplate template for our React + Vite setup"
```

The agent will use:
1. `generate-boilerplate` - Creates scaffold.yaml entry
2. `generate-boilerplate-file` - Adds template files

### Option 2: Manually

Create the template structure:

```
templates/my-template/
├── scaffold.yaml           # Required: defines boilerplates and features
└── src/                    # Template files (use .liquid for variable replacement)
    ├── package.json.liquid
    └── src/
        └── index.ts.liquid
```

**scaffold.yaml example:**

```yaml
boilerplate:
  name: my-template-app
  description: My custom application template
  targetFolder: apps
  variables_schema:
    type: object
    properties:
      projectName:
        type: string
        description: Project directory name
      packageName:
        type: string
        description: NPM package name
    required:
      - projectName
      - packageName
  includes:
    - package.json
    - src/index.ts

features:
  - name: scaffold-component
    description: Add a React component
    variables_schema:
      type: object
      properties:
        componentName:
          type: string
          description: Component name (PascalCase)
      required:
        - componentName
    includes:
      - src/components/{{ componentName }}/{{ componentName }}.tsx
```

**Template file example (package.json.liquid):**

```json
{
  "name": "{{ packageName }}",
  "version": "0.1.0",
  "description": "{{ description | default: 'My application' }}"
}
```

---

## Hooks Integration (Experimental)

> **Note:** This feature is experimental and may change.

Hooks let scaffold-mcp proactively suggest templates when your AI agent creates files.

**Claude Code setup** (`.claude/settings.json`):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "npx @agiflowai/scaffold-mcp hook --type claude-code.preToolUse"
          }
        ]
      }
    ]
  }
}
```

When Claude tries to write a new file, the hook shows available scaffolding methods that match, so Claude can use templates instead of writing from scratch.

See [Hooks Documentation](./docs/hooks.md) for details.

---

## Documentation

| Document | Description |
|----------|-------------|
| [MCP Tools Reference](./docs/mcp-tools.md) | Detailed tool documentation |
| [CLI Commands](./docs/cli-commands.md) | Complete CLI reference |
| [Template Conventions](./docs/template-conventions.md) | How to create templates |
| [Advanced Generators](./docs/advanced-generators.md) | Custom TypeScript generators |
| [Hooks Integration](./docs/hooks.md) | AI agent hooks setup |

---

## License

AGPL-3.0
