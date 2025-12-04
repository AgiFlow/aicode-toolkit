# CLI Commands Reference

scaffold-mcp provides CLI commands for scaffolding projects and features outside of MCP context.

---

## Boilerplate Commands

Commands for creating new projects from templates.

### `boilerplate list`

List all available boilerplate templates.

```bash
npx @agiflowai/scaffold-mcp boilerplate list
```

### `boilerplate info <name>`

Show details about a specific boilerplate.

```bash
npx @agiflowai/scaffold-mcp boilerplate info nextjs-15-drizzle
```

**Output includes:**
- Name and description
- Template path
- Required variables with their schemas
- Available scaffold features

### `boilerplate create <name>`

Create a new project from a boilerplate.

```bash
npx @agiflowai/scaffold-mcp boilerplate create nextjs-15-drizzle \
  --vars '{"projectName":"my-app","packageName":"@myorg/my-app","appName":"My App"}' \
  --target ./apps
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--vars <json>` | Variables matching the boilerplate schema | Required |
| `--target <path>` | Target directory | Current directory |

**What happens:**
1. Creates `<target>/<projectName>` directory
2. Copies and processes all template files
3. Replaces Liquid variables with provided values
4. Creates/updates `project.json` with `sourceTemplate` field

---

## Scaffold Commands

Commands for adding features to existing projects.

### `scaffold list <project-path>`

List available scaffold methods for a project.

```bash
npx @agiflowai/scaffold-mcp scaffold list ./apps/my-app
```

**How it works:**
1. Reads `project.json` from the project directory
2. Extracts the `sourceTemplate` field
3. Finds matching template and reads `scaffold.yaml`
4. Lists all defined scaffold methods

**Note:** Project must have a `project.json` with a `sourceTemplate` field.

### `scaffold info <feature-name>`

Show details about a specific scaffold method.

```bash
npx @agiflowai/scaffold-mcp scaffold info scaffold-nextjs-page --project ./apps/my-app
```

**Options:**
| Option | Description |
|--------|-------------|
| `--project <path>` | Path to the project (required) |

### `scaffold add <feature-name>`

Add a feature to an existing project.

```bash
npx @agiflowai/scaffold-mcp scaffold add scaffold-nextjs-page \
  --project ./apps/my-app \
  --vars '{
    "appPath": "/absolute/path/to/apps/my-app",
    "appName": "my-app",
    "pageTitle": "About Us",
    "nextjsPagePath": "/about"
  }'
```

**Options:**
| Option | Description |
|--------|-------------|
| `--project <path>` | Path to the project (required) |
| `--vars <json>` | Variables matching the method's schema (required) |

**What happens:**
1. Validates project has correct `sourceTemplate`
2. Finds the scaffold method configuration
3. If custom generator exists, executes it
4. Otherwise, copies and processes template files
5. Returns created files and instructions

---

## Complete Workflow Example

```bash
# 1. List available boilerplates
npx @agiflowai/scaffold-mcp boilerplate list

# 2. Create a new Next.js project
npx @agiflowai/scaffold-mcp boilerplate create nextjs-15-drizzle \
  --vars '{"projectName":"my-app","packageName":"@myorg/my-app","appName":"My App"}' \
  --target ./apps

# 3. List available features
npx @agiflowai/scaffold-mcp scaffold list ./apps/my-app

# 4. Add an About page
npx @agiflowai/scaffold-mcp scaffold add scaffold-nextjs-page \
  --project ./apps/my-app \
  --vars '{
    "appPath": "'$(pwd)'/apps/my-app",
    "appName": "my-app",
    "pageTitle": "About Us",
    "pageDescription": "Learn more about us",
    "nextjsPagePath": "/about"
  }'
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Error (template not found, validation failed, etc.) |

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_PORT` | Port for HTTP/SSE servers | `3000` |
| `MCP_HOST` | Host for HTTP/SSE servers | `localhost` |
