# Advanced Generators Guide

Advanced guide for creating custom generators in scaffold-mcp for complex scaffolding logic.

## Table of Contents

- [Overview](#overview)
- [When to Use Custom Generators](#when-to-use-custom-generators)
- [Generator Structure](#generator-structure)
- [Generator Context API](#generator-context-api)
- [Common Patterns](#common-patterns)
- [Complete Example](#complete-example)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

Custom generators provide full programmatic control over the scaffolding process. Unlike simple template-based scaffolding, generators can:

- Apply complex path transformations
- Read and analyze existing project files
- Make decisions based on project structure
- Implement custom validation logic
- Orchestrate multi-step scaffolding workflows

Generators are TypeScript files placed in the `generators/` folder within your template directory and referenced in your `scaffold.yaml` configuration.

---

## When to Use Custom Generators

### Use Cases for Custom Generators

✅ **Use a custom generator when:**

- **Complex path transformations**: Converting route names like `/dashboard/user/[id]` into nested folder structures
- **Conditional logic beyond simple includes**: Making decisions based on existing project structure
- **File content analysis**: Reading existing files to determine what to generate
- **Dynamic file generation**: Creating variable numbers of files based on input
- **Custom validation**: Implementing validation logic beyond JSON Schema
- **Multi-step workflows**: Coordinating multiple operations in sequence

❌ **Don't use a custom generator when:**

- **Simple file copying**: Use `includes` in `scaffold.yaml` instead
- **Basic conditional includes**: Use `?condition=value` syntax in includes
- **Simple variable replacement**: Liquid templates are sufficient

---

## Generator Structure

### Directory Layout

Place generators in your template's `generators/` folder:

```
templates/
└── my-template/
    ├── scaffold.yaml              # References the generator
    ├── generators/
    │   ├── package.json           # Generator dependencies
    │   └── myGenerator.ts         # Your generator implementation
    └── src/                       # Template files
        └── ...
```

### Generator Dependencies (package.json)

Create a `package.json` in the `generators/` folder:

```json
{
  "type": "module",
  "dependencies": {
    "@agiflowai/aicode-utils": "workspace:*"
  }
}
```

This enables:

- Proper TypeScript support and IntelliSense
- Type definitions for generator context
- Shared utilities (though most are passed via context to avoid import resolution issues)

### Scaffold Configuration

Reference your generator in `scaffold.yaml`:

```yaml
features:
  - name: scaffold-my-feature
    description: My custom feature with advanced logic

    # Reference the generator file
    generator: myGenerator.ts

    # Define variables
    variables_schema:
      type: object
      properties:
        featureName:
          type: string
          description: Name of the feature
      required:
        - featureName

    # Define template files to process
    includes:
      - src/features/feature/index.ts
      - src/features/feature/feature.test.ts
```

---

## Generator Context API

### Generator Function Signature

Every generator must export a default function with this signature:

```typescript
import { GeneratorContext, ScaffoldResult } from '@agiflowai/aicode-utils';

const generate = async (context: GeneratorContext): Promise<ScaffoldResult> => {
  // Your implementation
};

export default generate;
```

### Context Object Properties

The `GeneratorContext` object provides everything needed for scaffolding:

| Property                    | Type                               | Description                                      |
| --------------------------- | ---------------------------------- | ------------------------------------------------ |
| **Core Properties**         |                                    |                                                  |
| `variables`                 | `Record<string, any>`              | User-provided variables from the MCP call or CLI |
| `config`                    | `ArchitectConfig[string]`          | Scaffold configuration from `scaffold.yaml`      |
| `targetPath`                | `string`                           | Absolute path to the target project directory    |
| `templatePath`              | `string`                           | Absolute path to the template directory          |
| **Services**                |                                    |                                                  |
| `fileSystem`                | `IFileSystemService`               | File system operations (read, write, copy, etc.) |
| `scaffoldConfigLoader`      | `IScaffoldConfigLoader`            | Config parsing and validation utilities          |
| `variableReplacer`          | `IVariableReplacementService`      | Liquid template variable replacement             |
| **Utilities**               |                                    |                                                  |
| `ScaffoldProcessingService` | `class`                            | Constructor for processing service (recommended) |
| `getRootPath`               | `() => string`                     | Get workspace root path                          |
| `getProjectPath`            | `(absolutePath: string) => string` | Convert absolute path to relative project path   |

### Built-in Variables

The following variables are automatically available (in addition to user-provided variables):

**For Boilerplates:**

```typescript
{
  projectName: string; // Project directory name
  packageName: string; // NPM package name
  // ...user variables
}
```

**For Features:**

```typescript
{
  projectName: string; // Name of the target project
  appPath: string; // Absolute path to the project
  appName: string; // Same as projectName
  // ...user variables
}
```

### Return Type (ScaffoldResult)

Your generator must return a `ScaffoldResult` object:

```typescript
interface ScaffoldResult {
  success: boolean; // Whether scaffolding succeeded
  message: string; // User-facing message
  warnings?: string[]; // Optional warnings
  createdFiles?: string[]; // List of created file paths
  existingFiles?: string[]; // List of existing files that were preserved
}
```

**Success example:**

```typescript
return {
  success: true,
  message: `Successfully scaffolded route at ${routePath}`,
  createdFiles: ['/path/to/route/page.tsx', '/path/to/route/layout.tsx'],
  warnings: ['Route already has a loading.tsx file, skipped'],
};
```

**Error example:**

```typescript
return {
  success: false,
  message: `Invalid route path: ${routePath}. Routes must start with /`,
};
```

---

## Common Patterns

### Pattern 1: Type-Safe Variables

Always define and use typed variables:

```typescript
import { GeneratorContext, ScaffoldResult } from '@agiflowai/aicode-utils';

interface MyFeatureVariables {
  appPath: string;
  featureName: string;
  featureNamePascal: string;
  withTests?: boolean;
  withStyles?: boolean;
}

const generate = async (context: GeneratorContext): Promise<ScaffoldResult> => {
  const { variables } = context;
  const typedVars = variables as MyFeatureVariables;

  // Now you have type safety and IntelliSense
  const featureName = typedVars.featureName;
  const includeTests = typedVars.withTests ?? false;

  // ...
};
```

### Pattern 2: Using ScaffoldProcessingService

The recommended way to copy and process template files:

```typescript
import path from 'node:path';
import { ScaffoldProcessingService } from '@agiflowai/aicode-utils';

const generate = async (context: GeneratorContext): Promise<ScaffoldResult> => {
  const { fileSystem, variableReplacer, variables, templatePath, targetPath } = context;

  // Create processing service instance
  const processingService = new ScaffoldProcessingService(fileSystem, variableReplacer);

  const createdFiles: string[] = [];
  const existingFiles: string[] = [];

  // Copy and process a file with variable replacement
  await processingService.copyAndProcess(
    path.join(templatePath, 'src/component/Component.tsx'),
    path.join(targetPath, 'src/components/MyComponent.tsx'),
    variables,
    createdFiles,
    existingFiles, // Optional: track existing files separately
  );

  return {
    success: true,
    message: 'Component scaffolded successfully',
    createdFiles,
    existingFiles,
  };
};
```

**Key features of `copyAndProcess`:**

- Automatically handles `.liquid` template files (strips extension)
- Performs Liquid variable replacement
- Tracks created files
- Optionally tracks existing files without overwriting
- Creates parent directories automatically

### Pattern 3: Parsing Includes with Conditions

Process the `includes` array from your config with conditional logic:

```typescript
const generate = async (context: GeneratorContext): Promise<ScaffoldResult> => {
  const { config, variables, scaffoldConfigLoader, templatePath, targetPath } = context;

  const parsedIncludes = [];
  const warnings: string[] = [];

  // Iterate through includes defined in scaffold.yaml
  for (const includeEntry of config.includes) {
    // Parse the include entry (handles syntax like "file.tsx?condition=value")
    const parsed = scaffoldConfigLoader.parseIncludeEntry(includeEntry, variables);

    // Check if file should be included based on conditions
    if (!scaffoldConfigLoader.shouldIncludeFile(parsed.conditions, variables)) {
      continue; // Skip this file
    }

    // Check if target file already exists
    const targetFilePath = path.join(targetPath, parsed.targetPath);
    if (await fileSystem.pathExists(targetFilePath)) {
      warnings.push(`File ${parsed.targetPath} already exists, will be preserved`);
    }

    parsedIncludes.push(parsed);
  }

  // Process parsed includes
  // ...
};
```

### Pattern 4: Custom Path Transformations

Transform paths based on user input (e.g., for routing structures):

```typescript
interface RouteVariables {
  routePath: string; // e.g., "/dashboard/users/[id]"
}

const generate = async (context: GeneratorContext): Promise<ScaffoldResult> => {
  const { variables } = context;
  const { routePath } = variables as RouteVariables;

  // Transform Next.js route path to folder structure
  // "/dashboard/users/[id]" -> "src/app/dashboard/users/[id]"
  const segments = routePath.split('/').filter(Boolean);
  const folderPath = path.join('src', 'app', ...segments);

  // Custom mapping for includes
  const customIncludes = [
    {
      source: 'src/app/page/page.tsx',
      target: path.join(folderPath, 'page.tsx'),
    },
    {
      source: 'src/app/page/layout.tsx',
      target: path.join(folderPath, 'layout.tsx'),
    },
  ];

  // Process with custom paths
  for (const { source, target } of customIncludes) {
    await processingService.copyAndProcess(
      path.join(templatePath, source),
      path.join(targetPath, target),
      variables,
      createdFiles,
    );
  }

  return {
    success: true,
    message: `Route scaffolded at ${folderPath}`,
    createdFiles,
  };
};
```

### Pattern 5: Error Handling

Always wrap your logic in try-catch and return appropriate results:

```typescript
const generate = async (context: GeneratorContext): Promise<ScaffoldResult> => {
  try {
    const { variables } = context;

    // Validation
    if (!variables.featureName) {
      return {
        success: false,
        message: 'Feature name is required',
      };
    }

    // Custom validation logic
    if (!/^[A-Z]/.test(variables.featureName)) {
      return {
        success: false,
        message: 'Feature name must start with an uppercase letter',
      };
    }

    // Your scaffolding logic
    // ...

    return {
      success: true,
      message: 'Feature scaffolded successfully',
    };
  } catch (error) {
    return {
      success: false,
      message: `Error scaffolding feature: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
```

### Pattern 6: Reading Existing Files

Analyze existing project structure before generating:

```typescript
const generate = async (context: GeneratorContext): Promise<ScaffoldResult> => {
  const { fileSystem, targetPath } = context;

  // Check if a config file exists
  const configPath = path.join(targetPath, 'app.config.json');
  let existingConfig = {};

  if (await fileSystem.pathExists(configPath)) {
    const content = await fileSystem.readFile(configPath, 'utf-8');
    existingConfig = JSON.parse(content);
  }

  // Make decisions based on existing config
  const shouldIncludeAuth = existingConfig.features?.includes('auth');

  // Adjust scaffolding accordingly
  // ...
};
```

---

## Complete Example

Here's a complete example of a TanStack Router route generator with advanced path transformations:

```typescript
import path from 'node:path';
import {
  GeneratorContext,
  ParsedInclude,
  ScaffoldResult,
  ScaffoldProcessingService,
} from '@agiflowai/aicode-utils';

interface ViteReactRouteVariables {
  appPath: string;
  appName: string;
  routeName: string; // e.g., "dashboard/users"
  routeNamePascal: string; // e.g., "DashboardUsers"
  withUI?: boolean;
  withValidator?: boolean;
  dynamicParams?: string[]; // e.g., ["id", "slug"]
  projectName: string;
  packageName: string;
}

const generate = async (context: GeneratorContext): Promise<ScaffoldResult> => {
  try {
    const {
      variables,
      config,
      templatePath,
      targetPath,
      fileSystem,
      scaffoldConfigLoader,
      variableReplacer,
    } = context;

    const typedVariables = variables as ViteReactRouteVariables;

    // Initialize processing service
    const processingService = new ScaffoldProcessingService(fileSystem, variableReplacer);

    // Parse includes from config with custom path transformation
    const parsedIncludes: ParsedInclude[] = [];
    const warnings: string[] = [];

    for (const includeEntry of config.includes) {
      const parsed = scaffoldConfigLoader.parseIncludeEntry(includeEntry, variables);

      // Check conditions (e.g., ?withUI=true)
      if (!scaffoldConfigLoader.shouldIncludeFile(parsed.conditions, variables)) {
        continue;
      }

      // Custom path transformation for TanStack Router structure
      if (parsed.targetPath.startsWith('src/routes/route/')) {
        const relativePath = parsed.targetPath.replace('src/routes/route/', '');

        // Transform route name into folder structure
        // "dashboard/users" -> "src/routes/dashboard/users/"
        const routeSegments = typedVariables.routeName.split('/');
        const routePath = routeSegments.join('/');

        parsed.targetPath = path.join('src', 'routes', routePath, relativePath);
      }

      parsedIncludes.push(parsed);

      // Check for existing files
      const targetFilePath = path.join(targetPath, parsed.targetPath);
      if (await fileSystem.pathExists(targetFilePath)) {
        warnings.push(`File/folder ${parsed.targetPath} will be overwritten`);
      }
    }

    // Ensure target directory exists
    await fileSystem.ensureDir(targetPath);

    // Copy and process files
    const createdFiles: string[] = [];

    for (const parsed of parsedIncludes) {
      const sourcePath = path.join(templatePath, parsed.sourcePath);
      const targetFilePath = path.join(targetPath, parsed.targetPath);

      await processingService.copyAndProcess(sourcePath, targetFilePath, variables, createdFiles);
    }

    // Prepare success message
    const routeLocation = `src/routes/${typedVariables.routeName}/`;
    const message = `Successfully scaffolded TanStack Router route "${typedVariables.routeNamePascal}" at ${routeLocation}`;

    return {
      success: true,
      message,
      warnings: warnings.length > 0 ? warnings : undefined,
      createdFiles: createdFiles.length > 0 ? createdFiles : undefined,
    };
  } catch (error) {
    return {
      success: false,
      message: `Error generating TanStack Router route: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

export default generate;
```

### Corresponding scaffold.yaml

```yaml
features:
  - name: scaffold-tanstack-route
    description: Add a new TanStack Router route with optional UI and validation

    generator: viteReactRouteGenerator.ts

    variables_schema:
      type: object
      properties:
        routeName:
          type: string
          description: Route path (e.g., "dashboard/users")
          example: dashboard/users
        routeNamePascal:
          type: string
          description: PascalCase name for the route component
          example: DashboardUsers
        withUI:
          type: boolean
          description: Include UI components
          default: false
        withValidator:
          type: boolean
          description: Include form validation
          default: false
        dynamicParams:
          type: array
          description: Dynamic route parameters
          items:
            type: string
      required:
        - routeName
        - routeNamePascal
      additionalProperties: false

    includes:
      - src/routes/route/index.tsx
      - src/routes/route/route.lazy.tsx
      - src/routes/route/components/UI.tsx?withUI=true
      - src/routes/route/validators.ts?withValidator=true
```

### Template Files

**src/routes/route/index.tsx.liquid:**

```typescript
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/{{ routeName }}')({
  component: {{ routeNamePascal }}Component,
})

function {{ routeNamePascal }}Component() {
  return (
    <div>
      <h1>{{ routeNamePascal }}</h1>
      {% if withUI %}
      <UI />
      {% endif %}
    </div>
  )
}
```

---

## Best Practices

### 1. Type Everything

```typescript
// ✅ Good: Type-safe variables
interface MyFeatureVariables {
  featureName: string;
  withTests: boolean;
}

const typedVars = variables as MyFeatureVariables;

// ❌ Bad: Accessing variables without types
const featureName = variables.featureName; // No IntelliSense
```

### 2. Use ScaffoldProcessingService

```typescript
// ✅ Good: Use the processing service
const processingService = new ScaffoldProcessingService(fileSystem, variableReplacer);
await processingService.copyAndProcess(source, target, variables, createdFiles);

// ❌ Bad: Manual file operations (error-prone)
await fileSystem.copy(source, target);
const content = await fileSystem.readFile(target, 'utf-8');
const replaced = variableReplacer.replace(content, variables);
await fileSystem.writeFile(target, replaced);
```

### 3. Track All Created Files

```typescript
// ✅ Good: Track every file created
const createdFiles: string[] = [];
await processingService.copyAndProcess(source, target, variables, createdFiles);

return {
  success: true,
  message: 'Success',
  createdFiles, // User sees what was created
};

// ❌ Bad: Don't track files
return {
  success: true,
  message: 'Success',
  // User has no visibility into what was created
};
```

### 4. Handle Existing Files Gracefully

```typescript
// ✅ Good: Preserve existing files
const existingFiles: string[] = [];
await processingService.copyAndProcess(
  source,
  target,
  variables,
  createdFiles,
  existingFiles, // Pass array to track existing files
);

return {
  success: true,
  message: 'Success',
  createdFiles,
  existingFiles, // User knows what was preserved
  warnings: existingFiles.length > 0 ? [`${existingFiles.length} files were preserved`] : undefined,
};

// ❌ Bad: Silently overwrite
await processingService.copyAndProcess(source, target, variables, createdFiles);
// Existing files are overwritten without warning
```

### 5. Validate Early

```typescript
// ✅ Good: Validate before processing
const generate = async (context: GeneratorContext): Promise<ScaffoldResult> => {
  const { variables } = context;

  // Validate required fields
  if (!variables.featureName) {
    return {
      success: false,
      message: 'Feature name is required'
    };
  }

  // Validate format
  if (!/^[A-Z]/.test(variables.featureName)) {
    return {
      success: false,
      message: 'Feature name must start with uppercase letter'
    };
  }

  // Proceed with scaffolding
  // ...
};

// ❌ Bad: Validate late or not at all
const generate = async (context: GeneratorContext): Promise<ScaffoldResult> => {
  // Start processing without validation
  await processingService.copyAndProcess(...);
  // Error happens mid-process, partial files created
};
```

### 6. Return Detailed Results

```typescript
// ✅ Good: Comprehensive result
return {
  success: true,
  message: `Successfully scaffolded route at ${routePath}`,
  createdFiles: ['/project/src/routes/page.tsx', '/project/src/routes/layout.tsx'],
  existingFiles: [
    '/project/src/routes/loading.tsx', // Already existed
  ],
  warnings: ['Route already has a loading.tsx, preserved existing file'],
};

// ❌ Bad: Minimal result
return {
  success: true,
  message: 'Done',
};
```

### 7. Consistent Error Messages

```typescript
// ✅ Good: Descriptive error with context
return {
  success: false,
  message: `Invalid route path "${routePath}". Route paths must start with "/" and contain only alphanumeric characters, hyphens, and underscores.`,
};

// ❌ Bad: Vague error
return {
  success: false,
  message: 'Invalid input',
};
```

### 8. Use Path Utilities

```typescript
import path from 'node:path';

// ✅ Good: Use path.join for cross-platform compatibility
const targetPath = path.join(targetPath, 'src', 'components', 'Button.tsx');

// ❌ Bad: String concatenation (breaks on Windows)
const targetPath = targetPath + '/src/components/Button.tsx';
```

---

## Troubleshooting

### Generator Not Found

**Error:** `Error loading or executing generator myGenerator.ts`

**Solutions:**

1. Verify generator file exists at `templates/<template-name>/generators/myGenerator.ts`
2. Check `scaffold.yaml` references the correct filename
3. Ensure generator exports a default function

```typescript
// ✅ Correct export
export default generate;

// ❌ Wrong: named export
export { generate };
```

### Type Import Errors

**Error:** `Cannot find module '@agiflowai/aicode-utils'`

**Solutions:**

1. Create `package.json` in `generators/` folder:
   ```json
   {
     "type": "module",
     "dependencies": {
       "@agiflowai/aicode-utils": "workspace:*"
     }
   }
   ```
2. Import types from the package (types only, not runtime code)
3. Use context properties for runtime code (passed via context object)

### Variable Replacement Not Working

**Problem:** Variables not being replaced in generated files

**Solutions:**

1. Ensure source files use `.liquid` extension OR are processed through `copyAndProcess`
2. Check Liquid syntax: `{{ variableName }}` not `{variableName}`
3. Verify variables are passed to `copyAndProcess`:
   ```typescript
   await processingService.copyAndProcess(
     sourcePath,
     targetPath,
     variables, // ← Make sure this is passed
     createdFiles,
   );
   ```

### Path Resolution Issues

**Problem:** Files created in wrong location

**Solutions:**

1. Use absolute paths consistently:
   ```typescript
   const targetFilePath = path.join(targetPath, 'src', 'components', 'Button.tsx');
   ```
2. Use `path.resolve()` when needed:
   ```typescript
   const absoluteTarget = path.resolve(targetPath, relativePath);
   ```
3. Check `targetPath` is correct (should be absolute path to project)

### Files Not Created

**Problem:** Generator succeeds but no files appear

**Solutions:**

1. Ensure directories are created:
   ```typescript
   await fileSystem.ensureDir(path.dirname(targetFilePath));
   ```
2. Check file paths are correct
3. Verify source files exist
4. Check permissions on target directory

### Includes Not Processed

**Problem:** Include conditions not working

**Solutions:**

1. Parse includes correctly:
   ```typescript
   const parsed = scaffoldConfigLoader.parseIncludeEntry(includeEntry, variables);
   ```
2. Check conditions:
   ```typescript
   if (!scaffoldConfigLoader.shouldIncludeFile(parsed.conditions, variables)) {
     continue; // Skip this file
   }
   ```
3. Ensure condition variables match exactly:
   ```yaml
   # scaffold.yaml
   includes:
     - file.tsx?withLayout=true
   ```
   ```typescript
   // Generator must pass withLayout variable
   variables: {
     withLayout: true;
   }
   ```

---

## Advanced Topics

### Creating Custom File System Operations

If you need operations beyond what's provided:

```typescript
const generate = async (context: GeneratorContext): Promise<ScaffoldResult> => {
  const { fileSystem } = context;

  // Read directory
  const files = await fileSystem.readdir('/path/to/dir');

  // Get file stats
  const stats = await fileSystem.stat('/path/to/file');

  // Check if path exists
  const exists = await fileSystem.pathExists('/path/to/file');

  // Copy files/directories
  await fileSystem.copy('/source', '/target');

  // Remove files/directories
  await fileSystem.remove('/path/to/remove');

  // Create directory
  await fileSystem.ensureDir('/path/to/create');

  // Read file
  const content = await fileSystem.readFile('/path/to/file', 'utf-8');

  // Write file
  await fileSystem.writeFile('/path/to/file', 'content');
};
```

### Working with Multiple Projects

When scaffolding affects multiple projects:

```typescript
const generate = async (context: GeneratorContext): Promise<ScaffoldResult> => {
  const { targetPath, getRootPath } = context;

  // Get workspace root
  const workspaceRoot = getRootPath();

  // Access sibling projects
  const apiProjectPath = path.join(workspaceRoot, 'apps', 'api');
  const webProjectPath = path.join(workspaceRoot, 'apps', 'web');

  // Generate in multiple locations
  // ...
};
```

### Custom Variable Transformations

Beyond Liquid filters:

```typescript
const generate = async (context: GeneratorContext): Promise<ScaffoldResult> => {
  const { variables } = context;

  // Custom transformations
  const enrichedVariables = {
    ...variables,
    // kebab-case to PascalCase
    componentNamePascal: variables.componentName
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(''),
    // Generate timestamp
    generatedAt: new Date().toISOString(),
    // Add computed values
    routePath: `/${variables.moduleName}/${variables.routeName}`,
  };

  // Use enriched variables for processing
  await processingService.copyAndProcess(
    sourcePath,
    targetPath,
    enrichedVariables, // ← Enhanced variables
    createdFiles,
  );
};
```

---

## Summary

Custom generators provide powerful capabilities for complex scaffolding scenarios:

1. **Use types** for safety and IntelliSense
2. **Use `ScaffoldProcessingService`** for file operations
3. **Track all files** (created and existing)
4. **Validate early** and return detailed results
5. **Handle errors** gracefully with try-catch
6. **Test thoroughly** with different variable combinations

For simpler use cases, stick with template-based scaffolding. Use generators only when you need the extra power and control they provide.
