# aicode-review

Review source changes against a consumer project's `RULES.yaml` using the [review-changes skill](skills/review-changes/SKILL.md) and `architect-mcp`.

Install Node.js 22.12+, configure project templates and `sourceTemplate` with an approved interactive `npx -y @agiflowai/aicode-toolkit@2.0.0 init --skip-mcp` before activating MCP, and keep the server's working directory in the **consumer project**, never the plugin cache.

Call `review-code-change` using `file_path` per changed file. With no external backend configured it can return applicable rules, `identified_issues: []` and `fix_required: false` **without having inspected the code**. The host agent must compare the actual changes to returned rules. Missing project/rules are not a passed review. Workspace settings may launch a separately configured backend despite defaults; check consent and credentials before using one.

This plugin exposes architect's other core tools too. If develop or admin is already installed, consider using that bundle instead of starting a duplicate architect server. See [installation and compatibility](https://github.com/AgiFlow/aicode-toolkit/tree/main/docs/plugins).
