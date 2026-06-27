# Template Conventions

Comprehensive guide for creating templates and understanding the scaffolding system in scaffold-mcp.

## Table of Contents

- [Overview](#overview)
- [Template Structure](#template-structure)
- [Configuration Files](#configuration-files)
  - [scaffold.yaml](#scaffoldyaml)
    - [Excluding Files from Scaffold Enforcement](#excluding-files-from-scaffold-enforcement)
  - [Variables Schema](#variables-schema)
  - [Include Patterns](#include-patterns)
- [Liquid Template Syntax](#liquid-template-syntax)
  - [Variables](#variables)
  - [Filters](#filters)
  - [Control Flow](#control-flow)
  - [Comments](#comments)
- [File Naming Conventions](#file-naming-conventions)
- [Best Practices](#best-practices)
- [Examples](#examples)

---

## Overview

scaffold-mcp uses a powerful templating system based on **LiquidJS** for variable replacement and **YAML** for configuration. Templates support:

- **Two scaffolding modes**: Boilerplates (new projects) and Features (add to existing projects)
- **Dynamic variable replacement** in file content and paths
- **Conditional includes** for optional files
- **Path mapping** for flexible file placement
- **Custom generators** for advanced logic

---

## Template Structure

### Basic Directory Layout

```
templates/
└── my-template/              # Template name (kebab-case recommended)
    ├── scaffold.yaml         # Template configuration (required)
    ├── generators/           # Custom generators (optional)
    │   ├── package.json
    │   └── myGenerator.ts
    └── src/                  # Template files (.liquid extension for templates)
        ├── package.json.liquid
        ├── tsconfig.json.liquid
        └── app/
            └── page.tsx.liquid
```

### Template File Extensions

- **`.liquid` extension**: Files with this extension are processed for variable replacement, and the extension is automatically stripped in the output
- **No extension**: Files without `.liquid` are copied as-is (useful for binary files, images, etc.)

**Example:**
```
Template:        src/app/{{ componentName }}/Component.tsx.liquid
Output:          src/app/Button/Component.tsx
```

### Template Organization

Templates use a **flat structure** in the `templates/` directory:

```
templates/
├── nextjs-15/
│   ├── scaffold.yaml
│   ├── generators/
│   └── src/
├── react-vite/
│   ├── scaffold.yaml
│   └── src/
└── express-api/
    ├── scaffold.yaml
    └── src/
```

Each template is a self-contained directory with its own `scaffold.yaml` configuration.

---

## Configuration Files

### scaffold.yaml

The main configuration file defining boilerplates and features.

#### Full Schema

```yaml
# Boilerplate configuration (for creating new projects)
boilerplate:
  # Single boilerplate
  name: nextjs-15-app
  description: Next.js 15 application with App Router, TypeScript, and Tailwind CSS

  # Target folder where projects will be created
  targetFolder: apps

  # Optional: Detailed instructions shown after scaffolding
  instruction: |
    Next.js 15 application created successfully.

    File purposes:
    - package.json: NPM dependencies and scripts
    - src/app/page.tsx: Main page component
    - src/app/layout.tsx: Root layout

    How to use:
    1. Run `pnpm install` to install dependencies
    2. Run `pnpm dev` to start development server
    3. Open http://localhost:3000

    Design patterns:
    - Use App Router for routing (src/app/)
    - Server Components by default
    - Client Components with 'use client' directive

  # Variable schema (JSON Schema format)
  variables_schema:
    type: object
    properties:
      projectName:
        type: string
        description: Project directory name
        example: my-app
      packageName:
        type: string
        description: NPM package name
        example: "@myorg/my-app"
      description:
        type: string
        description: Project description
        example: My Next.js application
      port:
        type: number
        description: Development server port
        example: 3000
        default: 3000
    required:
      - projectName
      - packageName
    additionalProperties: false

  # Files to include in the scaffolded project
  includes:
    - package.json
    - tsconfig.json
    - next.config.js
    - src/app/layout.tsx
    - src/app/page.tsx
    - public/favicon.ico

  # Optional: Custom generator for advanced logic
  generator: nextjsGenerator.ts

# Features configuration (for adding to existing projects)
features:
  # Array of features
  - name: scaffold-nextjs-page
    description: Add a new page to Next.js App Router application

    instruction: |
      Next.js page created successfully.

      The page follows the App Router structure and includes:
      - page.tsx: Main page component
      - layout.tsx: Optional layout (if withLayout=true)

      Access the page at: /your-page-path

    variables_schema:
      type: object
      properties:
        pagePath:
          type: string
          description: Page route path (e.g., "dashboard/settings")
          example: dashboard/settings
        pageTitle:
          type: string
          description: Page title for metadata
          example: Settings
        withLayout:
          type: boolean
          description: Include layout.tsx file
          default: false
      required:
        - pagePath
        - pageTitle
      additionalProperties: false

    # Conditional includes
    includes:
      - src/app/page/page.tsx
      - src/app/page/layout.tsx?withLayout=true

    # Optional: File patterns this feature works with (for documentation)
    patterns:
      - src/app/**/page.tsx
      - src/app/**/layout.tsx

  - name: scaffold-nextjs-component
    description: Add a React component with tests

    variables_schema:
      type: object
      properties:
        componentName:
          type: string
          description: Component name (PascalCase)
          example: Button
        withTests:
          type: boolean
          description: Include test file
          default: true
        withStorybook:
          type: boolean
          description: Include Storybook story
          default: false
      required:
        - componentName

    includes:
      - src/components/{{ componentName }}/{{ componentName }}.tsx
      - src/components/{{ componentName }}/{{ componentName }}.test.tsx?withTests=true
      - src/components/{{ componentName }}/{{ componentName }}.stories.tsx?withStorybook=true
```

#### Multiple Boilerplates

You can define multiple boilerplates in a single template:

```yaml
boilerplate:
  - name: nextjs-15-basic
    description: Basic Next.js 15 app
    targetFolder: apps
    variables_schema:
      # ...
    includes:
      # ...

  - name: nextjs-15-with-auth
    description: Next.js 15 app with authentication
    targetFolder: apps
    variables_schema:
      # ...
    includes:
      # ...
```

#### Excluding Files from Scaffold Enforcement

When the [scaffold hooks](./hooks.md) are enabled, agents are blocked from writing **new** files directly once a template defines any scaffolding methods — they are nudged to use a scaffolding method instead. Some files are never scaffolded (docs, content collections, generated files), so the optional top-level `exclude` key lists glob patterns whose new-file writes are allowed through directly:

```yaml
# scaffold.yaml
exclude:
  - '**/*.md'
  - '**/*.mdx'
  - '**/src/content/**'

boilerplate:
  - name: nextjs-15-app
    # ...

features:
  - name: scaffold-nextjs-page
    # ...
```

- **Scope:** applies to every project scaffolded from this template.
- **Matching:** globs are matched against the **absolute** file path (prefix with `**`), with dotfile traversal enabled.
- **Precedence:** a new-file write is allowed through when it matches *either* this template-level `exclude` **or** the workspace-wide `scaffold-mcp.hook.excludeGlobs` in `.toolkit/settings.yaml`. Otherwise, if the template defines any scaffolding methods, the write is denied with guidance.

Use a template's `exclude` for relaxations specific to that template's structure (e.g. `**/__generated__/**`, `**/*.stories.tsx`); use the workspace-wide setting for patterns that should be relaxed everywhere. See [Hooks Integration](./hooks.md#relaxing-enforcement) for the global setting.

### Variables Schema

The `variables_schema` uses **JSON Schema** format for validation.

#### Supported Types

```yaml
variables_schema:
  type: object
  properties:
    # String
    name:
      type: string
      description: User-friendly description
      example: my-app
      minLength: 1
      maxLength: 50
      pattern: "^[a-z][a-z0-9-]*$"  # Regex validation

    # Number
    port:
      type: number
      description: Port number
      example: 3000
      minimum: 1000
      maximum: 9999
      default: 3000

    # Boolean
    withTests:
      type: boolean
      description: Include tests
      default: true

    # Array
    features:
      type: array
      description: Features to include
      items:
        type: string
      example: ["auth", "database"]
      default: []

    # Enum
    framework:
      type: string
      description: Framework to use
      enum: ["react", "vue", "angular"]
      default: react

  required:
    - name

  additionalProperties: false  # Reject unknown properties
```

#### Built-in Variables

These variables are automatically provided by the scaffold system:

**For Boilerplates:**
- `projectName`: Project directory name (from user input)
- `packageName`: NPM package name (from user input)

**For Features:**
- `projectName`: Name of the target project
- `appPath`: Absolute path to the project directory
- `appName`: Same as `projectName`

**Usage:**
```yaml
# You can reference built-in variables in templates
includes:
  - src/config/{{ projectName }}.ts
```

### Include Patterns

The `includes` array supports advanced syntax for flexible file inclusion.

#### Basic Include

Copy a file as-is:

```yaml
includes:
  - package.json
  - src/app/page.tsx
  - public/logo.png
```

#### Variable in Path

Use Liquid syntax in paths:

```yaml
includes:
  - src/components/{{ componentName }}/{{ componentName }}.tsx
  - src/services/{{ serviceName | kebabCase }}/index.ts
```

**Example:**
```
Variables:    { componentName: "Button" }
Template:     src/components/{{ componentName }}/{{ componentName }}.tsx
Result:       src/components/Button/Button.tsx
```

#### Conditional Include

Include files only when conditions are met:

```yaml
includes:
  # Include only if withLayout is true
  - src/app/layout.tsx?withLayout=true

  # Include only if environment is "production"
  - config/prod.json?environment=production

  # Multiple conditions (AND logic)
  - src/auth/validator.ts?withAuth=true&withValidation=true
```

**Condition syntax:**
- `?key=value`: Include if variable `key` equals `value`
- `?key=true`: Include if variable `key` is truthy
- `?key=false`: Include if variable `key` is falsy
- `?key1=value1&key2=value2`: Multiple conditions (all must match)

#### Path Mapping

Map source file to a different target path:

```yaml
includes:
  # Basic mapping
  - template.tsx->src/app/page.tsx

  # With variables
  - template.tsx->src/app/{{ pagePath }}/page.tsx

  # With conditions and variables
  - auth-layout.tsx->src/app/{{ pagePath }}/layout.tsx?withAuth=true
```

**Example:**
```
Variables:    { pagePath: "dashboard/settings" }
Template:     template.tsx->src/app/{{ pagePath }}/page.tsx
Source:       template.tsx
Target:       src/app/dashboard/settings/page.tsx
```

#### Complex Patterns

Combine all features:

```yaml
includes:
  # Path with variables and conditions
  - src/components/{{ componentName }}/{{ componentName }}.test.tsx?withTests=true

  # Path mapping with variables and conditions
  - component-template.tsx->src/{{ folderPath }}/{{ componentName }}.tsx?createNew=true

  # Nested paths with filters
  - src/{{ moduleName | kebabCase }}/{{ componentName | pascalCase }}.tsx
```

---

## Liquid Template Syntax

scaffold-mcp uses **LiquidJS** for template processing. All `.liquid` files are processed for variable replacement.

### Variables

#### Basic Variable Interpolation

```liquid
{{ variableName }}
```

**Example template (package.json.liquid):**
```json
{
  "name": "{{ packageName }}",
  "version": "{{ version }}",
  "description": "{{ description }}"
}
```

**Variables:**
```json
{
  "packageName": "@myorg/my-app",
  "version": "1.0.0",
  "description": "My application"
}
```

**Output:**
```json
{
  "name": "@myorg/my-app",
  "version": "1.0.0",
  "description": "My application"
}
```

### Filters

LiquidJS supports filters to transform variables. scaffold-mcp includes custom filters for common case transformations.

#### Built-in Custom Filters

| Filter | Description | Example Input | Example Output |
|--------|-------------|---------------|----------------|
| `camelCase` | Convert to camelCase | `my-component` | `myComponent` |
| `pascalCase` | Convert to PascalCase | `my-component` | `MyComponent` |
| `titleCase` | Convert to TitleCase (alias for pascalCase) | `my component` | `MyComponent` |
| `kebabCase` | Convert to kebab-case | `MyComponent` | `my-component` |
| `snakeCase` | Convert to snake_case | `MyComponent` | `my_component` |
| `upperCase` | Convert to UPPER_CASE | `myVariable` | `MY_VARIABLE` |
| `lower` | Convert to lowercase | `MyComponent` | `mycomponent` |
| `upper` | Convert to uppercase | `mycomponent` | `MYCOMPONENT` |
| `pluralize` | Pluralize word | `user` | `users` |
| `singularize` | Singularize word | `users` | `user` |

#### Filter Usage

```liquid
{{ componentName | pascalCase }}
{{ serviceName | kebabCase }}
{{ constantName | upperCase }}
{{ tableName | pluralize }}
```

**Example:**
```typescript
// Template: Component.tsx.liquid
export const {{ componentName | pascalCase }} = () => {
  return <div>{{ componentName | titleCase }} Component</div>;
};

// Variables: { componentName: "my-button" }

// Output: Component.tsx
export const MyButton = () => {
  return <div>My Button Component</div>;
};
```

#### Chaining Filters

```liquid
{{ projectName | kebabCase | upper }}
```

**Example:**
```
Input:  { projectName: "MyAwesomeApp" }
Output: MY-AWESOME-APP
```

#### Standard Liquid Filters

LiquidJS also supports standard filters:

```liquid
{{ description | truncate: 50 }}           # Truncate to 50 characters
{{ items | join: ", " }}                   # Join array with separator
{{ text | replace: "foo", "bar" }}         # Replace text
{{ number | plus: 5 }}                     # Add numbers
{{ text | strip_html }}                    # Remove HTML tags
{{ date | date: "%Y-%m-%d" }}              # Format date
```

### Control Flow

#### Conditionals (if/elsif/else)

```liquid
{% if withAuth %}
import { authMiddleware } from './auth';
{% endif %}

export const config = {
  {% if environment == "production" %}
  apiUrl: "https://api.example.com",
  {% elsif environment == "staging" %}
  apiUrl: "https://staging-api.example.com",
  {% else %}
  apiUrl: "http://localhost:3000",
  {% endif %}
};
```

#### Comparison Operators

```liquid
{% if port > 8000 %}
{% if name == "admin" %}
{% if count != 0 %}
{% if enabled %}           # Truthy check
{% if items.size > 0 %}
```

#### Logical Operators

```liquid
{% if withAuth and withValidation %}
{% if environment == "prod" or environment == "production" %}
{% if not disabled %}
```

#### Loops (for)

```liquid
{% for feature in features %}
- {{ feature | capitalize }}
{% endfor %}

{% for item in items %}
  {{ forloop.index }}: {{ item.name }}
{% endfor %}
```

**Loop variables:**
- `forloop.index`: 1-based index
- `forloop.index0`: 0-based index
- `forloop.first`: True if first iteration
- `forloop.last`: True if last iteration
- `forloop.length`: Total iterations

**Example:**
```typescript
// Template
export const FEATURES = {
  {% for feature in features %}
  {{ feature | upperCase }}: true{% if forloop.last == false %},{% endif %}
  {% endfor %}
};

// Variables: { features: ["auth", "database", "api"] }

// Output
export const FEATURES = {
  AUTH: true,
  DATABASE: true,
  API: true
};
```

#### Unless (inverse if)

```liquid
{% unless disabled %}
console.log('Feature is enabled');
{% endunless %}
```

#### Case/When (switch statement)

```liquid
{% case framework %}
  {% when "react" %}
    import React from 'react';
  {% when "vue" %}
    import { defineComponent } from 'vue';
  {% when "angular" %}
    import { Component } from '@angular/core';
  {% else %}
    // Unknown framework
{% endcase %}
```

### Comments

```liquid
{% comment %}
This is a comment block.
It will not appear in the output.
{% endcomment %}

{%- comment -%}
This comment strips whitespace around it
{%- endcomment -%}
```

**Note:** Liquid uses `{% comment %}` blocks, NOT `{# #}` syntax.

### Whitespace Control

Use `-` to strip whitespace:

```liquid
{%- if condition -%}
  content
{%- endif -%}

{{- variable -}}
```

---

## File Naming Conventions

### Template Files

1. **Use `.liquid` extension** for files that need variable replacement
2. **Omit `.liquid`** for binary files or files that should be copied as-is
3. **Use variables in filenames** for dynamic naming

**Examples:**
```
✅ Good:
  package.json.liquid                                # Will become: package.json
  {{ componentName }}.tsx.liquid                     # Will become: Button.tsx
  {{ serviceName | kebabCase }}.service.ts.liquid    # Will become: user-auth.service.ts

❌ Bad:
  package.json                    # Won't process variables
  Component.tsx.liquid            # Hardcoded name, should use variable
```

### Directory Names

Use variables in directory names too:

```
Template structure:
  src/
    components/
      {{ componentName }}/
        {{ componentName }}.tsx.liquid
        {{ componentName }}.test.tsx.liquid

Variables: { componentName: "Button" }

Output:
  src/
    components/
      Button/
        Button.tsx
        Button.test.tsx
```

### Naming Recommendations

| Type | Convention | Example |
|------|------------|---------|
| Template directory | kebab-case | `nextjs-15`, `react-vite` |
| Boilerplate name | kebab-case with prefix | `scaffold-nextjs-app` |
| Feature name | kebab-case with prefix | `scaffold-nextjs-page` |
| Component variables | PascalCase | `Button`, `UserProfile` |
| File variables | varies by language | `user-service.ts`, `userService.ts` |
| Generator files | camelCase.ts | `nextjsPageGenerator.ts` |

---

## Best Practices

### 1. Use Meaningful Variable Names

```yaml
# ✅ Good: Clear, descriptive names
properties:
  componentName:
    type: string
    description: Name of the React component (PascalCase)
    example: UserProfile

  apiEndpoint:
    type: string
    description: API endpoint URL
    example: https://api.example.com

# ❌ Bad: Vague names
properties:
  name:
    type: string
  url:
    type: string
```

### 2. Provide Examples and Descriptions

```yaml
# ✅ Good: Helpful documentation
properties:
  routePath:
    type: string
    description: Route path for Next.js page (e.g., "dashboard/users/[id]")
    example: dashboard/users/[id]

# ❌ Bad: No context
properties:
  routePath:
    type: string
```

### 3. Use Filters for Consistency

```liquid
{# ✅ Good: Ensure consistent casing #}
export const {{ componentName | pascalCase }} = () => {
  const className = "{{ componentName | kebabCase }}";
};

{# ❌ Bad: Rely on user input casing #}
export const {{ componentName }} = () => {
  const className = "{{ componentName }}";
};
```

### 4. Validate Variable Formats

```yaml
# ✅ Good: Enforce format with regex
properties:
  componentName:
    type: string
    pattern: "^[A-Z][a-zA-Z0-9]*$"  # Must be PascalCase
    description: Component name in PascalCase

  packageName:
    type: string
    pattern: "^@[a-z0-9-]+/[a-z0-9-]+$"  # Must be @scope/name
    description: Scoped package name

# ❌ Bad: No validation
properties:
  componentName:
    type: string
  packageName:
    type: string
```

### 5. Use Conditional Includes Wisely

```yaml
# ✅ Good: Clear, purposeful conditions
includes:
  - src/auth/middleware.ts?withAuth=true
  - src/validation/schemas.ts?withValidation=true
  - src/styles/custom.css?customStyles=true

# ❌ Bad: Over-complicated conditions
includes:
  - src/file.ts?feature1=true&feature2=false&environment=prod&version=2
```

### 6. Organize Template Files

Mirror the output structure within each template:

```
# ✅ Good: Clear organization
templates/nextjs-15/
  scaffold.yaml
  src/
    app/
      page/
        page.tsx.liquid
        layout.tsx.liquid
    components/
      Button/
        Button.tsx.liquid

# ❌ Bad: Disorganized files
templates/nextjs-15/
  scaffold.yaml
  page.tsx.liquid
  layout.tsx.liquid
  button.tsx.liquid
```

### 7. Document Complex Templates

Add instruction field for complex scaffolds:

```yaml
instruction: |
  Next.js page created successfully at src/app/{{ pagePath }}/

  File purposes:
  - page.tsx: Main page component (Server Component by default)
  - layout.tsx: Page-specific layout (optional)

  How to use:
  1. Access the page at http://localhost:3000/{{ pagePath }}
  2. Add 'use client' directive if you need client-side interactivity
  3. Export metadata object for SEO optimization

  Design patterns:
  - Use Server Components for data fetching
  - Use Client Components for interactivity
  - Colocate related files in the same directory
```

### 8. Handle Edge Cases

```liquid
{# ✅ Good: Handle missing variables #}
export const config = {
  name: "{{ projectName }}",
  port: {{ port | default: 3000 }},
  features: [
    {% if features.size > 0 %}
      {% for feature in features %}
        "{{ feature }}"{% if forloop.last == false %},{% endif %}
      {% endfor %}
    {% endif %}
  ]
};

{# ❌ Bad: Assume variables exist #}
export const config = {
  name: "{{ projectName }}",
  port: {{ port }},
  features: {{ features }}
};
```

### 9. Test with Different Variable Combinations

Create test cases:

```yaml
# Test Case 1: Minimal variables
variables:
  componentName: Button

# Test Case 2: All optional features
variables:
  componentName: UserProfile
  withTests: true
  withStorybook: true
  withStyles: true

# Test Case 3: Edge cases
variables:
  componentName: My-Component-Name  # Test filters
  description: ""  # Test empty strings
```

### 10. Use Comments in Templates

```liquid
{# Component definition with TypeScript props interface #}
{% comment %}
This component follows the compound component pattern.
It exports both the main component and sub-components.
{% endcomment %}

interface {{ componentName }}Props {
  children: React.ReactNode;
  {% if withClassName %}
  className?: string;
  {% endif %}
}

export const {{ componentName }}: React.FC<{{ componentName }}Props> = ({
  children,
  {% if withClassName %}
  className,
  {% endif %}
}) => {
  return (
    <div {% if withClassName %}className={className}{% endif %}>
      {children}
    </div>
  );
};
```

---

## Examples

### Example 1: React Component Template

**scaffold.yaml:**
```yaml
features:
  - name: scaffold-react-component
    description: Create a React component with optional tests and styles

    variables_schema:
      type: object
      properties:
        componentName:
          type: string
          pattern: "^[A-Z][a-zA-Z0-9]*$"
          description: Component name in PascalCase
          example: UserProfile
        withTests:
          type: boolean
          description: Include test file
          default: true
        withStyles:
          type: boolean
          description: Include CSS module
          default: false
      required:
        - componentName
      additionalProperties: false

    includes:
      - src/components/{{ componentName }}/{{ componentName }}.tsx
      - src/components/{{ componentName }}/{{ componentName }}.test.tsx?withTests=true
      - src/components/{{ componentName }}/{{ componentName }}.module.css?withStyles=true
      - src/components/{{ componentName }}/index.ts
```

**Template: src/components/{{ componentName }}/{{ componentName }}.tsx.liquid**
```typescript
import React from 'react';
{% if withStyles %}
import styles from './{{ componentName }}.module.css';
{% endif %}

export interface {{ componentName }}Props {
  children?: React.ReactNode;
  {% if withStyles %}
  className?: string;
  {% endif %}
}

export const {{ componentName }}: React.FC<{{ componentName }}Props> = ({
  children,
  {% if withStyles %}
  className,
  {% endif %}
}) => {
  return (
    <div {% if withStyles %}className={`${styles.{{ componentName | camelCase }}} ${className || ''}`}{% endif %}>
      {children}
    </div>
  );
};
```

**Template: src/components/{{ componentName }}/index.ts.liquid**
```typescript
export { {{ componentName }} } from './{{ componentName }}';
export type { {{ componentName }}Props } from './{{ componentName }}';
```

### Example 2: API Route Template

**scaffold.yaml:**
```yaml
features:
  - name: scaffold-api-route
    description: Create an API route with validation and authentication

    variables_schema:
      type: object
      properties:
        routeName:
          type: string
          description: Route name (e.g., "users", "posts")
          example: users
        withAuth:
          type: boolean
          description: Include authentication middleware
          default: true
        withValidation:
          type: boolean
          description: Include request validation
          default: true
        methods:
          type: array
          description: HTTP methods to support
          items:
            type: string
            enum: ["GET", "POST", "PUT", "DELETE"]
          default: ["GET", "POST"]
      required:
        - routeName

    includes:
      - src/routes/{{ routeName | kebabCase }}/route.ts
      - src/routes/{{ routeName | kebabCase }}/validation.ts?withValidation=true
      - src/routes/{{ routeName | kebabCase }}/auth.ts?withAuth=true
```

**Template: src/routes/{{ routeName | kebabCase }}/route.ts.liquid**
```typescript
import { Request, Response, Router } from 'express';
{% if withAuth %}
import { authMiddleware } from './auth';
{% endif %}
{% if withValidation %}
import { validate{{ routeName | pascalCase }}Input } from './validation';
{% endif %}

const router = Router();

{% for method in methods %}
{% assign methodLower = method | lower %}
router.{{ methodLower }}(
  '/{{ routeName | kebabCase }}',
  {% if withAuth %}authMiddleware,{% endif %}
  {% if withValidation %}validate{{ routeName | pascalCase }}Input,{% endif %}
  async (req: Request, res: Response) => {
    // TODO: Implement {{ method }} /{{ routeName | kebabCase }}
    res.json({ message: '{{ method }} /{{ routeName | kebabCase }}' });
  }
);

{% endfor %}
export default router;
```

### Example 3: Configuration File Template

**Template: config/app.config.ts.liquid**
```typescript
export const appConfig = {
  name: '{{ appName }}',
  version: '{{ version | default: "1.0.0" }}',

  {% case environment %}
  {% when "production" %}
  apiUrl: 'https://api.{{ appName | kebabCase }}.com',
  debug: false,
  {% when "staging" %}
  apiUrl: 'https://staging-api.{{ appName | kebabCase }}.com',
  debug: true,
  {% else %}
  apiUrl: 'http://localhost:{{ port | default: 3000 }}',
  debug: true,
  {% endcase %}

  features: {
    {% if features.size > 0 %}
    {% for feature in features %}
    {{ feature | camelCase }}: true,
    {% endfor %}
    {% endif %}
  },

  {% if withDatabase %}
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: '{{ appName | kebabCase }}_{{ environment }}',
  },
  {% endif %}
} as const;

export type AppConfig = typeof appConfig;
```

### Example 4: Package.json Template

**Template: package.json.liquid**
```json
{
  "name": "{{ packageName }}",
  "version": "{{ version | default: '0.1.0' }}",
  "description": "{{ description }}",
  "type": "module",
  "scripts": {
    "dev": "{{ devCommand | default: 'vite' }}",
    "build": "{{ buildCommand | default: 'vite build' }}",
    "preview": "{{ previewCommand | default: 'vite preview' }}"{% if withTests %},
    "test": "{{ testCommand | default: 'vitest' }}"{% endif %}{% if withLint %},
    "lint": "{{ lintCommand | default: 'eslint .' }}"{% endif %}
  },
  "dependencies": {
    {% for dep in dependencies %}
    "{{ dep.name }}": "{{ dep.version }}"{% if forloop.last == false %},{% endif %}
    {% endfor %}
  },
  "devDependencies": {
    {% for dep in devDependencies %}
    "{{ dep.name }}": "{{ dep.version }}"{% if forloop.last == false %},{% endif %}
    {% endfor %}
  }
}
```

---

## Summary

Key takeaways for creating effective templates:

1. **Use `.liquid` extension** for files needing variable replacement
2. **Leverage filters** for consistent casing and transformations
3. **Use conditional includes** for optional features
4. **Provide comprehensive variable schemas** with examples
5. **Document complex templates** with instruction field
6. **Test with various variable combinations** to ensure robustness
7. **Follow naming conventions** for consistency
8. **Organize template files** to mirror output structure
9. **Use comments** to explain complex logic
10. **Validate inputs** with JSON Schema patterns

For advanced scaffolding scenarios requiring custom logic, see [Advanced Generators Guide](./advanced-generators.md).
