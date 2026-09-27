---
name: create-project
description: 'Discover and create a new application from a scaffold-mcp boilerplate. Trigger for requests to start a new project. Do not trigger when adding a feature to an existing project.'
---

# Create a project from a boilerplate

1. Confirm the consumer workspace has templates and a configured toolkit; if not, follow `initialize-workspace` before activating scaffold MCP. Monolith mode may hide the boilerplate tools.
2. Call `list-boilerplates` and read the returned variable schema. Never guess a template name or required variables.
3. Confirm the output directory, template, values and existing-file overwrite risk with the user before calling `use-boilerplate`. Use the tool's discovered input schema and the consumer workspace as the working directory.
4. Inspect generated files and project template metadata, run the generated project's relevant checks, and report results and remaining setup. Never report a successful project creation from a failed or unavailable tool call.
