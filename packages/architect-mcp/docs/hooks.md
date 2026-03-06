# Hooks Integration

> **Experimental:** Hooks integration is currently experimental and the API may change in future releases.

Hooks let architect-mcp provide patterns before file edits and review feedback after changes.

## Overview

- Before edits: provide patterns and coding rules from `architect.yaml` and `RULES.yaml`
- After edits: review changes against `RULES.yaml`

## Supported Agents

| Agent | Status | Hook Events |
|-------|--------|-------------|
| Claude Code | Stable | `PreToolUse`, `PostToolUse` |
| Gemini CLI | WIP | `beforeToolUse`, `afterToolUse` |

## Claude Code Hooks

### Configuration

#### Option A — `aicode sync` (recommended)

Define hooks in `.toolkit/settings.yaml` and generate `.claude/settings.json` automatically:

```yaml
architect-mcp:
  hook:
    claude-code:
      preToolUse:
        matcher: Edit|MultiEdit|Write
      postToolUse:
        matcher: Edit|MultiEdit|Write
```

The hook command is derived from `mcp-config.servers.architect-mcp` by replacing
`mcp-serve` with `hook --type claude-code.<method>`. Generated architect entries
default to the matcher `Edit|MultiEdit|Write`. Then run:

```bash
npx @agiflowai/aicode-toolkit sync --hooks
```

#### Option B — Manual setup

Add directly to `.claude/settings.json` or `.claude/settings.local.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
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
        "matcher": "Edit|MultiEdit|Write",
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

### How It Works

#### PreToolUse (Edit|MultiEdit|Write)

Before Claude edits or writes a file, the hook:
1. Extracts the file path from the tool input
2. Looks up design patterns from `architect.yaml` that match the file
3. Retrieves applicable coding rules from `RULES.yaml`
4. Returns guidance to Claude as a hook message

#### PostToolUse (Edit|MultiEdit|Write)

After Claude edits or writes a file, the hook:
1. Reads the modified file content
2. Checks for violations against `RULES.yaml` rules
3. Returns feedback on any issues found
4. Claude can fix violations in later edits

### Hook Decisions

| Decision | Behavior |
|----------|----------|
| `allow` | Proceed with the operation, optionally with guidance message |
| `deny` | Block the operation with an error message |
| `ask` | Prompt the user for confirmation |
| `skip` | Silently allow (no output to Claude) |

### Execution Tracking

Hooks track executions per session to avoid duplicate processing:
- Each file is only analyzed once per tool use cycle
- Tracking resets when the session ends
- Stable IDs are based on file path and tool input hash

## Gemini CLI Hooks (WIP)

> **Note:** Gemini CLI hooks integration is currently a work in progress and may not be fully functional.

### Configuration

Add to your Gemini CLI settings (`~/.gemini/settings.json`):

```json
{
  "hooks": {
    "beforeToolUse": [
      {
        "command": "npx @agiflowai/architect-mcp hook --type gemini-cli.beforeToolUse",
        "matcher": ".*"
      }
    ],
    "afterToolUse": [
      {
        "command": "npx @agiflowai/architect-mcp hook --type gemini-cli.afterToolUse",
        "matcher": ".*"
      }
    ]
  }
}
```

### How It Works

- **beforeToolUse**: Before Gemini writes or edits a file, the hook provides relevant design patterns and coding standards from `architect.yaml`.

- **afterToolUse**: After Gemini writes or edits a file, the hook reviews the changes against your `RULES.yaml`.

### Hook Decisions

| Decision | Behavior |
|----------|----------|
| `ALLOW` | Proceed with the operation, optionally with guidance message |
| `BLOCK` | Block the operation with an error message |
| `WARN` | Show a warning but allow the operation |

## CLI Commands

architect-mcp provides hook commands for integration with AI coding agents:

```bash
# Claude Code hooks (reads from stdin, writes to stdout)
architect-mcp hook --type claude-code.preToolUse   # Design patterns before edit
architect-mcp hook --type claude-code.postToolUse  # Code review after edit

# Gemini CLI hooks (WIP)
architect-mcp hook --type gemini-cli.beforeToolUse  # Design patterns before edit
architect-mcp hook --type gemini-cli.afterToolUse   # Code review after edit
```

### Hook Type Format

`<agent>.<event>`

- **agent**: `claude-code` or `gemini-cli`
- **event**:
  - Claude Code: `preToolUse` or `postToolUse`
  - Gemini CLI: `beforeToolUse` or `afterToolUse`

### Input/Output

Hook commands:
- Read tool use context from **stdin** (JSON format)
- Write hook responses to **stdout** (JSON format)

These commands are called by the AI agent's hook system, not directly by users.

## Architecture

The hooks system uses `@agiflowai/hooks-adapter` for:
- shared hook logic across agents
- agent-specific input/output adapters
- execution logging

## Troubleshooting

### Hooks not triggering

1. Verify the hook configuration is in the correct settings file
2. Check that the matcher pattern matches the tools being used
3. Ensure `npx` can find `@agiflowai/architect-mcp`

### Duplicate hook executions

The execution tracking should prevent this, but if you see duplicates:
1. Check if multiple hook configurations are active
2. Verify the session ID is being passed correctly

### No design patterns found

1. Ensure `architect.yaml` exists in your template directory
2. Check that file patterns in `includes` match your file paths
3. Verify the project has a `sourceTemplate` configured

### No rules applied

1. Ensure `RULES.yaml` exists in your template directory
2. Check that `pattern` fields match your file paths
3. Verify rule inheritance is configured correctly
