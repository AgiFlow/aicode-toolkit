---
name: review-changes
description: 'Review changes against file-specific toolkit rules. Trigger for code-review and quality-check requests. Do not trigger when the user asks to generate a project or author coding rules.'
---

# Review changes using project rules

1. Identify changed files and the consumer workspace. For each file call `review-code-change` with `{ "file_path": "..." }` and inspect its full feedback and returned `rules`.
2. Compare actual source and diff against the applicable rules yourself. An unconfigured backend returns rules for **host-agent review** with `identified_issues: []` and `fix_required: false`; those fields are not evidence of compliance. Missing project, template or RULES.yaml likewise means review could not establish compliance.
3. Report findings with file/line, severity, specific rule, evidence and suggested correction. Explicitly state when rules were missing or a backend could not run. Do not claim that an empty issue list passed review without examining the code.
4. Propose fixes and ask permission before editing; recheck any corrected files. Workspace settings may invoke an external agent backend and incur credentials/cost even without CLI backend flags. Check and explain configured settings before requesting such a review.
