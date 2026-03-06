Use this MCP server to {% if isMonolith %}create your monolith project and add features (pages, components, services, etc.){% else %}create new projects and add features (pages, components, services, etc.){% endif %}.

## Workflow:
{% if not isMonolith %}
1. **Creating New Project**: Use `list-boilerplates` → `use-boilerplate`
2. **Adding Features**: Use `list-scaffolding-methods` → `use-scaffold-method`
{% else %}
1. **Creating Project**: Use `use-boilerplate` (boilerplateName auto-detected from `.toolkit/settings.yaml`)
2. **Adding Features**: Use `list-scaffolding-methods` → `use-scaffold-method`
{% endif %}

## AI Usage Guidelines:
{% if not isMonolith %}
- Always call `list-boilerplates` first when creating new projects to see available options
{% endif %}
- Always call `list-scaffolding-methods` first when adding features to understand what's available
- Follow the exact variable schema provided - validation will fail if required fields are missing
{% if not isMonolith %}
- Use kebab-case for project names (e.g., "my-new-app")
{% else %}
- In monolith mode, parameters like `boilerplateName` and `templateName` are auto-detected from `.toolkit/settings.yaml`
- You only need to provide `variables` when calling `use-boilerplate` or `use-scaffold-method`
{% endif %}
- The tools automatically handle file placement, imports, and code generation
- Check the returned JSON schemas to understand required vs optional variables
{% if adminEnabled %}

## Admin Mode (Template Generation):

When creating custom boilerplate templates for frameworks not yet supported:

1. **Create Boilerplate Configuration**: Use `generate-boilerplate` to add a new boilerplate entry to a template's scaffold.yaml
   - Specify template name, boilerplate name, description, target folder, and variable schema
   - This creates the scaffold.yaml structure following the nextjs-15 pattern
   - Optional: Add detailed instruction about file purposes and design patterns

2. **Create Feature Configuration**: Use `generate-feature-scaffold` to add a new feature entry to a template's scaffold.yaml
   - Specify template name, feature name, generator, description, and variable schema
   - This creates the scaffold.yaml structure for feature scaffolds (pages, components, etc.)
   - Optional: Add detailed instruction about file purposes and design patterns
   - Optional: Specify patterns to match existing files this feature works with

3. **Create Template Files**: Use `generate-boilerplate-file` to create the actual template files
   - Create files referenced in the boilerplate's or feature's includes array
   - Use {{ variableName }} syntax for Liquid variable placeholders
   - Can copy from existing source files or provide content directly
   - Files automatically get .liquid extension

4. **Test the Template**: Use `list-boilerplates`/`list-scaffolding-methods` and `use-boilerplate`/`use-scaffold-method` to verify your template works

Example workflow for boilerplate:
```
1. generate-boilerplate { templateName: "react-vite", boilerplateName: "scaffold-vite-app", ... }
2. generate-boilerplate-file { templateName: "react-vite", filePath: "package.json", content: "..." }
3. generate-boilerplate-file { templateName: "react-vite", filePath: "src/App.tsx", content: "..." }
4. list-boilerplates (verify it appears)
5. use-boilerplate { boilerplateName: "scaffold-vite-app", variables: {...} }
```

Example workflow for feature:
```
1. generate-feature-scaffold { templateName: "nextjs-15", featureName: "scaffold-nextjs-component", generator: "componentGenerator.ts", ... }
2. generate-boilerplate-file { templateName: "nextjs-15", filePath: "src/components/Component.tsx", content: "..." }
3. list-scaffolding-methods (verify it appears)
4. use-scaffold-method { scaffoldName: "scaffold-nextjs-component", variables: {...} }
```
{% endif %}
