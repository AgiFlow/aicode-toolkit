# @agiflowai/style-system

> MCP server for enforcing brand consistency and style guide compliance

Help AI coding agents follow your company's branding and style guide. style-system ensures AI-generated code uses only approved design tokens, existing components, and adheres to your visual standards.

## Why Use This?

When AI agents write frontend code, they don't know your brand guidelines:
- What colors, spacing, and typography are approved?
- What UI components already exist in your design system?
- Does the output match your brand's visual identity?

style-system solves this by:

1. **Enforcing brand tokens** - Agent uses only approved colors, spacing, and typography from your theme
2. **Preventing design drift** - Agent discovers existing components instead of creating inconsistent duplicates
3. **Visual verification** - Agent can preview components to ensure brand alignment

---

## Quick Start

### 1. Requirements

- Node.js >= 18
- MCP-compatible agent (Claude Code, Cursor, Gemini CLI)
- Chrome browser (recommended) OR Playwright browsers for `get_component_visual` tool

### 2. Configure Your AI Agent

Add to your MCP config (`.mcp.json`, `.cursor/mcp.json`, etc.):

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

### 3. Start Using

Your AI agent now enforces your brand guidelines:

```
You: "Style this button component"

Agent:
1. Calls get_css_classes to get your approved design tokens
2. Writes styles using only brand-approved colors, spacing, typography
3. Output is consistent with your style guide
```

---

## Available Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `list_themes` | List available brand themes | Understanding brand variations |
| `get_css_classes` | Extract approved design tokens from theme | Before writing any styles |
| `list_shared_components` | List brand-approved UI components | Before creating new components |
| `list_app_components` | List app-specific components | Finding existing branded components |
| `get_component_visual` | Render component preview screenshot | Verifying brand alignment |

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                     Your AI Agent                           │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
  │ Before       │    │ Before       │    │ Verifying    │
  │ Styling      │    │ Creating     │    │ Brand        │
  │              │    │ Components   │    │ Alignment    │
  │ get_css_     │    │ list_shared_ │    │ get_         │
  │ classes      │    │ components   │    │ component_   │
  │              │    │              │    │ visual       │
  └──────────────┘    └──────────────┘    └──────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
  │ Brand Tokens │    │ Component    │    │ Visual       │
  │              │    │ Library      │    │ Preview      │
  │              │    │              │    │              │
  │ • Colors     │    │ • Buttons    │    │ • Screenshot │
  │ • Spacing    │    │ • Forms      │    │ • Brand      │
  │ • Typography │    │ • Layout     │    │   check      │
  └──────────────┘    └──────────────┘    └──────────────┘
```

### Workflow Examples

**Enforcing Brand Tokens:**
```
User: "Add hover styles to the card"

Agent:
1. get_css_classes → extracts approved design tokens
2. Sees brand colors: hover:bg-primary, hover:bg-secondary
3. Applies only brand-approved styles
```

**Reusing Brand Components:**
```
User: "I need a modal dialog"

Agent:
1. list_shared_components tags:["ui"]
2. Finds: Dialog component at packages/ui/src/Dialog.tsx
3. Uses existing branded component instead of creating off-brand duplicate
```

**Verifying Brand Alignment:**
```
User: "Show me the Button variants"

Agent:
1. get_component_visual componentName:"Button" appPath:"apps/web"
2. Returns: Screenshot showing branded button variants
3. Agent verifies output matches brand guidelines
```

---

## Configuration

Add `style-system` config to your app's `project.json`:

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

| Setup | project.json Location |
|-------|----------------------|
| Monorepo | `apps/my-app/project.json` |
| Monolith | `./project.json` (project root) |

### Workspace Defaults (toolkit.yaml)

Configure workspace-level defaults and custom service overrides in `toolkit.yaml`:

```yaml
style-system:
  # Default tags for list_shared_components tool
  sharedComponentTags:
    - "ui"
    - "primitives"

  # Custom service for get_css_classes tool (optional)
  getCssClasses:
    customService: ./my-custom-css-service.ts

  # Custom bundler service for component rendering (optional)
  bundler:
    customService: ./my-custom-bundler.ts
```

| Option | Description |
|--------|-------------|
| `sharedComponentTags` | Default tags for `list_shared_components` tool |
| `getCssClasses.customService` | Path to custom CSS extraction service (extends `BaseCSSClassesService`) |
| `bundler.customService` | Path to custom bundler service (extends `BaseBundlerService`) |

### Configuration Options

| Option | Required | Description |
|--------|----------|-------------|
| `type` | Yes | Style system type: `tailwind` or `shadcn` |
| `themeProvider` | Yes | Package or path providing brand theme |
| `themePath` | No | Path to brand token CSS file |
| `cssFiles` | No | Additional brand CSS files for rendering |
| `rootComponent` | No | Wrapper component for branded previews |
| `tailwindConfig` | No | Path to tailwind.config.js (if non-standard) |
| `sharedComponentTags` | No | Storybook tags for brand components (default: `['style-system']`) |
| `componentLibrary` | No | Component library path (for shadcn type) |

---

## Browser Requirements

The `get_component_visual` tool requires a browser to render and capture component screenshots. The tool automatically detects available browsers in this order:

1. **System Chrome** (recommended) - Uses your installed Chrome browser
2. **Playwright Chromium** - Playwright's bundled Chromium
3. **Playwright Firefox** - Playwright's bundled Firefox

If no browser is found, you'll see an error with installation instructions:

```bash
# Install Playwright browsers (if Chrome is not available)
npx playwright install chromium
```

---

## Custom CSS Classes Service

For custom CSS extraction logic, extend `BaseCSSClassesService`:

```typescript
// my-custom-css-service.ts
import { BaseCSSClassesService } from '@agiflowai/style-system';

export default class MyCustomCSSService extends BaseCSSClassesService {
  getFrameworkId(): string { return 'my-framework'; }

  // Key method to override:
  async extractClasses(category, themePath) {
    // Parse your CSS/theme file and return classes by category
    return {
      colors: [{ name: 'primary', value: '#007bff' }],
      typography: [],
      spacing: [],
      effects: [],
    };
  }
}
```

Configure in `toolkit.yaml`:

```yaml
style-system:
  getCssClasses:
    customService: packages/my-app/src/my-custom-css-service.ts
```

---

## Custom Bundler Service

For advanced use cases, extend `BaseBundlerService` to customize component rendering:

```typescript
// my-custom-bundler.ts
import { BaseBundlerService } from '@agiflowai/style-system';

export default class MyCustomBundlerService extends BaseBundlerService {
  // Key methods to override:
  async startDevServer(appPath: string) { /* Start dev server */ }
  async serveComponent(options) { /* Serve component via dev server */ }
  async prerenderComponent(options) { /* Build static HTML */ }
  async cleanup() { /* Cleanup resources */ }
}
```

Configure in `toolkit.yaml`:

```yaml
style-system:
  bundler:
    customService: packages/my-app/src/my-custom-bundler.ts
```

---

## Server Options

```bash
# stdio transport (default)
npx @agiflowai/style-system mcp-serve

# HTTP transport
npx @agiflowai/style-system mcp-serve --type http --port 3000

# SSE transport
npx @agiflowai/style-system mcp-serve --type sse --port 3000
```

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --type` | Transport: `stdio`, `http`, `sse` | `stdio` |
| `-p, --port` | Port for HTTP/SSE | `3000` |

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

## License

[AGPL-3.0](../../LICENSE)
