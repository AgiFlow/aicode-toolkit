---
name: develop-feature
description: 'Add or edit a feature in a toolkit-configured project using scaffold methods and file-specific design patterns. Trigger for feature implementation or pattern-guided edits. Do not trigger for standalone project creation, admin template authoring or review-only requests.'
---

# Develop a feature with patterns

1. Confirm the consumer project has toolkit templates and `sourceTemplate` metadata (or monolith configuration). If scaffold cannot start, request explicit approval for interactive `npx -y @agiflowai/aicode-toolkit@2.0.0 init --skip-mcp` before connecting again. Work in the consumer workspace, not the plugin cache.
2. For generated features call `list-scaffolding-methods` with `projectPath` where applicable; inspect the returned schema and obtain approval for proposed writes before `use-scaffold-method`. Its input includes `scaffold_feature_name`, `variables`, and the applicable `projectPath`; never guess variables.
3. **Before every edit**, call `get-file-design-pattern` with `file_path` for that target and follow its rules. If unavailable, inspect existing project conventions and say guidance is missing; do not claim compliance.
4. Make the approved changes. **After editing**, call `review-code-change` with `file_path` for each edited file and evaluate any returned rules against the real code yourself. Rules-only responses with `fix_required: false` are not completed reviews. Fix violations and rerun the targeted checks.
5. Summarize paths changed, the pattern guidance followed, review evidence and test results. Workspace settings can enable admin tools or an external backend despite this plugin's CLI defaults; do not invoke unrequested backend agents or alter configuration silently.
