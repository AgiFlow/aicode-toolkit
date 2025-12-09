# style-system-mcp

MCP server for Agiflow design system, providing tools to explore themes, Tailwind classes, and UI components from Storybook

## Installation

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

## Build

```bash
pnpm build
```

## Test

```bash
pnpm test
```

## Usage with Claude Code

Add to your Claude Code configuration:

```json
{
  "mcpServers": {
    "style-system-mcp": {
      "command": "node",
      "args": ["/path/to/style-system-mcp/dist/index.js"]
    }
  }
}
```