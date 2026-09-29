---
name: author-templates
description: 'Create or update reusable toolkit boilerplate templates and feature scaffolds. Trigger for explicit template-authoring requests. Do not trigger for simply generating an app or feature from an existing template.'
---

# Author reusable templates

1. Inspect the existing `templates/` tree, `scaffold.yaml`, project metadata and variable conventions in the consumer workspace; do not use plugin-cache paths as output.
2. Present a proposed template name, variables, affected paths and overwrite risk. Ask approval before invoking scaffold's admin tools: `generate-boilerplate`, `generate-feature-scaffold` and `generate-boilerplate-file` (use their discovered schemas). Admin operations can modify reusable templates and dependent projects.
3. Use `get-file-design-pattern` on files about to change; edit or generate only after approval. For each changed file invoke `review-code-change` and inspect returned rules yourself, including rules-only responses.
4. Validate `scaffold.yaml` against actual output in a temporary fixture; check that `list-boilerplates` or `list-scaffolding-methods` discovers the result. Report changed files, validation and remaining manual decisions. Never automatically synchronize or overwrite client configuration.
