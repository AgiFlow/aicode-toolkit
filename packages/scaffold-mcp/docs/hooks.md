# Hooks Integration

> **Experimental:** Hooks integration is currently experimental and the API may change in future releases.

scaffold-mcp integrates with AI coding agents' hook systems to provide proactive scaffolding guidance when creating new files. This helps AI agents discover and use available scaffolding methods instead of writing boilerplate code manually.

## Overview

Hooks allow scaffold-mcp to:
- **Before file creation**: Show available scaffolding methods that match the file being created
- **After tool use**: Remind about scaffolding methods when relevant MCP tools are used

This creates a proactive guidance system where AI agents are informed about available templates before writing code from scratch.

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
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "npx @agiflowai/scaffold-mcp hook --type claude-code.preToolUse"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "mcp__one-mcp__use_tool",
        "hooks": [
          {
            "type": "command",
            "command": "npx @agiflowai/scaffold-mcp hook --type claude-code.postToolUse"
          }
        ]
      }
    ]
  }
}
```

### How It Works

#### PreToolUse (Write)

Before Claude writes a new file, the hook:
1. Extracts the file path from the tool input
2. Detects the project and its source template
3. Finds scaffolding methods that match the file pattern
4. Shows available methods with their descriptions and required variables

This helps Claude use scaffolding templates instead of writing boilerplate manually.

**Example output:**
```
🎯 Scaffolding Methods Available

Before writing new files, check if any of these scaffolding methods match your needs:

**scaffold-nextjs-page**
Create a new Next.js page with proper structure and metadata.
Required: pageTitle, pageDescription, nextjsPagePath

**Instructions:**
1. If one of these scaffold methods matches what you need, use the `use-scaffold-method` MCP tool
2. If none are relevant, proceed to write files directly
```

#### PostToolUse (mcp__one-mcp__use_tool)

After Claude uses an MCP tool (like `use-scaffold-method`), the hook:
1. Tracks which scaffolding methods have been used
2. Provides reminders about follow-up steps if needed
3. Suggests related scaffolding methods

### Hook Decisions

| Decision | Behavior |
|----------|----------|
| `allow` | Proceed with the operation, optionally with guidance message |
| `deny` | Block the operation with an error message (shows scaffolding options) |
| `ask` | Prompt the user for confirmation |
| `skip` | Silently allow (no output to Claude) |

**Note:** The PreToolUse hook uses `deny` decision to show scaffolding options, which displays the message but doesn't actually block the Write operation - it just ensures Claude sees the available options.

### Execution Tracking

Hooks automatically track executions per session to avoid duplicate processing:
- Each file path is only checked once per session
- Tracking is session-based (resets when the agent session ends)
- Prevents repeated scaffolding suggestions for the same file

## Gemini CLI Hooks (WIP)

> **Note:** Gemini CLI hooks integration is currently a work in progress and may not be fully functional.

### Configuration

Add to your Gemini CLI settings (`~/.gemini/settings.json`):

```json
{
  "hooks": {
    "beforeToolUse": [
      {
        "command": "npx @agiflowai/scaffold-mcp hook --type gemini-cli.beforeToolUse",
        "matcher": "write"
      }
    ],
    "afterToolUse": [
      {
        "command": "npx @agiflowai/scaffold-mcp hook --type gemini-cli.afterToolUse",
        "matcher": ".*"
      }
    ]
  }
}
```

### How It Works

- **beforeToolUse**: Before Gemini writes a file, the hook shows available scaffolding methods.

- **afterToolUse**: After Gemini uses tools, the hook provides follow-up guidance.

### Hook Decisions

| Decision | Behavior |
|----------|----------|
| `ALLOW` | Proceed with the operation, optionally with guidance message |
| `BLOCK` | Block the operation with an error message |
| `WARN` | Show a warning but allow the operation |

## CLI Commands

scaffold-mcp provides hook commands for integration with AI coding agents:

```bash
# Claude Code hooks (reads from stdin, writes to stdout)
scaffold-mcp hook --type claude-code.preToolUse   # Show scaffolding options before write
scaffold-mcp hook --type claude-code.postToolUse  # Follow-up after tool use

# Gemini CLI hooks (WIP)
scaffold-mcp hook --type gemini-cli.beforeToolUse  # Show scaffolding options
scaffold-mcp hook --type gemini-cli.afterToolUse   # Follow-up guidance
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
2. Check that the matcher pattern matches the tools being used (`Write` for PreToolUse)
3. Ensure `npx` can find `@agiflowai/scaffold-mcp`

### No scaffolding methods shown

1. Ensure the project has a `sourceTemplate` configured in `project.json` or `toolkit.yaml`
2. Check that `scaffold.yaml` exists in the template directory
3. Verify the file path pattern matches the scaffold method's `patterns` field

### Duplicate suggestions

The execution tracking should prevent this, but if you see duplicates:
1. Check if multiple hook configurations are active
2. Verify the session ID is being passed correctly

### Wrong template detected

1. Check the project's `sourceTemplate` configuration
2. Ensure you're in the correct project directory
3. Verify the template exists in your templates folder
