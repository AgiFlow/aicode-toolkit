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
  --target-folder ./apps
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--vars <json>` | Variables matching the boilerplate schema | Required |
| `--target-folder <path>` | Override target folder | Boilerplate target folder |
| `--monolith` | Create as monolith project at workspace root | `false` |
| `--marker <tag>` | Custom scaffold marker injected into generated code files | `@scaffold-generated` |

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
npx @agiflowai/scaffold-mcp scaffold list --template nextjs-15
npx @agiflowai/scaffold-mcp scaffold list
```

**How it works:**
1. Reads `project.json` from the project directory
2. Extracts the `sourceTemplate` field
3. Finds matching template and reads `scaffold.yaml`
4. Lists all defined scaffold methods

**Note:** When no project path or template is provided, the current working directory is used.

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
| `--marker <tag>` | Custom scaffold marker injected into generated code files |

**What happens:**
1. Validates project has correct `sourceTemplate`
2. Finds the scaffold method configuration
3. If custom generator exists, executes it
4. Otherwise, copies and processes template files
5. Returns created files and instructions

---

## Template Authoring Commands

These commands provide CLI equivalents for scaffold-mcp admin MCP tools.

### `boilerplate generate <name>`

Create a boilerplate configuration in a template's `scaffold.yaml`.

```bash
npx @agiflowai/scaffold-mcp boilerplate generate scaffold-vite-app \
  --template vite-react \
  --description "React Vite starter" \
  --target-folder apps \
  --variables '[{"name":"appName","description":"Application name","type":"string","required":true}]' \
  --include package.json \
  --include src/main.tsx
```

**Options:**
| Option | Description |
|--------|-------------|
| `--template <name>` | Template name; optional in monolith mode |
| `--description <text>` / `--description-file <path>` | Boilerplate description |
| `--instruction <text>` / `--instruction-file <path>` | Optional usage instructions |
| `--target-folder <path>` | Target folder; defaults to `.` in monolith mode |
| `--variables <json>` | JSON array of variable definitions |
| `--include <path>` | Include path; repeat for multiple files |

### `scaffold generate <name>`

Create a feature scaffold configuration in a template's `scaffold.yaml`.

```bash
npx @agiflowai/scaffold-mcp scaffold generate scaffold-service \
  --template typescript-lib \
  --description "Generate a service class and unit test" \
  --variables '[{"name":"serviceName","description":"Service name","type":"string","required":true}]' \
  --include src/services/ExampleService.ts \
  --pattern 'src/services/**/*.ts'
```

**Options:**
| Option | Description |
|--------|-------------|
| `--template <name>` | Template name; optional in monolith mode |
| `--description <text>` / `--description-file <path>` | Feature description |
| `--instruction <text>` / `--instruction-file <path>` | Optional usage instructions |
| `--variables <json>` | JSON array of variable definitions |
| `--include <path>` | Include path; repeat for multiple files |
| `--pattern <glob>` | Matching file pattern; repeat for multiple patterns |

### `template file create <file-path>`

Create or update a Liquid template file for boilerplates or features.

```bash
npx @agiflowai/scaffold-mcp template file create src/index.ts \
  --template typescript-lib \
  --content 'export const {{ name | camelCase }} = "{{ name }}";'
```

Use exactly one of `--content`, `--content-file`, or `--source-file`. The command writes `.liquid` files automatically.

---

## Utility Commands

### `file write <file-path>`

Write content to a file inside the current workspace.

```bash
npx @agiflowai/scaffold-mcp file write .env.local \
  --content 'NEXT_PUBLIC_API_URL=https://api.example.com'
```

Use `--content-file <path>` to read content from an existing file.

---

## Complete Workflow Example

```bash
# 1. List available boilerplates
npx @agiflowai/scaffold-mcp boilerplate list

# 2. Create a new Next.js project
npx @agiflowai/scaffold-mcp boilerplate create nextjs-15-drizzle \
  --vars '{"projectName":"my-app","packageName":"@myorg/my-app","appName":"My App"}' \
  --target-folder ./apps

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
