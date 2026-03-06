{% if isMonolith %}
Not available for monolith projects. Monolith uses a single template defined in `.toolkit/settings.yaml`.

Use `list-scaffolding-methods` for available features instead.
{% else %}
Lists all available project boilerplates for creating new applications, APIs, or packages in the monorepo.

Each boilerplate includes:
- Complete project template with starter files
- Variable schema for customization
- Target directory information (e.g., apps/, packages/)
- Required and optional configuration options

Use this FIRST when creating new projects to understand available templates and their requirements.
{% endif %}
