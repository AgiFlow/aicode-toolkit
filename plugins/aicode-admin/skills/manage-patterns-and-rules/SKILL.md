---
name: manage-patterns-and-rules
description: 'Author project design patterns and coding rules with architect-mcp admin tools. Trigger when the user asks to change pattern or rule definitions. Do not trigger for reviewing existing code against unchanged rules.'
---

# Maintain patterns and rules

1. Inspect project `architect.yaml`, `RULES.yaml`, template mapping and existing rules. Retrieve applicable design patterns with `get-file-design-pattern` using `file_path` before editing any target.
2. Draft the exact rule or pattern, its file selectors and examples. Request approval for config writes, especially inherited/global changes.
3. Use discovered admin schemas: `add-design-pattern`, **`add_rule`** (underscore, not `add-rule`) and `validate-architect` as appropriate. Do not guess argument keys.
4. Re-query patterns and call `review-code-change` for edited files. A backend-free review may only return rules for the host agent to evaluate; do that evaluation and report any missing configuration or failures.
5. Test on representative matching and non-matching fixture paths, summarize impact and provide rollback guidance. Workspace settings may independently enable agent backends; get consent before invoking them.
