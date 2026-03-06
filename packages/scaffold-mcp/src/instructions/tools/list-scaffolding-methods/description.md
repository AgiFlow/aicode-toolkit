Lists all available scaffolding methods (features) that can be added to an existing project{% if not isMonolith %} or for a specific template{% endif %}.

This tool:
{% if isMonolith %}
- Reads your project's sourceTemplate from .toolkit/settings.yaml at workspace root
{% else %}
- Reads the project's sourceTemplate from project.json (monorepo) or .toolkit/settings.yaml (monolith), OR
- Directly uses the provided templateName to list available features
{% endif %}
- Returns available features for that template type
- Provides variable schemas for each scaffolding method
- Shows descriptions of what each method creates

Use this FIRST when adding features to understand:
- What scaffolding methods are available
- What variables each method requires
- What files/features will be generated

Example methods might include:
- Adding new React routes (for React apps)
- Creating API endpoints (for backend projects)
- Adding new components (for frontend projects)
- Setting up database models (for API projects)
