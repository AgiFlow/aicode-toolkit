# AI Code Toolkit

> Help AI coding agents write consistent, production-ready code

[![npm version](https://img.shields.io/npm/v/@agiflowai/scaffold-mcp.svg?style=flat-square)](https://www.npmjs.com/package/@agiflowai/scaffold-mcp)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg?style=flat-square)](https://opensource.org/licenses/AGPL-3.0)
[![Discord](https://dcbadge.limes.pink/api/server/https://discord.gg/NsB6q9Vas9?style=flat-square)](https://discord.gg/NsB6q9Vas9)

![AI Code Toolkit Banner](./docs/workflow.jpg)

---

## The Problem

AI coding agents are powerful, but they have a fundamental limitation: **they don't know your team's conventions**.

When you ask an agent to "add a new API route," it will generate working code. But will it:
- Follow your project's file structure?
- Use your preferred error handling patterns?
- Match your naming conventions?
- Include the boilerplate your team expects?

Usually not. You end up spending time fixing inconsistencies instead of building features.

**AI Code Toolkit solves this** by giving agents three things they need:

1. **Templates** - Pre-built scaffolding for common patterns (routes, components, services)
2. **Design Patterns** - Architectural guidance specific to each file type
3. **Rules** - Validation to catch violations before code is committed

Think of it like Rails conventions or Angular's opinionated structure—but for any tech stack, enforced by your AI agent.

---

## Quick Start

### Prerequisites

- Node.js >= 18
- An MCP-compatible AI coding tool (Claude Code, Cursor, Gemini CLI, etc.)

### Step 1: Initialize Your Project

```bash
# For existing projects - downloads templates to your workspace
npx @agiflowai/aicode-toolkit init

# For new projects - creates project structure + templates
npx @agiflowai/aicode-toolkit init --name my-app --project-type monolith
```

This creates a `templates/` directory with scaffolding definitions, design patterns, and coding rules.

### Step 2: Configure MCP Servers

MCP (Model Context Protocol) lets AI agents use external tools. Add these servers to your agent's config:

**For Claude Code** (`.mcp.json` or `claude_desktop_config.json`):

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

**For Cursor** (`.cursor/mcp.json`) - same configuration as above.

**What the flags mean:**
- `--admin-enable`: Allows the agent to create new templates (useful during setup)
- `--design-pattern-tool claude-code`: Uses Claude to analyze patterns in files
- `--review-tool claude-code`: Uses Claude for intelligent code review

### Step 3: Verify It's Working

Ask your AI agent: *"What boilerplates are available?"*

It should call `list-boilerplates` and show you the available templates. If it doesn't recognize the tool, restart your agent to reload MCP servers.

---

## How It Works

The toolkit has two MCP servers that work together:

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
                    │ scaffold.yaml   │  ← What to generate
                    │ architect.yaml  │  ← Design patterns
                    │ RULES.yaml      │  ← Coding standards
                    └─────────────────┘
```

### scaffold-mcp: Code Generation

Generates boilerplate code from templates. Use it when creating:
- New projects (from boilerplate templates)
- New features (routes, components, services, etc.)

**Available Tools:**

| Tool | Purpose |
|------|---------|
| `list-boilerplates` | Show available project templates with their variables |
| `use-boilerplate` | Create a new project from a template |
| `list-scaffolding-methods` | Show features available for a specific project |
| `use-scaffold-method` | Add a feature (page, component, API route, etc.) |

**Admin Tools** (when `--admin-enable` is set):

| Tool | Purpose |
|------|---------|
| `generate-boilerplate` | Create a new project template |
| `generate-feature-scaffold` | Create a new feature scaffold |
| `generate-boilerplate-file` | Add files to a template |

### architect-mcp: Design Guidance & Code Review

Provides context about how code should be written and validates output.

**Available Tools:**

| Tool | Purpose |
|------|---------|
| `get-file-design-pattern` | Get patterns and rules for a file before editing |
| `review-code-change` | Validate code against rules after editing |

**Admin Tools** (when `--admin-enable` is set):

| Tool | Purpose |
|------|---------|
| `add-design-pattern` | Add a new pattern to `architect.yaml` |
| `add-rule` | Add a new rule to `RULES.yaml` |

---

## The Development Workflow

Here's how an AI agent should use these tools during development:

### 1. Creating a New Project

```
You: "Create a new Next.js app called dashboard"

Agent:
1. Calls list-boilerplates → sees nextjs-15-drizzle template
2. Calls use-boilerplate with projectName: "dashboard"
3. Result: Full project structure with patterns and rules configured
```

### 2. Before Editing Any File

**This is critical.** Before the agent writes code, it should understand your conventions:

```
You: "Add a products page"

Agent:
1. Calls get-file-design-pattern for src/app/products/page.tsx
2. Receives:
   - Design patterns (e.g., "Use server components by default")
   - Must-do rules (e.g., "Export page component as default")
   - Must-not-do rules (e.g., "Don't use client-side data fetching")
   - Code examples showing the expected structure
3. Writes code following these patterns
```

### 3. Adding Standard Features

For repetitive patterns (routes, components, services), use scaffolding:

```
You: "Add a products API route"

Agent:
1. Calls list-scaffolding-methods for the project
2. Sees available scaffolds: add-route, add-component, add-service, etc.
3. Calls use-scaffold-method with method: "add-route", name: "products"
4. Result: Route created with your team's boilerplate
```

### 4. After Editing Files

Validate the code before moving on:

```
Agent (after writing code):
1. Calls review-code-change for src/app/products/page.tsx
2. Receives:
   - Critical violations (must fix)
   - Warnings (should fix)
   - Suggestions (nice to have)
3. Fixes any violations before proceeding
```

---

## Template Structure

Templates live in your `templates/` directory. Each template has:

```
templates/
└── nextjs-15/
    ├── scaffold.yaml      # Boilerplates and feature scaffolds
    ├── architect.yaml     # Design patterns for this framework
    ├── RULES.yaml         # Coding standards and validation rules
    └── boilerplate/       # Template files (Liquid syntax)
        ├── src/
        ├── package.json.liquid
        └── ...
```

### scaffold.yaml

Defines what can be generated:

```yaml
boilerplates:
  - name: nextjs-15-app
    description: "Next.js 15 with App Router"
    targetFolder: apps
    includes:
      - boilerplate/**/*

features:
  - name: add-route
    description: "Add a new route with page and layout"
    variables_schema:
      name: { type: string, required: true }
    includes:
      - features/route/**/*
```

### architect.yaml

Defines design patterns:

```yaml
patterns:
  - name: server-component
    description: "Default pattern for page components"
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

Defines coding standards:

```yaml
rules:
  - id: no-client-directive-in-pages
    severity: error
    category: must_not_do
    description: "Pages should be server components"
    file_patterns:
      - "**/app/**/page.tsx"
    pattern: "'use client'"
    message: "Don't use 'use client' in page components. Extract client logic to separate components."

  - id: default-export-required
    severity: error
    category: must_do
    description: "Pages must have default export"
    file_patterns:
      - "**/app/**/page.tsx"
    check: has_default_export
    message: "Page components must be exported as default."
```

---

## Built-in Templates

The toolkit comes with production-ready templates:

| Template | Stack | Features |
|----------|-------|----------|
| `nextjs-15-drizzle` | Next.js 15 + App Router | TypeScript, Tailwind CSS 4, Drizzle ORM, Storybook |
| `typescript-lib` | TypeScript Library | ESM/CJS builds, Vitest, TSDoc |
| `typescript-mcp-package` | MCP Server | Commander CLI, MCP SDK, TypeScript |

### Creating Custom Templates

You can create templates for your specific stack:

1. **Ask your agent** to generate a new boilerplate:
   ```
   "Create a boilerplate template for our React + Vite setup"
   ```

2. **Agent uses admin tools**:
   - `generate-boilerplate` - Creates scaffold.yaml entry
   - `generate-boilerplate-file` - Adds template files
   - `add-design-pattern` - Documents patterns
   - `add-rule` - Adds coding standards

3. **Result**: A reusable template your team can use

---

## Project Types

The toolkit supports two project structures:

### Monorepo (Nx, Turborepo, Lerna)

Each sub-project references its template in `project.json`:

```
my-workspace/
├── apps/
│   ├── web-app/
│   │   ├── project.json       ← { "sourceTemplate": "nextjs-15" }
│   │   └── src/
│   └── admin-app/
│       ├── project.json       ← { "sourceTemplate": "nextjs-15" }
│       └── src/
├── packages/
│   └── shared-lib/
│       ├── project.json       ← { "sourceTemplate": "typescript-lib" }
│       └── src/
└── templates/                  ← Shared templates
```

### Monolith (Single Application)

Configuration in `toolkit.yaml` at the root:

```
my-app/
├── toolkit.yaml               ← { sourceTemplate: "nextjs-15" }
├── package.json
├── src/
└── templates/                  ← Project templates
```

**toolkit.yaml:**
```yaml
version: "1.0"
projectType: monolith
sourceTemplate: nextjs-15
```

The tools auto-detect your project type based on these configuration files.

---

## Reducing Token Usage with one-mcp

If you're using multiple MCP servers, `one-mcp` can reduce token usage by 90%+ through progressive tool discovery:

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

Instead of loading all tools upfront, agents discover tools on-demand. See [@agiflowai/one-mcp](./packages/one-mcp) for details.

---

## Supported AI Agents

| Agent | MCP Config Location | Status |
|-------|---------------------|--------|
| Claude Code | `.mcp.json` or `claude_desktop_config.json` | Supported |
| Cursor | `.cursor/mcp.json` | Supported |
| Gemini CLI | `.gemini/settings.json` | Supported |
| Codex CLI | `.codex/config.json` | Supported |
| GitHub Copilot | VS Code settings | Supported |
| Windsurf | Coming soon | Coming Soon |

---

## Packages

| Package | Description | Docs |
|---------|-------------|------|
| `@agiflowai/aicode-toolkit` | CLI for project init and template management | [README](./apps/aicode-toolkit/README.md) |
| `@agiflowai/scaffold-mcp` | MCP server for code scaffolding | [README](./packages/scaffold-mcp/README.md) |
| `@agiflowai/architect-mcp` | MCP server for patterns and code review | [README](./packages/architect-mcp/README.md) |
| `@agiflowai/one-mcp` | MCP proxy for reduced token usage | [README](./packages/one-mcp/README.md) |

---

## Troubleshooting

### Agent doesn't recognize MCP tools

1. Restart your AI agent to reload MCP servers
2. Check that the MCP config file is in the correct location
3. Verify `npx @agiflowai/scaffold-mcp mcp-serve` runs without errors

### Templates not found

1. Run `npx @agiflowai/aicode-toolkit init` to download templates
2. Check that `templates/` directory exists in your workspace root

### Code review not finding violations

1. Ensure `RULES.yaml` exists in your template directory
2. Check that file patterns in rules match your file paths
3. Enable verbose mode: `--review-tool claude-code` for AI-powered analysis

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make changes and run `pnpm test && pnpm lint`
4. Commit using [conventional commits](https://www.conventionalcommits.org)
5. Open a Pull Request

See [CONTRIBUTING.md](./docs/CONTRIBUTING.md) for detailed guidelines.

---

## License

[AGPL-3.0](./LICENSE) © AgiflowIO

---

[Report Issues](https://github.com/AgiFlow/aicode-toolkit/issues) · [Discord](https://discord.gg/NsB6q9Vas9) · [Website](https://agiflow.io)
