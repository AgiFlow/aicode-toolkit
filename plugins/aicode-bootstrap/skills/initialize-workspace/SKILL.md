---
name: initialize-workspace
description: 'Set up toolkit templates and project metadata in a consumer workspace. Trigger when the user asks to initialize AI Code Toolkit or scaffold cannot find templates. Do not trigger for routine editing in an already configured project.'
---

# Initialize a consumer workspace

1. Verify Node.js >=22.12, identify the consumer workspace and inspect existing `templates/`, `.toolkit/settings.yaml` and `project.json` files. Do not change directory into the plugin installation cache.
2. Explain that plugin installation does not create templates. Ask permission to run the **interactive** `npx -y @agiflowai/aicode-toolkit@2.0.0 init --skip-mcp` in the consumer workspace. Do not claim a `--yes` flag or run initialization automatically. Avoid running `sync`: it writes entire client configuration files.
3. Inspect the created templates and settings. For features in a monorepo, check each project's `sourceTemplate`; for a monolith, check the configured source template. Confirm the template path is valid and belongs to this workspace.
4. Restart/reconnect the scaffold MCP server after initialization; it can fail at startup without templates. Monolith mode does not expose boilerplate creation tools.
5. Tell the user what changed and how to undo it. Warn that workspace settings can enable admin tools or backend agents independently of plugin flags; ask before altering these settings.
