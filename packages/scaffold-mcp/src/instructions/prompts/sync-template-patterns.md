{% if promptAsSkill %}---
name: sync-template-patterns
description: Update scaffold template files when design patterns have changed and there are discrepancies between templates and current coding standards. Use this skill when architect.yaml or RULES.yaml have been updated and existing .liquid template files need to be brought in line with the new patterns.
---

{% endif %}You are helping synchronize scaffold template files with the latest design patterns using architect-mcp and scaffold-mcp tools.

{% if request %}User request: {{ request }}
{% endif %}{% if templateName %}Template to sync: {{ templateName }}
{% endif %}{% if filePath %}Focus on file type: {{ filePath }}
{% endif %}
Your task is to detect discrepancies between current design patterns and scaffold template files, then update the templates to match.

## Step 1: Gather Context

Determine scope:
- If `templateName` is provided, scope the work to that template
- If `filePath` is provided, focus on templates that generate files matching that path pattern
- Otherwise, ask the user which template or file type to update

{% if not isMonolith %}Use `list-boilerplates` and `list-scaffolding-methods` to discover available templates and their file includes.{% else %}Use `list-scaffolding-methods` to discover available features and their file includes.{% endif %}

## Step 2: Get Current Design Patterns

For each file type the template generates, use `get-file-design-pattern` from architect-mcp:

```
get-file-design-pattern({ file_path: "<path matching the template's target file>" })
```

**What to capture from the response:**
- `must_do` rules — patterns that MUST appear in generated code
- `must_not_do` rules — anti-patterns to eliminate from templates
- `should_do` rules — best practices to incorporate
- Code examples showing the expected structure
- Naming conventions and architectural decisions

**Important**: Use the TARGET file path (what the template generates), not the `.liquid` template file path.
For example, if a template generates `src/tools/MyTool.ts`, call `get-file-design-pattern` with `src/tools/ExistingTool.ts`.

## Step 3: Read Existing Template Files

For each `.liquid` template file that corresponds to the file types you checked:
- Read the current template content
- Note what patterns, imports, class structures, and boilerplate it contains
- Identify the Liquid variables in use (e.g., `{{ toolName }}`, `{{ serviceName }}`)

Template files live in the templates directory under the template name folder with `.liquid` extension
(e.g., `templates/nextjs-15/src/tools/Tool.ts.liquid`).

## Step 4: Identify Discrepancies

Compare template content against the design patterns. Look for:

**Critical discrepancies (must fix):**
- Missing required imports or base classes (`must_do` violations)
- Presence of forbidden patterns (`must_not_do` violations)
- Wrong class/function structure that contradicts current patterns
- Outdated error handling, typing, or interface patterns

**Important discrepancies (should fix):**
- Missing `should_do` best practices
- Outdated code examples in template headers
- Stale design pattern documentation in the file header comment

**Document each discrepancy before making changes:**
- Which template file is affected
- What the current template does
- What the design pattern requires
- What change is needed

## Step 5: Update Template Files

For each discrepancy, use `generate-boilerplate-file` to update the template:

```json
{
  {% if not isMonolith %}"templateName": "<the template name>",{% endif %}
  "filePath": "<relative path without .liquid extension>",
  "content": "<updated template content with Liquid variables preserved>",
  "header": "<updated design pattern summary reflecting the new patterns>"
}
```

**Critical rules when updating templates:**
- **Preserve all Liquid variables** — `{{ variableName }}`, `{% if condition %}`, filter chains like `{{ name | pascalCase }}` must remain intact
- **Keep templates minimal and business-agnostic** — structural/boilerplate code only, not specific logic
- **Update the header comment** to reflect the new design patterns, coding standards, and things to avoid
- **Do NOT hardcode business logic** — use placeholder examples only
- **Do NOT overwrite variables with literals** — `{{ toolName }}` must never become a hardcoded string

## Step 6: Update scaffold.yaml Instruction (If Needed)

If the design pattern changes affect the architectural guidance documented in the boilerplate/feature `instruction` field:

1. Retrieve the current instruction via `list-boilerplates` or `list-scaffolding-methods`
2. Update the entry using `generate-boilerplate` or `generate-feature-scaffold` with the revised `instruction`

## Step 7: Verify

After updating:
1. Confirm all `must_do` patterns are present in the updated template
2. Confirm all `must_not_do` patterns are removed
3. Confirm Liquid syntax is valid (variables and tags intact)
4. Optionally run `use-scaffold-method` or `use-boilerplate` to generate a sample and review output

## Important Guidelines

- **One file at a time** — work through discrepancies file by file
- **Explain each change** — tell the user what was outdated and what you updated, and why
- **Preserve variable placeholders** — never replace `{{ toolName }}` with a literal string
- **Be conservative** — only change what the design patterns explicitly require
- **Report skipped files** — if a template file has no discrepancies, say so explicitly

## Example Workflow

{% if not isMonolith %}1. Call `list-scaffolding-methods` with `{ "templateName": "nextjs-15" }` to see features and their includes
{% else %}1. Call `list-scaffolding-methods` to see available features and their includes
{% endif %}2. For each feature's included files, call `get-file-design-pattern` with a matching real file path
3. Read the corresponding `.liquid` template files
4. Document all discrepancies found
5. Call `generate-boilerplate-file` for each file that needs updating
6. Report a summary: which files were updated, what changed, and why
