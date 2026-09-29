# aicode-develop

Develop features with `scaffold-mcp` and `architect-mcp`. Includes the [develop-feature skill](skills/develop-feature/SKILL.md) and the Claude `/edit-with-pattern` command. This bundle exposes both servers' **full core toolsets**; it is not a tool allowlist.

## Prerequisites

Use Node.js 22.12+. Initialize your **consumer project** before enabling MCP:

```sh
npx -y @agiflowai/aicode-toolkit@2.0.0 init --skip-mcp
```

Setup is interactive and creates workspace templates/configuration; inspect `sourceTemplate` for feature scaffolding. Do not run setup or `sync` automatically. The MCP processes must run from the consumer workspace, never from the plugin cache.

For features, discover methods with `list-scaffolding-methods` and the applicable `projectPath`, inspect the variable schema, get `get-file-design-pattern` for each file before editing, then call `review-code-change` after editing. Rules-only review results require the host agent to evaluate actual code. Obtain approval before generation or overwrites. The command is namespaced when installed; verify the actual slash name in your Claude client.

Workspace settings can enable admin tools and nested review backends despite this plugin's default flags. Avoid duplicate manually configured scaffold/architect or `one-mcp` processes. See [installation and compatibility](https://github.com/AgiFlow/aicode-toolkit/tree/main/docs/plugins).
