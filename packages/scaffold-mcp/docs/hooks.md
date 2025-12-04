# Hooks Integration

> **Experimental:** This feature is experimental and may change in future releases.

Hooks let scaffold-mcp proactively suggest scaffolding methods when AI agents create new files. Instead of writing boilerplate manually, agents can use available templates.

---

## How It Works

1. **Before file creation**: When an agent tries to write a new file, the hook shows available scaffolding methods that match the file pattern
2. **After tool use**: The hook can provide follow-up guidance or track progress

---

## Claude Code Setup

Add to `.claude/settings.json` or `.claude/settings.local.json`:

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

### What Happens

When Claude tries to write a file like `src/app/about/page.tsx`:

1. The PreToolUse hook intercepts the Write call
2. Detects the project's `sourceTemplate` from `project.json`
3. Finds scaffolding methods matching the file pattern
4. Shows available options to Claude:

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

---

## Gemini CLI Setup (WIP)

> **Note:** Gemini CLI integration is a work in progress.

Add to `~/.gemini/settings.json`:

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

---

## Hook Decisions

| Decision | Claude Code | Gemini CLI | Behavior |
|----------|-------------|------------|----------|
| Allow | `allow` | `ALLOW` | Proceed with optional guidance message |
| Deny | `deny` | `BLOCK` | Show message and block operation |
| Skip | `skip` | - | Silently allow (no output) |
| Warn | - | `WARN` | Show warning but allow |

**Note:** The PreToolUse hook uses `deny` to show scaffolding options. This displays the message to Claude but doesn't actually block the Write operation—Claude can still proceed if no scaffold methods are relevant.

---

## Session Tracking

Hooks automatically track executions per session:
- Each file path is only checked once per session
- Prevents repeated suggestions for the same file
- Resets when the agent session ends

---

## CLI Commands

```bash
# Claude Code hooks
npx @agiflowai/scaffold-mcp hook --type claude-code.preToolUse
npx @agiflowai/scaffold-mcp hook --type claude-code.postToolUse

# Gemini CLI hooks (WIP)
npx @agiflowai/scaffold-mcp hook --type gemini-cli.beforeToolUse
npx @agiflowai/scaffold-mcp hook --type gemini-cli.afterToolUse
```

Hook commands read tool context from stdin and write responses to stdout (JSON format).

---

## Troubleshooting

### Hooks not triggering

1. Verify hook configuration is in the correct settings file
2. Check matcher pattern matches the tool (`Write` for PreToolUse)
3. Ensure `npx` can find `@agiflowai/scaffold-mcp`

### No scaffolding methods shown

1. Project must have `sourceTemplate` in `project.json` or `toolkit.yaml`
2. Template must have `scaffold.yaml` with defined features
3. Feature's `patterns` field must match the file path

### Wrong template detected

1. Check the project's `sourceTemplate` configuration
2. Verify you're in the correct project directory
3. Ensure the template exists in your templates folder
