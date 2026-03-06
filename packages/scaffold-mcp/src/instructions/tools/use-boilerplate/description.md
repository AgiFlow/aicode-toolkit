{% if isMonolith %}
This tool is not available for monolith projects.

Monolith projects use a single template specified in `.toolkit/settings.yaml` (`sourceTemplate`). The template cannot be changed through this tool - it's determined by the workspace configuration.

Use `list-scaffolding-methods` and `use-scaffold-method` to add features to your monolith project instead.
{% else %}
Creates a new project from a boilerplate template with the specified variables.

**For Monorepo Projects Only:**
This tool creates new sub-projects (apps, packages) in your monorepo. Each project can use a different template.

This tool will:
- Generate all necessary files from the selected boilerplate template
- Replace template variables with provided values
- Create the project in targetFolder/projectName (e.g., apps/my-new-app)
- Set up initial configuration files (package.json, tsconfig.json, etc.)
- Create project.json with sourceTemplate reference

IMPORTANT:
- Always call `list-boilerplates` first to get the exact variable schema
- Follow the schema exactly - required fields must be provided
- Use kebab-case for project names (e.g., "my-new-app", not "MyNewApp")
- The tool will validate all variables against the schema before proceeding
- Each new project can use a different boilerplate template
{% endif %}
