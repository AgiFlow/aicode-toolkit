# AI Code Toolkit

[![npm version](https://img.shields.io/npm/v/@agiflowai/scaffold-mcp.svg?style=flat-square)](https://www.npmjs.com/package/@agiflowai/scaffold-mcp)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg?style=flat-square)](https://opensource.org/licenses/AGPL-3.0)
[![Discord](https://dcbadge.limes.pink/api/server/https://discord.gg/NsB6q9Vas9?style=flat-square)](https://discord.gg/NsB6q9Vas9)

![AI Code Toolkit Banner](./docs/workflow.jpg)

MCP servers that teach AI coding agents your team's conventions. Provides scaffolding templates, design patterns, and code review rules.

---

## Why This Exists

AI agents generate functional code, but they don't know your project's structure, naming conventions, or architectural patterns. You end up manually fixing inconsistencies.

This toolkit solves that with three components:

1. **Templates** - Scaffolding for routes, components, services
2. **Design Patterns** - Per-file-type architectural guidance
3. **Rules** - Automated validation before code ships

Think Rails conventions, but for any stack, enforced by your AI agent.

---

## Quick Start

**Requirements:** Node.js >= 18, MCP-compatible agent (Claude Code, Cursor, Gemini CLI)

### 1. Initialize

```bash
# Existing project
npx @agiflowai/aicode-toolkit init

# New project
npx @agiflowai/aicode-toolkit init --name my-app --project-type monolith
```

Creates `templates/` with scaffold definitions, patterns, and rules.

### 2. Configure MCP

The init command configures MCP automatically. For manual setup:

**Claude Code** (`.mcp.json`):

```json
{
  "mcpServers": {
    "scaffold-mcp": {
      "command": "npx",
      "args": ["-y", "@agiflowai/scaffold-mcp", "mcp-serve", "--admin-enable"]
    },
    "architect-mcp": {
      "command": "npx",
      "args": [
        "-y", "@agiflowai/architect-mcp", "mcp-serve",
        "--admin-enable",
        "--design-pattern-tool", "claude-code",
        "--review-tool", "claude-code"
      ]
    }
  }
}
```

**Cursor**: Same config in `.cursor/mcp.json`

**Flags:**
- `--admin-enable` - Allow template creation
- `--design-pattern-tool claude-code` - AI-powered pattern analysis
- `--review-tool claude-code` - AI-powered code review

### 3. Verify

Ask your agent: *"What boilerplates are available?"*

Should call `list-boilerplates`. If not recognized, restart the agent.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Your AI Agent                           │
│         (Claude Code, Cursor, Gemini CLI, etc.)             │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
       ┌─────────────┐                 ┌──────────────┐
       │ scaffold-mcp│                 │ architect-mcp│
       │             │                 │              │
       │ Generates   │                 │ Guides and   │
       │ code from   │                 │ validates    │
       │ templates   │                 │ code quality │
       └─────────────┘                 └──────────────┘
              │                               │
              └───────────────┬───────────────┘
                              ▼
                    ┌─────────────────┐
                    │    templates/   │
                    │                 │
                    │ scaffold.yaml   │  ← Generation rules
                    │ architect.yaml  │  ← Design patterns
                    │ RULES.yaml      │  ← Coding standards
                    └─────────────────┘
```

### scaffold-mcp

Code generation from templates.

| Tool | Description |
|------|-------------|
| `list-boilerplates` | Available project templates |
| `use-boilerplate` | Create project from template |
| `list-scaffolding-methods` | Available features for a project |
| `use-scaffold-method` | Add feature (page, route, service) |

**Admin tools** (`--admin-enable`):

| Tool | Description |
|------|-------------|
| `generate-boilerplate` | Create project template |
| `generate-feature-scaffold` | Create feature scaffold |
| `generate-boilerplate-file` | Add template files |

### architect-mcp

Design guidance and validation.

| Tool | Description |
|------|-------------|
| `get-file-design-pattern` | Get patterns/rules before editing |
| `review-code-change` | Validate code after editing |

**Admin tools** (`--admin-enable`):

| Tool | Description |
|------|-------------|
| `add-design-pattern` | Add to `architect.yaml` |
| `add-rule` | Add to `RULES.yaml` |

---

## Workflow

### Creating Projects

```
User: "Create a Next.js app called dashboard"

Agent:
1. list-boilerplates → finds nextjs-drizzle
2. use-boilerplate projectName:"dashboard"
3. Done: full project with patterns configured
```

### Before Editing Files

```
User: "Add a products page"

Agent:
1. get-file-design-pattern for src/app/products/page.tsx
2. Receives: patterns, must-do rules, must-not-do rules, examples
3. Writes code following patterns
```

### Adding Features

```
User: "Add a products API route"

Agent:
1. list-scaffolding-methods
2. use-scaffold-method method:"add-route" name:"products"
3. Done: route with team's boilerplate
```

### After Editing

```
Agent:
1. review-code-change for edited file
2. Gets: violations (critical/warning/suggestion)
3. Fixes violations
```

---

## Template Structure

```
templates/
└── nextjs-15/
    ├── scaffold.yaml      # What to generate
    ├── architect.yaml     # Design patterns
    ├── RULES.yaml         # Coding standards
    └── boilerplate/       # Template files (Liquid)
```

### scaffold.yaml

```yaml
boilerplates:
  - name: nextjs-15-app
    description: "Next.js 15 with App Router"
    targetFolder: apps
    includes:
      - boilerplate/**/*

features:
  - name: add-route
    description: "Add route with page and layout"
    variables_schema:
      name: { type: string, required: true }
    includes:
      - features/route/**/*
```

### architect.yaml

```yaml
patterns:
  - name: server-component
    description: "Default for page components"
    file_patterns:
      - "**/app/**/page.tsx"
    guidance: |
      - Use async/await for data fetching
      - Keep components focused on rendering
      - Move business logic to server actions
    examples:
      - file: examples/page.tsx
```

### RULES.yaml

```yaml
rules:
  - id: no-client-directive-in-pages
    severity: error
    category: must_not_do
    file_patterns:
      - "**/app/**/page.tsx"
    pattern: "'use client'"
    message: "Pages should be server components. Extract client logic."

  - id: default-export-required
    severity: error
    category: must_do
    file_patterns:
      - "**/app/**/page.tsx"
    check: has_default_export
    message: "Page components must export default."
```

---

## Built-in Templates

| Template | Stack | Includes |
|----------|-------|----------|
| `nextjs-drizzle` | Next.js 15, App Router | TypeScript, Tailwind 4, Drizzle, Storybook |
| `typescript-lib` | TypeScript Library | ESM/CJS, Vitest, TSDoc |
| `typescript-mcp-package` | MCP Server | Commander, MCP SDK |

### Custom Templates

Ask your agent to create one:

```
"Create a boilerplate for our React + Vite setup"
```

Agent uses `generate-boilerplate`, `generate-boilerplate-file`, `add-design-pattern`, `add-rule`.

---

## Project Types

### Monorepo

Template reference in `project.json`:

```
my-workspace/
├── apps/
│   └── web-app/
│       └── project.json  ← { "sourceTemplate": "nextjs-15" }
├── packages/
│   └── shared-lib/
│       └── project.json  ← { "sourceTemplate": "typescript-lib" }
└── templates/
```

### Monolith

Configuration in `toolkit.yaml`:

```yaml
version: "1.0"
projectType: monolith
sourceTemplate: nextjs-15
```

Auto-detected based on config files.

---

## Token Optimization

Use `one-mcp` to reduce token usage ~90% via progressive tool discovery:

```json
{
  "mcpServers": {
    "one-mcp": {
      "command": "npx",
      "args": ["-y", "@agiflowai/one-mcp", "--config", ".mcp-servers.yaml"]
    }
  }
}
```

See [@agiflowai/one-mcp](./packages/one-mcp).

---

## Supported Agents

| Agent | Config Location | Status |
|-------|-----------------|--------|
| Claude Code | `.mcp.json` | Supported |
| Cursor | `.cursor/mcp.json` | Supported |
| Gemini CLI | `.gemini/settings.json` | Supported |
| Codex CLI | `.codex/config.json` | Supported |
| GitHub Copilot | VS Code settings | Supported |
| Windsurf | - | Coming Soon |

---

## Packages

| Package | Description |
|---------|-------------|
| [@agiflowai/aicode-toolkit](./apps/aicode-toolkit) | CLI for init and template management |
| [@agiflowai/scaffold-mcp](./packages/scaffold-mcp) | Code scaffolding server |
| [@agiflowai/architect-mcp](./packages/architect-mcp) | Patterns and review server |
| [@agiflowai/one-mcp](./packages/one-mcp) | MCP proxy for token reduction |

---

## Troubleshooting

**Agent doesn't recognize tools:**
1. Restart agent to reload MCP servers
2. Verify config file location
3. Test: `npx @agiflowai/scaffold-mcp mcp-serve`

**Templates not found:**
1. Run `npx @agiflowai/aicode-toolkit init`
2. Verify `templates/` exists at workspace root

**Code review missing violations:**
1. Check `RULES.yaml` exists
2. Verify file patterns match paths
3. Enable AI analysis: `--review-tool claude-code`

---

## Contributing

See [CONTRIBUTING.md](./docs/CONTRIBUTING.md).

## License

[AGPL-3.0](./LICENSE)

---

[Issues](https://github.com/AgiFlow/aicode-toolkit/issues) · [Discord](https://discord.gg/NsB6q9Vas9) · [Website](https://agiflow.io)
