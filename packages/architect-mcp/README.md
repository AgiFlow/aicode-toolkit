# @agiflowai/architect-mcp

> MCP server for design pattern guidance and code review

Help AI coding agents write code that follows your team's architectural patterns and coding standards. architect-mcp provides context-aware guidance before editing files and validates code against rules after changes.

## Why Use This?

When AI agents edit code, they don't know your team's conventions:
- Which patterns apply to service files vs. tool files?
- What are the must-do and must-not-do rules?
- How should errors be handled in this codebase?

architect-mcp solves this by:

1. **Providing patterns before editing** - Agent sees relevant design patterns for the file
2. **Validating code after editing** - Agent gets feedback on rule violations
3. **Enforcing standards automatically** - Rules from RULES.yaml are checked programmatically

---

## Quick Start

### 1. Install Templates

```bash
# Downloads templates with architect.yaml and RULES.yaml
npx @agiflowai/aicode-toolkit init
```

### 2. Configure Your AI Agent

Add to your MCP config (`.mcp.json`, `.cursor/mcp.json`, etc.):

```json
{
  "mcpServers": {
    "architect-mcp": {
      "command": "npx",
      "args": [
        "-y", "@agiflowai/architect-mcp", "mcp-serve",
        "--admin-enable",
        "--design-pattern-tool", "claude-code",
        "--review-tool", "gemini-cli"
      ]
    }
  }
}
```

**Flags:**
- `--admin-enable`: Enables tools for adding new patterns/rules
- `--design-pattern-tool claude-code`: Uses Claude to filter relevant patterns
- `--review-tool claude-code`: Uses Claude for intelligent code review

### 3. Start Using

Your AI agent now has access to architecture tools:

```
You: "Add error handling to the user service"

Agent:
1. Calls get-file-design-pattern for src/services/UserService.ts
2. Sees: Service Layer Pattern, must use dependency injection, must handle errors
3. Writes code following the patterns
4. Calls review-code-change to validate
5. Fixes any violations
```

---

## Available Tools

### Standard Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `get-file-design-pattern` | Get patterns and rules for a file | Before editing any file |
| `review-code-change` | Validate code against rules | After editing a file |

### Admin Tools (with `--admin-enable`)

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `add-design-pattern` | Add pattern to architect.yaml | Documenting new patterns |
| `add-rule` | Add rule to RULES.yaml | Adding coding standards |
| `validate-architect` | Validate architect.yaml syntax and schema | Debugging configuration issues |

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                     Your AI Agent                           │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┴────────────────────┐
         ▼                                         ▼
  ┌──────────────────┐                    ┌──────────────────┐
  │ Before Editing   │                    │ After Editing    │
  │                  │                    │                  │
  │ get-file-design- │                    │ review-code-     │
  │ pattern          │                    │ change           │
  └──────────────────┘                    └──────────────────┘
         │                                         │
         ▼                                         ▼
  ┌──────────────────┐                    ┌──────────────────┐
  │ architect.yaml   │                    │ RULES.yaml       │
  │                  │                    │                  │
  │ • Design patterns│                    │ • must_do        │
  │ • File roles     │                    │ • should_do      │
  │ • Examples       │                    │ • must_not_do    │
  └──────────────────┘                    └──────────────────┘
```

### architect.yaml - Design Patterns

Defines what each file type should do:

```yaml
features:
  - name: Service Layer
    design_pattern: Service classes with dependency injection
    includes:
      - src/services/**/*.ts
    description: |
      Services contain business logic and are injected into tools.
      They should be stateless and delegate to repositories.
```

### Pattern Inheritance & Override

architect-mcp supports a three-level configuration hierarchy:

```
┌─────────────────────────────────────────────────────────────┐
│  1. Project architect.yaml (highest priority)               │
│     packages/my-app/.architect.yaml                         │
│     → Project-specific patterns that override template      │
├─────────────────────────────────────────────────────────────┤
│  2. Template architect.yaml                                 │
│     templates/nextjs-15/architect.yaml                      │
│     → Framework-specific patterns                           │
├─────────────────────────────────────────────────────────────┤
│  3. Global architect.yaml (lowest priority)                 │
│     templates/architect.yaml                                │
│     → Shared patterns across all templates                  │
└─────────────────────────────────────────────────────────────┘
```

**Example: Override template pattern for a specific project**

Template pattern (`templates/typescript-mcp-package/architect.yaml`):
```yaml
features:
  - name: tool-pattern
    design_pattern: Standard MCP Tool
    includes:
      - src/tools/**/*.ts
```

Project override (`packages/my-custom-mcp/.architect.yaml`):
```yaml
features:
  - name: tool-pattern
    design_pattern: Custom Tool with Extended Validation
    includes:
      - src/tools/**/*.ts
    description: |
      This project requires additional input validation...
```

When a file in `packages/my-custom-mcp/src/tools/` is checked, the project-level pattern takes precedence.

### RULES.yaml - Coding Standards

Defines how code should be written:

```yaml
rules:
  - pattern: src/services/**/*.ts
    description: Service implementation standards
    must_do:
      - rule: Use dependency injection
        codeExample: |
          // ✓ GOOD
          constructor(private repo: UserRepository) {}
    must_not_do:
      - rule: Never use static-only utility classes
        codeExample: |
          // ✗ BAD
          class Utils { static doStuff() {} }
```

---

## LLM Modes

architect-mcp works in two modes:

### Mode 1: Agent-Driven (LLM flags disabled)

```bash
npx @agiflowai/architect-mcp mcp-serve
```

- Returns all applicable patterns and rules
- AI agent does its own analysis
- Fast, no external API calls

### Mode 2: LLM-Enhanced (LLM flags enabled)

```bash
npx @agiflowai/architect-mcp mcp-serve \
  --design-pattern-tool claude-code \
  --review-tool claude-code
