# @agiflowai/scaffold-mcp

A Model Context Protocol (MCP) server for scaffolding applications with boilerplate templates and feature generators. Supports multiple transport modes: **stdio**, **HTTP**, **SSE**, and **CLI**.

## Features

- **Boilerplate scaffolding**: Generate complete application structures from templates
- **Feature scaffolding**: Add features to existing projects with custom generators
- **Custom generators**: Template-specific TypeScript generators for advanced scaffolding logic
- **Liquid templating**: Use powerful templating engine for dynamic file generation
- **Variable replacement**: Customize generated code with context-aware variable substitution
- **Dynamic template discovery**: Automatically finds templates in your workspace
- **Multiple frameworks**: Support for Next.js, Vite React, and custom boilerplates
- **Multiple modes**: MCP server mode (stdio/HTTP/SSE) and standalone CLI mode
- **MCP integration**: Seamlessly works with Claude Code and other MCP-compatible clients

## Installation

```bash
pnpm install @agiflowai/scaffold-mcp
```

## Usage

### 1. MCP Server

Run scaffold-mcp as an MCP server to integrate with Claude Code or other MCP clients.

#### Starting the Server

```bash
# stdio transport (default) - for Claude Code
npx @agiflowai/scaffold-mcp mcp-serve

# HTTP transport - for web applications
npx @agiflowai/scaffold-mcp mcp-serve --type http --port 3000

# SSE transport - for legacy clients
npx @agiflowai/scaffold-mcp mcp-serve --type sse --port 3000

# Enable admin mode (template generation tools)
npx @agiflowai/scaffold-mcp mcp-serve --admin-enable
```

**Server Options:**
- `-t, --type <type>`: Transport type: `stdio`, `http`, or `sse` (default: `stdio`)
- `-p, --port <port>`: Port for HTTP/SSE servers (default: `3000`)
- `--host <host>`: Host to bind to for HTTP/SSE (default: `localhost`)
- `--admin-enable`: Enable admin tools for template generation

#### Claude Code Configuration

Add to your Claude Code config:

```json
{
  "mcpServers": {
    "scaffold-mcp": {
      "command": "npx",
      "args": ["-y", "@agiflowai/scaffold-mcp", "mcp-serve"]
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "scaffold-mcp": {
      "command": "scaffold-mcp",
      "args": ["mcp-serve"]
    }
  }
}
```

**To enable admin tools** (for template creation), add the `--admin-enable` flag:

```json
{
  "mcpServers": {
    "scaffold-mcp": {
      "command": "npx",
      "args": ["-y", "@agiflowai/scaffold-mcp", "mcp-serve", "--admin-enable"]
    }
  }
}
```

### Hooks Integration (Experimental)

> **Experimental:** Hooks integration is currently experimental and the API may change in future releases.

scaffold-mcp integrates with AI coding agents' hook systems to provide proactive scaffolding guidance when creating new files.

**Quick setup for Claude Code** (`.claude/settings.json`):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "npx @agiflowai/scaffold-mcp hook --type claude-code.preToolUse"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "mcp__one-mcp__use_tool",
        "hooks": [
          {
            "type": "command",
            "command": "npx @agiflowai/scaffold-mcp hook --type claude-code.postToolUse"
          }
        ]
      }
    ]
  }
}
```

For detailed configuration, supported agents, and troubleshooting, see **[Hooks Documentation](./docs/hooks.md)**.

#### Available MCP Tools

**Standard Tools** (always available):

1. **list-boilerplates**: List all available project boilerplates
   - Returns: Array of boilerplate configurations with schemas

2. **use-boilerplate**: Create a new project from a boilerplate template
   - Arguments:
     - `boilerplateName` (string): Name of the boilerplate
     - `variables` (object): Variables matching the boilerplate's schema

3. **list-scaffolding-methods**: List available features for a project
   - Arguments:
     - `projectPath` (string): Absolute path to project directory

4. **use-scaffold-method**: Add a feature to an existing project
   - Arguments:
     - `projectPath` (string): Absolute path to project directory
     - `scaffold_feature_name` (string): Name of the feature to add
     - `variables` (object): Variables for the feature

5. **write-to-file**: Write content to a file
   - Arguments:
     - `file_path` (string): Path to the file
     - `content` (string): Content to write

**Admin Tools** (enabled with `--admin-enable` flag):

6. **generate-boilerplate**: Create a new boilerplate configuration in a template's scaffold.yaml
   - Arguments:
     - `templateName` (string): Name of the template folder
     - `boilerplateName` (string): Name of the boilerplate (kebab-case)
     - `description` (string): Detailed description
     - `targetFolder` (string): Target folder for projects
     - `variables` (array): Variable definitions with schema
     - `includes` (array): Template files to include
     - `instruction` (string, optional): Usage instructions

7. **generate-feature-scaffold**: Create a new feature configuration in a template's scaffold.yaml
   - Arguments:
     - `templateName` (string): Name of the template folder
     - `featureName` (string): Name of the feature (kebab-case)
     - `description` (string): Feature description
     - `variables` (array): Variable definitions with schema
     - `includes` (array, optional): Template files to include
     - `patterns` (array, optional): File patterns this feature works with
     - `instruction` (string, optional): Usage instructions

8. **generate-boilerplate-file**: Create template files for boilerplates or features
   - Arguments:
     - `templateName` (string): Name of the template folder
     - `filePath` (string): Path of the file within the template
     - `content` (string): File content with Liquid variables
     - `header` (string, optional): Header comment for AI hints
     - `sourceFile` (string, optional): Copy from existing source file

### 2. CLI Commands

Use scaffold-mcp as a standalone CLI tool for scaffolding projects and adding features.

**Note:** Template management (init, add) is now handled by the `@agiflowai/aicode-toolkit` CLI. See [aicode-toolkit documentation](../../apps/aicode-toolkit/README.md) for details.

#### Boilerplate Commands

```bash
# List available boilerplates
scaffold-mcp boilerplate list

