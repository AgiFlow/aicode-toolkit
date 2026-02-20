{% if promptAsSkill %}---
name: scaffold-application
description: Create a new application or project from a boilerplate template. Use this skill when the user wants to start a new project, create a new app, or bootstrap a new codebase from scratch. This skill lists available boilerplate templates (React, Next.js, Express, etc.), gathers required configuration variables, generates the complete project structure, and provides guidance on next steps including adding features.
---

{% endif %}You are helping create a new {% if isMonolith %}monolith application{% else %}application{% endif %} using the scaffold-mcp MCP tools.

{% if request %}User request: {{ request }}
{% endif %}
Your task is to scaffold a new application by following this workflow:

## Step 1: {% if isMonolith %}Prepare to Create Application{% else %}List Available Boilerplates{% endif %}
{% if isMonolith %}You will use the `use-boilerplate` tool to create your monolith application. The boilerplate name will be auto-detected from your toolkit.yaml file.{% else %}Use the `list-boilerplates` tool to see all available project templates.

**What to look for:**
- Boilerplate name (e.g., "scaffold-nextjs-app", "scaffold-vite-app")
- Description of what the boilerplate creates
- Target folder where projects will be created (e.g., "apps", "packages")
- Required and optional variables in the variables_schema{% endif %}

## Step 2: Gather Required Information
Based on the {% if isMonolith %}toolkit.yaml{% else %}selected boilerplate's variables_schema{% endif %}, collect:
{% if not isMonolith %}- **Project name**: Must be kebab-case (e.g., "my-new-app", not "MyNewApp")
{% endif %}- **Required variables**: All variables marked as required: true
- **Optional variables**: Variables with required: false (ask user if needed)

Common variables:
- `appName` or `packageName`: The project name (kebab-case)
- `description`: Brief description of what the project does
- `author`: Author name

## Step 3: Execute the Boilerplate
Use the `use-boilerplate` tool with:
{% if not isMonolith %}- `boilerplateName`: Exact name from list-boilerplates response
{% endif %}- `variables`: Object matching the variables_schema exactly

**Example:**
```json
{
{% if not isMonolith %}  "boilerplateName": "scaffold-nextjs-app",
{% endif %}  "variables": {
    "appName": "my-dashboard",
    "description": "Admin dashboard for managing users",
    "author": "John Doe"
  }
}
```

## Important Guidelines:
{% if not isMonolith %}- **Always call `list-boilerplates` first** to see available options and their schemas{% else %}- The boilerplate name is auto-detected from toolkit.yaml{% endif %}
- **Use exact variable names** from the schema (case-sensitive)
- **Provide all required variables** - the tool will fail if any are missing
{% if not isMonolith %}- **Use kebab-case for project names** (e.g., "user-dashboard", not "UserDashboard")
- The tool will create the project in the appropriate directory automatically{% else %}- The tool will create files at the workspace root{% endif %}
- After creation, inform the user {% if isMonolith %}what files were created{% else %}where the project was created{% endif %}

## Step 4: Review and Add Features (If Needed)
After the boilerplate is created, **consider if additional features are needed**:
1. **READ** the generated {% if isMonolith %}application{% else %}project{% endif %} structure to understand what was created
2. **REVIEW** the user's request to see if they asked for specific features (e.g., "with tool for X", "with prompt for Y")
3. **If features are needed**:
   - Use `list-scaffolding-methods`{% if not isMonolith %} with the new project path{% endif %}
   - Use `use-scaffold-method` to add tools, services, prompts, etc.
   - **IMPLEMENT** the actual logic in the scaffolded feature files
   - **REMOVE the `// @scaffold-generated` marker** from each file after implementing it (see below)
   - **REGISTER** the features in `src/server/index.ts`
4. **Install dependencies**: Remind user to run `pnpm install`
5. **Report** the complete setup including any features added

## Scaffold Marker — Remove After Implementing
Generated `.ts`/`.tsx`/`.js`/`.jsx` files contain `// @scaffold-generated` at the top. This comment flags unimplemented boilerplate files.

**You MUST delete this line once a file is fully implemented.** Leaving it in place marks the file as a "phantom" — a scaffolded file whose logic was never written. The marker is checked at session boundaries to catch files that were accidentally left as empty templates.

## Example Workflow:
{% if not isMonolith %}1. Call `list-boilerplates` → See available templates
2. Ask user which template to use (or infer from request)
3. Collect required variables based on schema
4. Call `use-boilerplate` with boilerplateName and variables{% else %}1. Collect required variables based on toolkit.yaml variables_schema
2. Call `use-boilerplate` with variables (boilerplateName auto-detected){% endif %}
5. **Review if user requested specific features (tools, prompts, etc.)**
6. **If features needed**: Add them using `list-scaffolding-methods` and `use-scaffold-method`
7. **READ and IMPLEMENT** the scaffolded feature files with actual logic
8. **REMOVE `// @scaffold-generated`** from each file once implemented
9. Report success and next steps to the user
