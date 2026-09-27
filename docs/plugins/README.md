# Purpose-based toolkit plugins

Five separately installable plugins help **users in their own projects**. Choose the smallest bundle needed:

| Plugin             | Main purpose                                     | MCP packages                                   |
| ------------------ | ------------------------------------------------ | ---------------------------------------------- |
| `aicode-bootstrap` | Create applications from boilerplates            | scaffold-mcp                                   |
| `aicode-develop`   | Scaffold features, check patterns, review edits  | scaffold-mcp, architect-mcp                    |
| `aicode-review`    | Review changes against rules with the host agent | architect-mcp                                  |
| `aicode-admin`     | Author templates, patterns and rules             | scaffold-mcp, architect-mcp with admin enabled |
| `aicode-design`    | Explore themes, classes and UI components        | style-system                                   |

These are workflows, **not restricted tool profiles**: develop overlaps bootstrap and review, and admin retains core server tools. Avoid configuring the same servers through both a plugin and a direct MCP config/`one-mcp` unless intentionally testing duplication.

## Initialize before activating MCP

Install Node.js **22.12+** (Node 24 tested in CI). In your **consumer project**, with approval, run:

```sh
npx -y @agiflowai/aicode-toolkit@2.0.0 init --skip-mcp
```

Setup is interactive. Inspect the new `templates/`, `.toolkit/settings.yaml` and `sourceTemplate` on feature projects; then install/enable the selected plugin and restart MCP. Scaffold can fail to start before templates exist. In monolith mode boilerplate-list/create tools are not exposed. `--skip-mcp` avoids competing direct server configurations; do not automatically run `sync` because it may replace client configs. Plugin installation does not initialize projects.

## Install

```sh
# Claude Code (Claude Cowork uses the same marketplace through Settings > Plugins)
claude plugin marketplace add AgiFlow/aicode-toolkit
claude plugin install aicode-develop@aicode-toolkit

# Codex
codex plugin marketplace add AgiFlow/aicode-toolkit
codex plugin add aicode-develop@aicode-toolkit

# Gemini CLI: clone the repository, then from its checkout:
gemini extensions install ./plugins/aicode-develop
```

Pick another plugin name in place of `aicode-develop` as needed. Gemini remote installation requires an extension at the root of the remote repository; it has no verified subdirectory-install flag. Cursor and Grok have standalone root manifests/archives, but their actual per-purpose acquisition routes require client tests. Claude Cowork's ability to execute local Node/stdio MCP servers also requires testing; consult [compatibility](compatibility.md) before claiming full support. Do not use Grok's automatic `--trust` flag without reviewing plugin code.

## Use and safety

Read the selected plugin's `skills/*/SKILL.md`. Development uses `list-scaffolding-methods` → `get-file-design-pattern` before edits → `review-code-change` after edits. If architect returns rules with empty findings, **the host agent still needs to inspect code**. Workspace settings can independently enable admin tools or nested LLM backends, even when plugin CLI flags omit them. Check settings and request consent before agent-backed review. MCP processes must inherit the consumer workspace as their working directory; never launch them from the plugin installation cache. Visual rendering executes consumer code and requires a trusted project and Chromium.

Plugin metadata is generated with `pnpm plugins:generate`; verify with `pnpm plugins:check && pnpm plugins:test && pnpm plugins:pack`. The resulting standalone archives are in ignored `dist/plugins/`. See [migration](migration.md) for existing Claude marketplace installations.
