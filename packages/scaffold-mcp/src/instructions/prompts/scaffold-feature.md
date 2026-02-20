{% if promptAsSkill %}---
name: scaffold-feature
description: Add a new feature to an existing project such as service, route, page, component, or API endpoint. Use this skill when the user wants to add functionality to an existing codebase using predefined scaffolding templates. This skill lists available scaffolding methods for the project's template type, gathers required variables, generates boilerplate files, and guides implementation of the actual business logic.
---

{% endif %}You are helping add a new feature to an existing project using the scaffold-mcp MCP tools.

{% if request %}User request: {{ request }}
{% endif %}{% if projectPath %}Project path: {{ projectPath }}
{% endif %}
Your task is to scaffold a new feature by following this workflow:

## Step 1: Identify the Project
Determine the project path where the feature will be added:
- If projectPath is provided, use it
- Otherwise, ask the user or infer from context (e.g., "apps/my-app", "packages/my-lib")
{% if isMonolith %}- In monolith mode, you can use the current working directory (no projectPath needed){% else %}- The path should point to a directory containing a `project.json` file{% endif %}

## Step 2: List Available Scaffolding Methods
Use the `list-scaffolding-methods` tool{% if not isMonolith %} with the projectPath{% endif %}.

**What to look for:**
- Feature name (e.g., "scaffold-nextjs-page", "scaffold-react-component")
- Description of what files/code it generates
- Required and optional variables in the variables_schema
- The template type (derived from project's sourceTemplate)

**Example:**
```json
{% if isMonolith %}{}{% else %}{
  "projectPath": "apps/my-dashboard"
}{% endif %}
```

## Step 3: Gather Required Information
Based on the selected scaffolding method's variables_schema, collect:
- **Feature-specific variables**: Name, path, type, etc.
- **Required variables**: All variables marked as required: true
- **Optional variables**: Variables with required: false (ask user if needed)

Common variables:
- `componentName` / `pageName` / `serviceName`: Name in PascalCase
- `componentPath` / `pagePath`: Where to place the file (may use kebab-case)
- Boolean flags: `withTests`, `withLayout`, `withStyles`, etc.

## Step 4: Execute the Scaffolding Method
Use the `use-scaffold-method` tool with:
{% if not isMonolith %}- `projectPath`: Same path from step 1
{% endif %}- `scaffold_feature_name`: Exact name from list-scaffolding-methods response
- `variables`: Object matching the variables_schema exactly

**Example:**
```json
{
{% if not isMonolith %}  "projectPath": "apps/my-dashboard",
{% endif %}  "scaffold_feature_name": "scaffold-nextjs-page",
  "variables": {
    "pageName": "UserProfile",
    "pagePath": "user/profile",
    "withLayout": true,
    "withTests": false
  }
}
```

## Important Guidelines:
- **Always call `list-scaffolding-methods` first**{% if not isMonolith %} with the projectPath{% endif %}
- **Use exact variable names** from the schema (case-sensitive)
- **Provide all required variables** - the tool will fail if any are missing
- **Follow naming conventions**:
  - Component/Page/Service names: PascalCase (e.g., "UserProfile")
  - File paths: kebab-case or as specified in schema (e.g., "user/profile")
- **Conditional files**: Files with `?condition=true` are only included when the variable is true
- The tool will create files in the appropriate locations automatically
- After creation, inform the user what files were created

## Step 5: Review and Implement Generated Files
After scaffolding completes, **you MUST**:
1. **READ** all generated files to understand their structure
2. **IMPLEMENT** the actual business logic:
   - Replace TODO comments with real code
   - Replace template placeholders with actual implementation
   - Add the specific functionality described in the user's request
3. **REMOVE the `// @scaffold-generated` marker** from each file after you finish implementing it:
   - Generated `.ts`/`.tsx`/`.js`/`.jsx` files will have `// @scaffold-generated` at the top
   - This marker flags files that still contain unimplemented boilerplate
   - **Delete this comment line** once a file is fully implemented
   - Leaving the marker in place signals that the file is a "phantom" — unimplemented boilerplate
4. **REGISTER** the feature in appropriate files:
   - Import and register tools in `src/server/index.ts`
   - Export new modules from `index.ts` files
   - Update any necessary configuration files
5. **TEST** to ensure the implementation works correctly
6. **DO NOT SKIP** this step - scaffolded files are templates that need actual code

## Example Workflow:
1. Identify project path (provided or ask user){% if not isMonolith %}
2. Call `list-scaffolding-methods` → See available features for this project{% else %}
2. Call `list-scaffolding-methods` → See available features for your template{% endif %}
3. Ask user which feature to add (or infer from request)
4. Collect required variables based on schema
5. Call `use-scaffold-method` with {% if not isMonolith %}projectPath, {% endif %}scaffold_feature_name, and variables
6. **READ the generated files and IMPLEMENT the actual logic**
7. **REMOVE `// @scaffold-generated` from each file once implemented**
8. **REGISTER the feature in server/index.ts and other config files**
9. Report success and list created files with implementation details