```

- Filters patterns based on file content
- Reviews code and returns specific violations
- Precise, context-aware feedback

### Mode 3: Fallback Tool (single flag for both)

Use `--fallback-tool` when you want both tools to use the same LLM without specifying each separately. A specific `--design-pattern-tool` or `--review-tool` always takes precedence over the fallback.

```bash
# Both design-pattern and review use claude-code
npx @agiflowai/architect-mcp mcp-serve \
  --fallback-tool claude-code

# Override review specifically — design-pattern still uses the fallback
npx @agiflowai/architect-mcp mcp-serve \
  --fallback-tool claude-code \
  --review-tool gemini-cli

# With a custom model config applied to both tools
npx @agiflowai/architect-mcp mcp-serve \
  --fallback-tool claude-code \
  --fallback-tool-config '{"model":"claude-sonnet-4-6"}'
```

**Precedence:** `--design-pattern-tool` > `--fallback-tool` (same for `--review-tool`).

---

## CLI Commands

architect-mcp also works as a standalone CLI:

```bash
# Get design patterns for a file
npx @agiflowai/architect-mcp get-file-design-pattern src/services/UserService.ts

# Get design patterns with LLM filtering
npx @agiflowai/architect-mcp get-file-design-pattern src/services/UserService.ts \
  --llm-tool codex \
  --tool-config '{"model":"gpt-5.2"}'

# Review code against rules
npx @agiflowai/architect-mcp review-code-change src/services/UserService.ts

# Review code with LLM-powered analysis
npx @agiflowai/architect-mcp review-code-change src/services/UserService.ts \
  --llm-tool codex \
  --tool-config '{"model":"gpt-5.2"}'

# Add a design pattern
npx @agiflowai/architect-mcp add-pattern "Service Layer" "DI pattern" \
  "Services use dependency injection" \
  --template-name typescript-mcp-package \
  --includes "src/services/**/*.ts"

# Add a coding rule
npx @agiflowai/architect-mcp add-rule error-handling "Error handling standards" \
  --template-name typescript-mcp-package \
  --must-do "Use try-catch blocks" \
  --must-not-do "Never use empty catch blocks"

# Validate architect.yaml file
npx @agiflowai/architect-mcp validate-architect templates/nextjs-15/architect.yaml

# Validate by template name
npx @agiflowai/architect-mcp validate-architect -t typescript-mcp-package

# Verbose output showing all features
npx @agiflowai/architect-mcp validate-architect -t nextjs-15 -v
```

---

## Hooks Integration (Experimental)

Hooks let architect-mcp provide guidance automatically when files are edited.

**Claude Code setup** (`.claude/settings.json`):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npx @agiflowai/architect-mcp hook --type claude-code.preToolUse"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npx @agiflowai/architect-mcp hook --type claude-code.postToolUse"
          }
        ]
      }
    ]
  }
}
```

**What happens:**
- **PreToolUse**: Before editing, shows relevant patterns from architect.yaml
- **PostToolUse**: After editing, reviews code against RULES.yaml

See [Hooks Documentation](./docs/hooks.md) for details.

---

## Server Options

```bash
# stdio transport (default)
npx @agiflowai/architect-mcp mcp-serve

# HTTP transport
npx @agiflowai/architect-mcp mcp-serve --type http --port 3000

# SSE transport
npx @agiflowai/architect-mcp mcp-serve --type sse --port 3000

# All features enabled
npx @agiflowai/architect-mcp mcp-serve \
  --admin-enable \
  --design-pattern-tool claude-code \
  --review-tool claude-code

# With custom tool configuration (e.g., specific model)
npx @agiflowai/architect-mcp mcp-serve \
  --design-pattern-tool codex \
  --design-pattern-tool-config '{"model":"gpt-5.2"}' \
  --review-tool codex \
  --review-tool-config '{"model":"gpt-5.2"}'

# Fallback tool — both tools use claude-code
npx @agiflowai/architect-mcp mcp-serve \
  --fallback-tool claude-code

# Fallback with config, override one tool specifically
npx @agiflowai/architect-mcp mcp-serve \
  --fallback-tool claude-code \
  --fallback-tool-config '{"model":"claude-sonnet-4-6"}' \
  --review-tool gemini-cli
```

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --type` | Transport: `stdio`, `http`, `sse` | `stdio` |
| `-p, --port` | Port for HTTP/SSE | `3000` |
| `--admin-enable` | Enable pattern/rule creation tools | `false` |
| `--design-pattern-tool` | LLM for pattern filtering (`claude-code`, `gemini-cli`, `codex`) | disabled |
| `--design-pattern-tool-config` | JSON config for design pattern LLM tool (e.g., `{"model":"gpt-5.2"}`) | `{}` |
| `--review-tool` | LLM for code review (`claude-code`, `gemini-cli`, `codex`) | disabled |
| `--review-tool-config` | JSON config for review LLM tool (e.g., `{"model":"gpt-5.2"}`) | `{}` |
| `--fallback-tool` | LLM used for both tools when the specific flag is not set | disabled |
| `--fallback-tool-config` | JSON config applied to the fallback tool (e.g., `{"model":"claude-sonnet-4-6"}`) | `{}` |

---

## Documentation

| Document | Description |
|----------|-------------|
| [Design Pattern Overview](./docs/design-pattern-overview.md) | Philosophy and architecture of the pattern system |
| [Rules Overview](./docs/rules-overview.md) | How RULES.yaml works, inheritance, review modes |
| [Hooks Integration](./docs/hooks.md) | Setting up automatic hooks with AI agents |

---

## License

AGPL-3.0
