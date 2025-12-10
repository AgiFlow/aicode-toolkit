# style-system-mcp

MCP server for design system operations. Provides tools to explore themes, extract CSS classes, list UI components, and render component previews from Storybook stories.

---

## Quick Start

**Requirements:** Node.js >= 18, MCP-compatible agent (Claude Code, Cursor, Gemini CLI)

### Configure MCP

**Claude Code** (`.mcp.json`):

```json
{
  "mcpServers": {
    "style-system": {
      "command": "npx",
      "args": ["-y", "@agiflowai/style-system", "mcp-serve"]
    }
  }
}
```

**Cursor**: Same config in `.cursor/mcp.json`

---

## Tools

| Tool | Description |
|------|-------------|
| `list_themes` | List available theme configurations from CSS files |
| `get_css_classes` | Extract supported Tailwind CSS classes from theme |
| `list_shared_components` | List shared UI components from design system |
| `list_app_components` | List app-specific and package components |
| `get_component_visual` | Render component preview screenshot from Storybook |

---

## Workflow

### Before Writing Styles

```
User: "Style this button component"

Agent:
1. get_css_classes → gets available Tailwind classes
2. Writes styles using only supported classes
```

### Finding Components

```
User: "What UI components are available?"

Agent:
1. list_shared_components tags:["ui"]
2. Returns: Button, Card, Modal, etc. with file paths
```

### Previewing Components

```
User: "Show me the Button component"

Agent:
1. get_component_visual componentName:"Button" appPath:"apps/web"
2. Returns: Screenshot + story code for review
```

---

## Configuration

### Monorepo (project.json)

Add `style-system` config to each app's `project.json`:

```json
{
  "name": "my-app",
  "sourceRoot": "apps/my-app/src",
  "style-system": {
    "type": "tailwind",
    "themeProvider": "@your-org/web-ui",
    "themePath": "packages/web-theme/src/theme.css",
    "cssFiles": ["src/styles/globals.css"],
    "rootComponent": "src/providers/ThemeProvider.tsx",
    "sharedComponentTags": ["ui", "primitives"]
  }
}
```

### Monolith (toolkit.yaml)

For single-project setups, add to `toolkit.yaml`:

```yaml
version: "1.0"
projectType: monolith
sourceTemplate: nextjs-15
style-system:
  type: tailwind
  themeProvider: "@your-org/web-ui"
  themePath: "src/styles/theme.css"
  cssFiles:
    - "src/styles/globals.css"
  rootComponent: "src/providers/ThemeProvider.tsx"
  sharedComponentTags:
    - "ui"
    - "primitives"
```

### Configuration Options

| Option | Required | Description |
|--------|----------|-------------|
| `type` | Yes | Design system type: `tailwind` or `shadcn` |
| `themeProvider` | Yes | Package or path to theme provider component |
| `themePath` | No | Path to theme CSS file for class extraction |
| `cssFiles` | No | Additional CSS files to import for rendering |
| `rootComponent` | No | Wrapper component for rendered previews |
| `tailwindConfig` | No | Path to tailwind.config.js (if non-standard) |
| `sharedComponentTags` | No | Storybook tags for shared components (default: `['style-system']`) |
| `componentLibrary` | No | Component library path (for shadcn type) |

---

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Test
pnpm test

# Type check
pnpm typecheck
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Your AI Agent                           │
│         (Claude Code, Cursor, Gemini CLI, etc.)             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ style-system-mcp│
                    │                 │
                    │ • Theme listing │
                    │ • CSS extraction│
                    │ • Component list│
                    │ • Visual preview│
                    └─────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌───────────┐   ┌───────────┐   ┌───────────┐
       │ Theme CSS │   │ Storybook │   │ project.  │
       │ files     │   │ stories   │   │ json      │
       └───────────┘   └───────────┘   └───────────┘
```

---

## License

[AGPL-3.0](../../LICENSE)
