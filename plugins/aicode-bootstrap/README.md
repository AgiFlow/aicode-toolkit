# aicode-bootstrap

Create a project from a toolkit boilerplate. This plugin bundles task-focused skills and the published `@agiflowai/scaffold-mcp` server. Installing the plugin does **not** install project templates or initialize your workspace.

## Before enabling MCP

In the **consumer project** (not this plugin's directory), install Node.js 22.12 or newer. With your approval, run the interactive setup:

```sh
npx -y @agiflowai/aicode-toolkit@2.0.0 init --skip-mcp
```

Inspect the created `templates/` and `.toolkit/settings.yaml` before starting/restarting the plugin's MCP server. `--skip-mcp` avoids a second, manually configured server. Template discovery can fail before setup; in a monolith, the server does not expose the boilerplate listing/creation tools. Do not run `aicode-toolkit sync` automatically: it can replace client configuration files.

## Workflow

Ask your agent to list available boilerplates, inspect the chosen template's variables and destination, obtain approval for creation, then call `use-boilerplate` and validate the generated project. The packaged [skills](skills/) provide detailed instructions; generation can write files.

The server runs pinned published code over stdio in your workspace, not inside the plugin cache. Workspace settings may enable admin operations independently of this plugin's default flags. Avoid running an equivalent manually configured `scaffold-mcp` or `one-mcp` downstream server at the same time.

For client-specific installation, support status, and migration, see the [plugin guide](https://github.com/AgiFlow/aicode-toolkit/tree/main/docs/plugins). When distributing this directory alone, copy its dotfiles and all skill references with it.
