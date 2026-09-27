# Claude Code and Cowork plugin marketplace

`aicode-toolkit` provides five task-focused plugins for use **in your projects**. Claude Code installs them from the repository's marketplace; Claude Cowork uses Settings → Plugins → Add marketplace, then sync and browse. Cowork's local Node/stdio server execution is not yet verified: see [compatibility](../docs/plugins/compatibility.md).

## Before enabling scaffold-backed plugins

Install Node.js 22.12+. In the consumer project, with approval, run interactive `npx -y @agiflowai/aicode-toolkit@2.0.0 init --skip-mcp` to create templates and settings. Inspect `sourceTemplate` and restart MCP. Scaffold cannot necessarily start before this setup. Do not automatically run `sync`, and do not start MCP from the plugin cache.

## Install in Claude Code

```text
/plugin marketplace add https://github.com/AgiFlow/aicode-toolkit
/plugin install aicode-bootstrap@aicode-toolkit
/plugin install aicode-develop@aicode-toolkit
/plugin install aicode-review@aicode-toolkit
/plugin install aicode-admin@aicode-toolkit
/plugin install aicode-design@aicode-toolkit
```

Choose only the plugins you need:

- **Bootstrap** creates projects from scaffold templates.
- **Develop** scaffolds features, gets file design guidance and reviews edited files; it ships an `edit-with-pattern` command.
- **Review** retrieves coding rules and helps the host agent inspect changes. Empty findings from a backend-free tool do **not** constitute a completed review.
- **Admin** authors templates, patterns and rules; it enables the admin tools in both servers.
- **Design** discovers themes/classes/components and renders trusted components. The published style-system 0.2.0 has a known argument-forwarding limitation; see [compatibility](../docs/plugins/compatibility.md).

These are workflow groupings, not tool allowlists. Develop contains scaffold and architect, so bootstrap/review can create duplicate processes if co-installed. Admin includes both servers' core tools too. Workspace settings may enable admin and external review backends despite omitted CLI flags. Check consent and backend credentials before review. Disable duplicate manually configured MCP or `one-mcp` instances yourself.

Marketplace sources and manifests are self-contained under [`plugins/`](../plugins/). See the [plugin guide](../docs/plugins/README.md) and [migration guide](../docs/plugins/migration.md) for other clients, update steps and validation status. The previously documented three specialized agents and old `configs/claude-code/` command paths were absent and are no longer advertised.
