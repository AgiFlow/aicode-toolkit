# aicode-admin

Opt-in authoring of reusable templates, feature generators, design patterns and coding rules. See [author-templates](skills/author-templates/SKILL.md) and [manage-patterns-and-rules](skills/manage-patterns-and-rules/SKILL.md).

Install Node.js 22.12+. Initialize the **consumer workspace** interactively and with permission before enabling MCP: `npx -y @agiflowai/aicode-toolkit@2.0.0 init --skip-mcp`. Keep the server working directory there, not in the plugin cache. Admin config adds `--admin-enable` to scaffold and architect; it also retains both servers' core tools. Confirm output paths, changes to reusable configuration, and overwrites before writes. For the architect rule tool use its actual name, `add_rule`.

Workspace settings can independently enable agent backends and admin tools. Never automatically run `aicode-toolkit sync`: it can replace configuration files. Avoid duplicate manually configured or `one-mcp` servers. See [installation and compatibility](https://github.com/AgiFlow/aicode-toolkit/tree/main/docs/plugins).
