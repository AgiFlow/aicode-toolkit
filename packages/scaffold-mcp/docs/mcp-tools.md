# MCP Tools Reference

Complete reference for MCP server tools when running scaffold-mcp as an MCP server.

---

## Standard Tools

### list-boilerplates

List all available project boilerplate templates.

**Arguments:** None

**Returns:**
```json
{
  "boilerplates": [
    {
      "name": "nextjs-15-drizzle",
      "description": "Next.js 15 application with TypeScript and Tailwind CSS",
      "template_path": "nextjs-15",
      "variables_schema": {
        "type": "object",
        "properties": {
          "projectName": { "type": "string", "description": "Project directory name" },
          "packageName": { "type": "string", "description": "NPM package name" }
        },
        "required": ["projectName", "packageName"]
      }
    }
  ]
}
```

**When to use:** Starting a new project, showing available templates to users.

---

### use-boilerplate

Create a new project from a boilerplate template.

**Arguments:**
```typescript
{
  boilerplateName: string;    // Exact name from list-boilerplates
  variables: {                // Variables matching the boilerplate's schema
    projectName: string;
    packageName: string;
    [key: string]: any;
  };
}
```

**Example:**
```json
{
  "boilerplateName": "nextjs-15-drizzle",
  "variables": {
    "projectName": "my-app",
    "packageName": "@myorg/my-app",
    "appName": "My App"
  }
}
```

**Returns:**
```json
{
  "success": true,
  "message": "Successfully scaffolded my-app in ./apps/my-app",
  "createdFiles": [
    "./apps/my-app/package.json",
    "./apps/my-app/project.json",
    "./apps/my-app/src/app/page.tsx"
  ]
}
```

---

### list-scaffolding-methods

List available scaffold methods (features) for an existing project.

**Arguments:**
```typescript
{
  projectPath: string;  // Absolute path to the project directory
}
```

**Example:**
```json
{
  "projectPath": "/Users/me/workspace/apps/my-app"
}
```

**Returns:**
```json
{
  "scaffoldingMethods": [
    {
      "name": "scaffold-nextjs-page",
      "description": "Add new pages to Next.js applications",
      "variables_schema": {
        "type": "object",
        "properties": {
          "pageTitle": { "type": "string", "description": "Title for the page" }
        },
        "required": ["pageTitle"]
      }
    }
  ]
}
```

**How it works:**
1. Reads `project.json` from the project directory
2. Extracts `sourceTemplate` field
3. Finds the template and reads `scaffold.yaml`
4. Returns all defined scaffold methods

---

### use-scaffold-method

Add a feature to an existing project using a scaffold method.

**Arguments:**
```typescript
{
  projectPath: string;           // Absolute path to the project
  scaffold_feature_name: string; // Name of the scaffold method
  variables: {                   // Variables matching the method's schema
    [key: string]: any;
  };
}
```

**Example:**
```json
{
  "projectPath": "/Users/me/workspace/apps/my-app",
  "scaffold_feature_name": "scaffold-nextjs-page",
  "variables": {
    "appPath": "/Users/me/workspace/apps/my-app",
    "appName": "my-app",
    "pageTitle": "About Us",
    "nextjsPagePath": "/about"
  }
}
```

**Returns:**
```json
{
  "success": true,
  "message": "Successfully scaffolded scaffold-nextjs-page",
  "instruction": "Next.js page created. Access at /about",
  "createdFiles": ["/Users/me/workspace/apps/my-app/src/app/about/page.tsx"],
  "existingFiles": [],
  "warnings": []
}
```

---

### write-to-file

Write content to a file (utility tool).

**Arguments:**
```typescript
{
  file_path: string;  // Absolute or relative path to file
  content: string;    // Content to write
}
```

**Example:**
```json
{
  "file_path": "/Users/me/workspace/apps/my-app/.env.local",
  "content": "NEXT_PUBLIC_API_URL=https://api.example.com"
}
```

**When to use:** Creating custom files not covered by templates.

---

## Admin Tools

Available when server is started with `--admin-enable` flag.

### generate-boilerplate

Create a new boilerplate configuration in a template's scaffold.yaml.

**Arguments:**
```typescript
{
  templateName: string;      // Template folder name
  boilerplateName: string;   // Boilerplate name (kebab-case)
  description: string;       // Detailed description
  targetFolder: string;      // Target folder (e.g., "apps", "packages")
  variables: Array<{         // Variable definitions
    name: string;
    type: string;
    description: string;
    required?: boolean;
  }>;
  includes: string[];        // Template files to include
  instruction?: string;      // Usage instructions
}
```

---

### generate-feature-scaffold

Create a new feature configuration in a template's scaffold.yaml.

**Arguments:**
```typescript
{
  templateName: string;     // Template folder name
  featureName: string;      // Feature name (kebab-case)
  description: string;      // Feature description
  variables: Array<{        // Variable definitions
    name: string;
    type: string;
    description: string;
    required?: boolean;
  }>;
  includes?: string[];      // Template files to include
  patterns?: string[];      // File patterns this feature works with
  instruction?: string;     // Usage instructions
}
```

---

### generate-boilerplate-file

Create template files for boilerplates or features.

**Arguments:**
```typescript
{
  templateName: string;    // Template folder name
  filePath: string;        // Path within the template
  content: string;         // File content with Liquid variables
  header?: string;         // Header comment for AI hints
  sourceFile?: string;     // Copy from existing source file
}
```

---

## Usage Patterns

### Pattern 1: Create New Project

```
1. list-boilerplates          → Show available templates
2. use-boilerplate            → Create project with variables
3. list-scaffolding-methods   → Show available features
4. use-scaffold-method        → Add initial features
```

### Pattern 2: Add Features

```
1. list-scaffolding-methods   → Show available features for project
2. use-scaffold-method        → Add each feature
3. write-to-file              → Create custom files if needed
```

### Pattern 3: Create Custom Template

```
1. generate-boilerplate       → Create scaffold.yaml entry
2. generate-boilerplate-file  → Add template files
3. list-boilerplates          → Verify template appears
4. use-boilerplate            → Test the template
```

---

## Best Practices

1. **Always use absolute paths** for `projectPath` arguments
2. **Call list tools first** to validate templates/methods exist
3. **Check the variable schema** before calling create/add tools
4. **Show the instruction field** to users after scaffolding
5. **Track created files** to show what was generated
