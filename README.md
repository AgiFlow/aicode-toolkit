# AI Code Toolkit

[![npm version](https://img.shields.io/npm/v/@agiflowai/scaffold-mcp.svg?style=flat-square)](https://www.npmjs.com/package/@agiflowai/scaffold-mcp)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg?style=flat-square)](https://opensource.org/licenses/AGPL-3.0)
[![Discord](https://dcbadge.limes.pink/api/server/https://discord.gg/NsB6q9Vas9?style=flat-square)](https://discord.gg/NsB6q9Vas9)

![AI Code Toolkit Banner](./docs/workflow.jpg)

Enforce AI coding agents your team's conventions and existing practices. Setup once, work across multiple AI tools.

---

## Why This Exists

As projects grow from MVP to production, you accumulate patterns, conventions, components, and style guides. Your `AGENTS.md`, `CLAUDE.md` and rule files keep growing — consuming precious context window and documentation maintenance becomes difficult.

This toolkit encodes your team's conventions in a centralized, shareable location with hierarchical inheritant. Instead of preloading AI agents with plain-text documentation, you encode your best practices and guideline in `yaml`, and our tools with extract the configs to get relevant patterns and enforce boundaries before and after AI agent writing code in **progressive discovery** manner.

If you use multiple AI tools to assist your development, this toolkit enable your team to encode your knowledge and workflow once; and reuse it across AI tools seamlessly.

---

## Quick Start

**Requirements:** Node.js >= 18, MCP-compatible agent (Claude Code, Cursor, Gemini CLI)

### 1. Initialize
Use [aicode-toolkit](./apps/aicode-toolkit) to help you setup the project quickly. This includes download templates, setup MCPs and spec tool to assist with your development.   

```bash
# Existing project
npx @agiflowai/aicode-toolkit init

# New project
npx @agiflowai/aicode-toolkit init --name my-app --project-type monolith
```

Creates `templates/` with scaffold definitions, patterns, and rules. Your development knowledge stayed within templates folder, and is linked to actual project via `project.json`'s `sourceTemplate` setting.

### 2. Configure MCP

We recomment to use MCP for plug-and-play capabilities. For folks who don't liked context hog problem with MCP, our libraries also have cli commands equivalent to the MCP's tools; or you can use our [one-mcp](./packages/one-mcp) to support `progressive discovery`. 

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
        "--design-pattern-tool", "codex",
        "--review-tool", "gemini-cli"
      ]
    },
    "style-system": {
      "command": "npx",
      "args": ["-y", "@agiflowai/style-system", "mcp-serve"]
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
When the MCPs are setup, you can interact with the agent using natural language.  

Ask your agent: *"What boilerplates are available?"*

Should call `list-boilerplates`. If not recognized, restart the agent.

---

## Architecture
We recommend to use [scaffold-mcp](./packages/scaffold-mcp), [architect-mcp](architect-mcp) and [style-system](style-system) together for full-stack development. This will help you creating new project quickly, add new feature at the right place, write code which follow your conventions and design guideline.  

```
┌─────────────────────────────────────────────────────────────┐
│                     Your AI Agent                           │
│         (Claude Code, Cursor, Gemini CLI, etc.)             │
└─────────────────────────────────────────────────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                      ▼
┌─────────────┐        ┌──────────────┐       ┌─────────────┐
│ scaffold-mcp│        │ architect-mcp│       │ style-system│
│             │        │              │       │             │
│ Generates   │        │ Guides and   │       │ Design      │
│ code from   │        │ validates    │       │ system &    │
│ templates   │        │ code quality │       │ components  │
└─────────────┘        └──────────────┘       └─────────────┘
       │                      │                      │
       └──────────────────────┼──────────────────────┘
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

Add new apps, libraries, or features that follow your company conventions. Generates minimal boilerplate code and uses guided generation to fill in the blanks.

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

Pre-flight suggestions to ensure AI-generated code follows best practices and design patterns based on your file structure. Post-check with RULES.yaml to enforce styles and patterns using an LLM as a judge.

| Tool | Description |
|------|-------------|
| `get-file-design-pattern` | Get patterns/rules before editing |
| `review-code-change` | Validate code after editing |

**Admin tools** (`--admin-enable`):

| Tool | Description |
|------|-------------|
| `add-design-pattern` | Add to `architect.yaml` |
| `add-rule` | Add to `RULES.yaml` |

### style-system (NEW)

Design system operations for theme management, CSS class discovery, and component visualization. Helps AI agents use existing design tokens and components instead of creating duplicates.

| Tool | Description |
|------|-------------|
| `list_themes` | List available theme configurations |
| `get_css_classes` | Extract CSS classes from theme (use before styling) |
| `get_component_visual` | Preview UI component without running the app |
| `list_shared_components` | Find shared UI components (use before creating new ones) |
| `list_app_components` | List app-specific and package components |

NOTE: This package hasn't been integrated to [aicode-toolkit](./apps/aicode-toolkit) yet.

---

## Workflow
We suggest to play your task in advanced. Then simply give the task to agent to run autonomously. In copilot mode, you can prompt the agent using natural language or troubleshoot with the packages' cli commands.  

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

### Styling Components

```
User: "Style the button with our theme colors"

Agent:
1. get_css_classes → discovers available theme classes
2. list_shared_components → checks for existing button components
3. Applies existing classes or extends component
4. get_component_visual → previews the result
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
This is where you configure the template for scaffolding. We use `structured output` (supported by mcp) to generate minimal files with `Comment header` to guide the AI tool to fill-in the blank.  

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
Before the AI tool actually write the code, `architect.yaml` is where you steer the AI by giving it clues how to actually write the code. Don't wait until the code violates your conventions, steer it first.  

```yaml
patterns:
  - name: server-component
    description: "Default for page components"
    file_patterns:
      - "**/app/**/page.tsx"
    description: |
      - Use async/await for data fetching
      - Keep components focused on rendering
      - Move business logic to server actions
```

### RULES.yaml
There is no guarantee the AI follow your guidance. This file defines enforceable rules that the AI must, must not or should follow. The toolkit provide capability for a different AI agent to do code review and enforce the rules and not being affected by noisy context. First, we extract the rules based on the file pattern; then we give the file diff plus rules to another agent to identify violation. Anything in must_do or must_not_do rules violations we explicitly ask the agent to fix (and other agent also provide fixing recommendation).  

```yaml
version: '1.0'
template: typescript-lib
rules:
  - pattern: src/services/**/*.ts
    description: Service Layer Implementation Standards
    must_do:
      - rule: Create class-based services with single responsibility
        codeExample: |-
          export class DataProcessorService {
            async processData(input: string): Promise<ProcessedData> {
              // Implementation
            }
          }
      - rule: Use dependency injection for composability
    must_not_do:
      - rule: Create static-only utility classes - use functions
        codeExample: |-
          // ❌ BAD
          export class Utils {
            static format(s: string) {}
          }

          // ✅ GOOD
          export function format(s: string): string {}
```

---

## Built-in Templates
Below templates are examples; you can clone the repo and start exploring how the mechanism works using existing templates.  

| Template | Stack | Includes |
|----------|-------|----------|
| `nextjs-drizzle` | Next.js 15, App Router | TypeScript, Tailwind 4, Drizzle, Storybook |
| `typescript-lib` | TypeScript Library | ESM/CJS, Vitest, TSDoc |
| `typescript-mcp-package` | MCP Server | Commander, MCP SDK |

### Custom Templates
We suggest to build your own template from your existing repo. It's quite simple by using slash command:

``` 
/generate-boilerplate
```
Use this slash command and reference your directory to create template. This will create `scaffold.yaml` with boillerplate config and relevant files extracted from your production application.  

``` 
/generate-feature-scaffold
```
After boilerplate is generated, you can now use this command to add `feature` scaffolding. Think of feature as a group of files that generated together per your requirement (new page, new service, etc...)

The `scaffold-mcp` will automatically add this new template to the discovery.

NOTE: MPC's prompts are added as commands in Claude Code; other tools might not have the same implementation. We plan to fix it with [aicode-toolkit](./apps/aicode-toolkit) soon.  

### Custom Design Pattern
`add-design-pattern` is the tool from `architect-mcp` (with `--admin-enable` flag) that help you add a new design pattern to `architect.yaml` the template.
Simply ask the AI agent to add a design pattern to a template by giving it a source file reference.

### Custom Rule
`add-rule` is the tool from `architect-mcp` (with `--admin-enable` flag) that help you add a new rule to the `RULES.yaml` in template.
Simply ask the AI agent to add a new rule to a template by giving it a source file reference and your rule requirement. 

---

## Project Types
The toolkit exists because we had scaling problem with mono-repo. Mono-repo has first-citizen support in this toolkit. Monolith is also support and we plan to make it more robust on single-purpose project ASAP!

### Monorepo
Mono-repo can be complex for root level blob matching. Considering you can have multiple `apis` built with different languages, or same language but support different design patterns. Then you need to create duplicated rule files just to match a file within particular project. Eg: 

Backend lib utils.
``` mdx
---
file: packages/backend-lib-a/utils/*.ts 
---
...[RULES]
```

Frontend lib utils.
``` mdx
---
file: packages/frontend-lib-a/utils/*.ts 
---
...[RULES]
```

A slightly diverted pattern requires your team to write a different rule file. With our toolkit, your package/project reference template in `project.json`; so the match can be collocated per project. (We will support architect and rules override per project soon if you have edge cases).   

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
Single purpose project follow same template approach but simplier. Configuration in `toolkit.yaml` is enough for most use cases.  

```yaml
version: "1.0"
projectType: monolith
sourceTemplate: nextjs-15
```

Auto-detected based on config files.

---

## Token Optimization
For daily development work, the MCP context hog lies in the `json-schema` input definition. We create one-mcp to help you save context token by progressively disclose tools' schema per request.  

If you want to use Anthropic skills for agent to automatically invoke commands for you on tools which does not support skills. One-mcp also support that. By the end of the day, skill is just a tool call.  

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
| [@agiflowai/style-system](./packages/style-system) | Design system and component server |
| [@agiflowai/one-mcp](./packages/one-mcp) | MCP proxy for token reduction |

---

## Contributing

See [CONTRIBUTING.md](./docs/CONTRIBUTING.md).

## License

[AGPL-3.0](./LICENSE)

---

[Issues](https://github.com/AgiFlow/aicode-toolkit/issues) · [Discord](https://discord.gg/NsB6q9Vas9) · [Website](https://agiflow.io)