# Show boilerplate details
scaffold-mcp boilerplate info <boilerplate-name>

# Create project from boilerplate
scaffold-mcp boilerplate create <name> --vars '{"appName":"my-app"}'
scaffold-mcp boilerplate create nextjs-15-boilerplate \
  --vars '{"projectName":"my-app","packageName":"@myorg/my-app"}' \
  --verbose
```

#### Scaffold Commands

```bash
# List scaffolding methods for a project
scaffold-mcp scaffold list ./apps/my-app

# Show scaffold method details
scaffold-mcp scaffold info <feature-name> --project ./apps/my-app

# Add feature to project
scaffold-mcp scaffold add <feature> --project ./apps/my-app --vars '{"name":"MyFeature"}'
scaffold-mcp scaffold add scaffold-nextjs-page \
  --project ./apps/my-app \
  --vars '{"pageTitle":"About Us","nextjsPagePath":"/about"}' \
  --verbose
```

#### Environment Variables

- `MCP_PORT`: Port number for HTTP/SSE servers (default: 3000)
- `MCP_HOST`: Host for HTTP/SSE servers (default: localhost)

## Quick Start

### 1. Setup Templates

For template management (downloading and managing templates), use the `@agiflowai/aicode-toolkit` CLI:

```bash
# Initialize workspace and download templates
npx @agiflowai/aicode-toolkit init

# Add custom templates
npx @agiflowai/aicode-toolkit add --name my-template --url https://github.com/user/template
```

See the [aicode-toolkit documentation](../../apps/aicode-toolkit/README.md) for complete setup instructions.

### 2. Create a New Project

```bash
# List available boilerplates
scaffold-mcp boilerplate list

# Get info about a specific boilerplate
scaffold-mcp boilerplate info nextjs-15-boilerplate

# Create a new Next.js 15 project
scaffold-mcp boilerplate create nextjs-15-boilerplate \
  --vars '{"projectName":"my-app","packageName":"@myorg/my-app","appName":"My App"}'
```

### 3. Add Features to Existing Projects

```bash
# List available features for your project
scaffold-mcp scaffold list /path/to/your/project

# Get info about a specific scaffold method
scaffold-mcp scaffold info scaffold-nextjs-page --project /path/to/your/project

# Add a new Next.js page
scaffold-mcp scaffold add scaffold-nextjs-page \
  --project /path/to/your/project \
  --vars '{"pageTitle":"About Us","pageDescription":"Learn more","nextjsPagePath":"/about"}'
```

## Documentation

- [CLI Commands](./docs/cli-commands.md) - Complete CLI reference
- [MCP Tools](./docs/mcp-tools.md) - MCP server tools reference
- [Template Conventions](./docs/template-conventions.md) - Guide for creating templates with Liquid syntax
- [Advanced Generators](./docs/advanced-generators.md) - Guide for creating custom TypeScript generators
- [Hooks Integration](./docs/hooks.md) - Guide to integrating scaffold-mcp with AI coding agents via hooks (experimental)

## License

AGPL-3.0
