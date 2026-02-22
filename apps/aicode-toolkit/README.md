# @agiflowai/aicode-toolkit

> CLI for initializing projects and managing AI Code Toolkit templates

The main entry point for setting up AI Code Toolkit in your workspace. Handles project initialization, template management, and MCP server configuration.

## Quick Start

```bash
# Initialize templates in existing project
npx @agiflowai/aicode-toolkit init

# Create new project with templates
npx @agiflowai/aicode-toolkit init --name my-project --project-type monolith
```

---

## Commands

### `init`

Initialize AI Code Toolkit in your workspace.

**For existing projects:**
```bash
npx @agiflowai/aicode-toolkit init
```

This will:
1. Create `templates/` folder in your workspace
2. Download official templates (Next.js 15, TypeScript lib, MCP package)
3. Detect installed AI coding agents (Claude Code, Cursor, etc.)
4. Optionally configure MCP servers

**For new projects:**
```bash
# Interactive mode
npx @agiflowai/aicode-toolkit init

# Non-interactive mode
npx @agiflowai/aicode-toolkit init --name my-app --project-type monolith
```

This will:
1. Create project directory
2. Initialize git repository
3. Download templates
4. Create `toolkit.yaml` configuration

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--name <name>` | Project name (for new projects) | - |
| `--project-type <type>` | `monolith` or `monorepo` | - |
| `--path <path>` | Custom templates path | `./templates` |
| `--no-download` | Skip template download | `false` |

### `sync`

Generate platform config files from `.toolkit/settings.yaml` as the single source of truth.

```bash
# Generate both .claude/settings.json and mcp-config.yaml
npx @agiflowai/aicode-toolkit sync

# Generate only .claude/settings.json (Claude Code hooks)
npx @agiflowai/aicode-toolkit sync --hooks

# Generate only mcp-config.yaml (MCP server list)
npx @agiflowai/aicode-toolkit sync --mcp
```

**Options:**
| Option | Description |
|--------|-------------|
| `--hooks` | Write `.claude/settings.json` only |
| `--mcp` | Write `mcp-config.yaml` only |

#### Hooks → `.claude/settings.json`

Hook commands are derived automatically from `mcp-config.servers` by replacing
`mcp-serve` with `hook --type claude-code.<method>`. Configure which methods to
activate in `.toolkit/settings.yaml`:

```yaml
scaffold-mcp:
  hook:
    claude-code:
      preToolUse:
        args:           # extra CLI args appended to the generated hook command
          llm-tool: gemini-cli
      postToolUse: {}
      stop: {}
      userPromptSubmit: {}
      taskCompleted: {}

architect-mcp:
  hook:
    claude-code:
      preToolUse:
        args:
          llm-tool: gemini-cli
      postToolUse: {}
```

Generated hook entries fire on all tool calls (no matcher). Run `aicode sync --hooks`
to write `.claude/settings.json`.

#### `mcp-config` section → `mcp-config.yaml`

Define MCP servers in `.toolkit/settings.yaml`:

```yaml
mcp-config:
  servers:
    scaffold-mcp:
      command: bun
      args:
        - run
        - packages/scaffold-mcp/src/cli.ts
        - mcp-serve
        - --admin-enable
        - --prompt-as-skill
      instruction: "Use this server for generating boilerplate code and scaffolding."
    architect-mcp:
      command: bun
      args:
        - run
        - packages/architect-mcp/src/cli.ts
        - mcp-serve
      instruction: "Use this server for design pattern guidance and code review."
  skills:
    paths:
      - docs/skills
```

Run `aicode sync --mcp` to write `mcp-config.yaml` from this config.

---

### `add`

Add templates from GitHub repositories.

```bash
# Add from full repository
npx @agiflowai/aicode-toolkit add \
  --name my-template \
  --url https://github.com/yourorg/template-repo

# Add from repository subdirectory
npx @agiflowai/aicode-toolkit add \
  --name react-vite \
  --url https://github.com/AgiFlow/aicode-toolkit/tree/main/templates/react-vite
```

**Options:**
| Option | Description |
|--------|-------------|
| `--name <name>` | Template name (required) |
| `--url <url>` | GitHub URL (required) |
| `--type <type>` | Template type folder |

**Supported URL formats:**
- Full repository: `https://github.com/user/repo`
- Subdirectory: `https://github.com/user/repo/tree/branch/path/to/template`
- With .git: `https://github.com/user/repo.git`

---

## What Gets Installed

When you run `init`, these official templates are downloaded:

| Template | Description |
|----------|-------------|
| `nextjs-15-drizzle` | Next.js 15 + App Router + TypeScript + Tailwind CSS 4 + Drizzle ORM |
| `typescript-lib` | TypeScript library with ESM/CJS builds |
| `typescript-mcp-package` | MCP server package template |

Each template includes:
- `scaffold.yaml` - Boilerplate and feature definitions
- `architect.yaml` - Design patterns (optional)
- `RULES.yaml` - Coding standards (optional)

---

## Project Types

### Monolith

Single application with `toolkit.yaml` at root:

```
my-app/
├── toolkit.yaml          # sourceTemplate: "nextjs-15"
├── templates/
│   └── nextjs-15/
├── src/
└── package.json
```

### Monorepo

Multiple projects with `project.json` in each:

```
my-workspace/
├── templates/
│   ├── nextjs-15/
│   └── typescript-lib/
├── apps/
│   └── web/
│       └── project.json  # sourceTemplate: "nextjs-15"
└── packages/
    └── shared/
        └── project.json  # sourceTemplate: "typescript-lib"
```

---

## Coding Agent Detection

The CLI automatically detects installed AI coding agents:

| Agent | Config Location | Status |
|-------|-----------------|--------|
| Claude Code | `.mcp.json` | Supported |
| Cursor | `.cursor/mcp.json` | Supported |
| Gemini CLI | `.gemini/settings.json` | Supported |
| Codex CLI | `.codex/config.json` | Supported |
| GitHub Copilot | VS Code settings | Supported |

When detected, the CLI offers to configure MCP servers (scaffold-mcp, architect-mcp) automatically.

---

## Template Structure

```
templates/
└── nextjs-15/
    ├── scaffold.yaml         # Required: boilerplate + feature definitions
    ├── architect.yaml        # Optional: design patterns
    ├── RULES.yaml            # Optional: coding standards
    └── src/                  # Template files (.liquid for variable replacement)
        ├── package.json.liquid
        └── app/
            └── page.tsx.liquid
```

See [scaffold-mcp documentation](../../packages/scaffold-mcp/docs/template-conventions.md) for template creation guide.

---

## Related Packages

| Package | Description |
|---------|-------------|
| [@agiflowai/scaffold-mcp](../../packages/scaffold-mcp) | MCP server for code scaffolding |
| [@agiflowai/architect-mcp](../../packages/architect-mcp) | MCP server for design patterns |
| [@agiflowai/one-mcp](../../packages/one-mcp) | MCP proxy for reduced token usage |

---

## License

AGPL-3.0
