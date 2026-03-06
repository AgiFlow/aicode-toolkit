When working on this project, follow the OpenSpec spec-driven development workflow{% if scaffoldMcp or architectMcp %} integrated with MCP tools{% endif %}.

{% if scaffoldMcp %}

## {% if scaffoldMcp %}1{% else %}1{% endif %}. Create Proposals with scaffold-mcp

When implementing new features or changes, use scaffold-mcp MCP tools:

**For new projects/features:**
1. Use `list-boilerplates` MCP tool to see available templates
2. Use `use-boilerplate` MCP tool to scaffold new projects{% if projectType == 'monolith' %} (set `monolith: true`){% elsif projectType == 'monorepo' %} (omit `monolith` parameter){% endif %}
3. Use `list-scaffolding-methods` MCP tool to understand which methods can be used to add features
4. Create OpenSpec proposal with available scaffolding methods in mind: "Create an OpenSpec proposal for [feature description]"

**For adding features to existing code:**
1. Use `list-scaffolding-methods` MCP tool with projectPath to see available features{% if projectType == 'monolith' %} (`projectPath` = workspace root){% elsif projectType == 'monorepo' %} (`projectPath` = project directory with project.json){% endif %}
2. Review available methods and plan which ones to use for the feature
3. Use `use-scaffold-method` MCP tool to generate boilerplate code
4. Create OpenSpec proposal to capture the specs
{% if projectType %}

**Path Mapping ({% if projectType == 'monolith' %}Monolith{% else %}Monorepo{% endif %} Project):**
{% if projectType == 'monolith' %}
*This is a monolith project:*
- Single project at workspace root
- Config file: `.toolkit/settings.yaml` at root
- All code in workspace root (src/, lib/, etc.)
- When scaffolding: Use `monolith: true` parameter
- When using scaffold methods: `projectPath` = workspace root

Example: For workspace at `/path/to/project`:
- Project config: `/path/to/project/.toolkit/settings.yaml`
- Source code: `/path/to/project/src/`
- OpenSpec: `/path/to/project/openspec/`
{% else %}
*This is a monorepo project:*
- Multiple projects in subdirectories
- Config file: `project.json` in each project
- Projects in apps/, packages/, libs/, etc.
- When scaffolding: Omit `monolith` parameter (defaults to false)
- When using scaffold methods: `projectPath` = path to specific project

Example: For workspace at `/path/to/workspace`:
- App config: `/path/to/workspace/apps/my-app/project.json`
- App source: `/path/to/workspace/apps/my-app/src/`
- OpenSpec: `/path/to/workspace/openspec/` (workspace-level)
{% endif %}
{% endif %}

AI will scaffold: openspec/changes/[feature-name]/ with proposal.md, tasks.md, and spec deltas
{% endif %}
{% if architectMcp %}

## {% if scaffoldMcp %}2{% else %}1{% endif %}. Review & Validate with architect-mcp

Before and after editing files, use architect-mcp MCP tools:

**Before editing:**
- Use `get-file-design-pattern` MCP tool to understand:
  - Applicable design patterns from architect.yaml
  - Coding rules from RULES.yaml (must_do, should_do, must_not_do)
  - Code examples showing the patterns

**After editing:**
- Use `review-code-change` MCP tool to check for:
  - Must not do violations (critical issues)
  - Must do missing (required patterns not followed)
  - Should do suggestions (best practices)

**Validate OpenSpec specs:**
- Use `openspec validate [feature-name]` to check spec formatting
- Iterate with AI until specs are agreed upon
{% endif %}

## {% if scaffoldMcp and architectMcp %}3{% elsif scaffoldMcp or architectMcp %}2{% else %}1{% endif %}. Implement{% if architectMcp %} with MCP-Guided Development{% endif %}

During implementation:
1. Ask AI to implement: "Apply the OpenSpec change [feature-name]"
{% if architectMcp %}
2. **Before each file edit**: Use `get-file-design-pattern` to understand patterns
3. AI implements tasks from tasks.md following design patterns
4. **After each file edit**: Use `review-code-change` to verify compliance
5. Fix any violations before proceeding
{% else %}
2. AI implements tasks from tasks.md following the agreed specs
{% endif %}

## {% if scaffoldMcp and architectMcp %}4{% elsif scaffoldMcp or architectMcp %}3{% else %}2{% endif %}. Archive Completed Changes
{% if scaffoldMcp or architectMcp %}

## MCP Tools Reference
{% endif %}
{% if scaffoldMcp %}

### scaffold-mcp
- `list-boilerplates` - List available project templates
- `use-boilerplate` - Create new project from template
- `list-scaffolding-methods` - List features for existing project
- `use-scaffold-method` - Add feature to existing project
{% endif %}
{% if architectMcp %}

### architect-mcp
- `get-file-design-pattern` - Get design patterns for file
- `review-code-change` - Review code for violations
{% endif %}

## Workflow Summary

{% if scaffoldMcp %}
1. **Plan**: Use scaffold-mcp to generate boilerplate + OpenSpec proposal for specs
{% else %}
1. **Plan**: Create OpenSpec proposal with specs
{% endif %}
{% if architectMcp %}
{% if scaffoldMcp %}2{% else %}2{% endif %}. **Design**: Use architect-mcp to understand patterns before editing
{% endif %}
{% if scaffoldMcp and architectMcp %}3{% elsif scaffoldMcp or architectMcp %}{% if architectMcp %}3{% else %}2{% endif %}{% else %}2{% endif %}. **Implement**: Follow specs{% if architectMcp %} and patterns{% endif %}
{% if architectMcp %}
{% if scaffoldMcp %}4{% else %}4{% endif %}. **Review**: Use architect-mcp to validate code quality
{% endif %}
{% if scaffoldMcp and architectMcp %}5{% elsif scaffoldMcp or architectMcp %}{% if architectMcp %}5{% else %}3{% endif %}{% else %}3{% endif %}. **Archive**: Merge specs into source of truth
