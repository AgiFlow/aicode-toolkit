# Hooks Integration

> **Experimental:** Hooks integration is currently experimental and the API may change in future releases.

architect-mcp integrates with AI coding agents' hook systems to automatically provide design patterns before file edits and review code after changes. This provides real-time guidance without requiring manual MCP tool calls.

## Overview

Hooks allow architect-mcp to:
- **Before edits**: Provide relevant design patterns and coding standards from `architect.yaml`
- **After edits**: Review changes against `RULES.yaml` and provide feedback on violations

This creates a feedback loop where AI agents receive architectural guidance proactively, improving code quality without manual intervention.

## Supported Agents

| Agent | Status | Hook Events |
|-------|--------|-------------|
| Claude Code | Stable | `PreToolUse`, `PostToolUse` |
| Gemini CLI | WIP | `beforeToolUse`, `afterToolUse` |

## Claude Code Hooks

### Configuration

Add to your Claude Code settings (`.claude/settings.json` or `.claude/settings.local.json`):

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

### How It Works

#### PreToolUse (Edit|Write)

Before Claude edits or writes a file, the hook:
1. Extracts the file path from the tool input
2. Looks up design patterns from `architect.yaml` that match the file
3. Retrieves applicable coding rules from `RULES.yaml`
4. Returns guidance to Claude as a hook message

This helps Claude follow your project's architectural guidelines before making changes.

#### PostToolUse (Edit|Write)

After Claude edits or writes a file, the hook:
1. Reads the modified file content
2. Checks for violations against `RULES.yaml` rules
3. Returns feedback on any issues found
4. Claude can then fix violations in subsequent edits

### Hook Decisions

| Decision | Behavior |
|----------|----------|
| `allow` | Proceed with the operation, optionally with guidance message |
| `deny` | Block the operation with an error message |
| `ask` | Prompt the user for confirmation |
| `skip` | Silently allow (no output to Claude) |

### Execution Tracking

Hooks automatically track executions per session to avoid duplicate processing:
- Each file is only analyzed once per tool use cycle
- Tracking is session-based (resets when the agent session ends)
- Uses stable IDs based on file path and tool input hash

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

The hooks system uses `@agiflowai/hooks-adapter` internally for normalized hook handling across different AI coding agents. This provides:

- **Unified interface**: Same hook logic works across different agents
- **Adapter pattern**: Agent-specific input/output formats are handled transparently
- **Execution logging**: Track which files have been processed to avoid duplicates

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
