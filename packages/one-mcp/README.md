# @agiflowai/one-mcp

One MCP server package

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
    "@agiflowai/one-mcp": {
      "command": "npx",
      "args": ["@agiflowai/one-mcp", "mcp-serve"]
    }
  }
}
```