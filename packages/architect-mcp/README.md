# @agiflowai/architect-mcp

A Model Context Protocol (MCP) server for software architecture design, code quality enforcement, and design pattern guidance. Supports multiple transport modes: **stdio**, **HTTP**, **SSE**, and **CLI**.

## Features

- **Design pattern guidance**: Get design patterns and coding standards for specific files
- **Code review**: Review code against template-specific rules (RULES.yaml)
- **Rule management**: Add and manage coding rules for templates
- **Pattern management**: Add and manage design patterns (architect.yaml)
- **Template-aware**: Automatically detects project templates and applies relevant patterns
- **LLM-powered analysis**: Optional integration with Claude Code CLI for AI-assisted reviews
- **Multiple modes**: MCP server mode (stdio) and standalone CLI mode
- **MCP integration**: Seamlessly works with Claude Desktop and other MCP-compatible clients

## Installation

```bash
pnpm install @agiflowai/architect-mcp
```

## Usage

### 1. MCP Server

Run architect-mcp as an MCP server to integrate with Claude Desktop or other MCP clients.

#### Starting the Server

```bash
# stdio transport (default) - for Claude Desktop
npx @agiflowai/architect-mcp mcp-serve

# HTTP transport - for web applications
npx @agiflowai/architect-mcp mcp-serve --type http --port 3000

# SSE transport - for legacy clients
npx @agiflowai/architect-mcp mcp-serve --type sse --port 3000

# Enable admin mode (add_design_pattern, add_rule tools)
npx @agiflowai/architect-mcp mcp-serve --admin-enable

# Enable LLM-powered design pattern analysis
npx @agiflowai/architect-mcp mcp-serve --design-pattern-tool claude-code

# Enable LLM-powered code review
npx @agiflowai/architect-mcp mcp-serve --review-tool claude-code

# Enable all features with HTTP transport
npx @agiflowai/architect-mcp mcp-serve --type http --port 3000 --admin-enable --design-pattern-tool claude-code --review-tool claude-code
```

**Server Options:**
- `-t, --type <type>`: Transport type: `stdio`, `http`, or `sse` (default: `stdio`)
- `-p, --port <port>`: Port for HTTP/SSE servers (default: `3000`)
- `--host <host>`: Host to bind to for HTTP/SSE (default: `localhost`)
- `--design-pattern-tool <tool>`: LLM tool for design pattern analysis (currently only `claude-code` is supported)
- `--review-tool <tool>`: LLM tool for code review (currently only `claude-code` is supported)
- `--admin-enable`: Enable admin tools for pattern and rule management

**Note about LLM tools:**
- When LLM tools are **not enabled**, the server returns design patterns and rules for the AI agent to analyze itself
- When LLM tools are **enabled** (e.g., `--review-tool claude-code`), the server uses Claude Code CLI to perform the analysis
- This allows flexibility: let the AI agent do its own analysis, or use specialized LLM tools for deeper insights

#### Claude Desktop Configuration

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "architect-mcp": {
      "command": "npx",
      "args": ["-y", "@agiflowai/architect-mcp", "mcp-serve"]
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "architect-mcp": {
      "command": "architect-mcp",
      "args": ["mcp-serve"]
    }
  }
}
```

**To enable admin tools** (for pattern/rule creation), add the `--admin-enable` flag:

```json
{
  "mcpServers": {
    "architect-mcp": {
      "command": "npx",
      "args": ["-y", "@agiflowai/architect-mcp", "mcp-serve", "--admin-enable"]
    }
  }
}
```

**To enable LLM-powered analysis:**

```json
{
  "mcpServers": {
    "architect-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "@agiflowai/architect-mcp",
        "mcp-serve",
        "--design-pattern-tool",
        "claude-code",
        "--review-tool",
        "claude-code"
      ]
    }
  }
}
```

#### Available MCP Tools

**Standard Tools** (always available):

1. **get_file_design_pattern**: Get design patterns and coding standards for a file
   - Arguments:
     - `file_path` (string): Path to the file to analyze
   - Returns: Project info, matched design patterns, and applicable coding rules

2. **review_code_change**: Review code changes against template rules
   - Arguments:
     - `file_path` (string): Path to the file to review
   - Returns: Code review feedback with severity rating and identified violations

**Admin Tools** (enabled with `--admin-enable` flag):

3. **add_design_pattern**: Add a new design pattern to architect.yaml
   - Arguments:
     - `template_name` (string, optional): Template name (omit for global patterns)
     - `is_global` (boolean): Add to global architect.yaml
     - `name` (string): Feature name
     - `design_pattern` (string): Design pattern name
     - `description` (string): Description
     - `includes` (array): File patterns this design applies to

4. **add_rule**: Add a new coding rule to RULES.yaml
   - Arguments:
     - `template_name` (string, optional): Template name (omit for global rules)
     - `is_global` (boolean): Add to global RULES.yaml
     - `pattern` (string): Pattern identifier
     - `description` (string): Rule description
     - `inherits` (array, optional): Inherited patterns
     - `must_do` (array, optional): Required rules
     - `should_do` (array, optional): Recommended rules
     - `must_not_do` (array, optional): Prohibited patterns

### 2. CLI Commands

Use architect-mcp as a standalone CLI tool for design pattern analysis and code review.

#### Design Pattern Commands

```bash
# Get design patterns for a file
architect-mcp get-file-design-pattern <file-path>

# Get patterns with verbose output
architect-mcp get-file-design-pattern src/services/UserService.ts --verbose

# Get patterns as JSON
architect-mcp get-file-design-pattern src/services/UserService.ts --json
```

#### Code Review Commands

```bash
# Review code changes against rules
architect-mcp review-code-change <file-path>

# Review with verbose output
architect-mcp review-code-change src/services/UserService.ts --verbose

# Review with specific LLM tool
architect-mcp review-code-change src/services/UserService.ts --llm-tool claude-code

# Output as JSON
architect-mcp review-code-change src/services/UserService.ts --json
```

#### Pattern Management Commands

```bash
# Add a new design pattern
architect-mcp add-pattern <name> <design-pattern> <description> \
  --template-name typescript-mcp-package \
  --includes "src/services/**/*.ts"

# Add a global design pattern
architect-mcp add-pattern service-layer "Service Layer Pattern" \
  "Business logic in service classes" \
  --global \
  --includes "src/services/**/*.ts,packages/*/src/services/**/*.ts"
```

#### Rule Management Commands

```bash
# Add a new coding rule
architect-mcp add-rule <pattern> <description> \
  --template-name typescript-mcp-package \
  --must-do "Use async/await for asynchronous operations" \
  --must-not-do "Never use callbacks"

# Add a global coding rule
architect-mcp add-rule error-handling "Error handling standards" \
  --global \
  --must-do "Always use try-catch blocks" \
  --must-not-do "Never use empty catch blocks"

# Add rule with inheritance
architect-mcp add-rule my-pattern "My custom pattern" \
  --inherits "export-standards,type-safety" \
  --must-do "Follow parent rules"
```

#### Environment Variables

- `MCP_PORT`: Port number for HTTP/SSE servers (default: 3000)
- `MCP_HOST`: Host for HTTP/SSE servers (default: localhost)

## Quick Start

### 1. Get Design Patterns for a File

```bash
# Analyze a file to see what design patterns apply
architect-mcp get-file-design-pattern packages/my-app/src/services/UserService.ts
```

This returns:
- Project information (name, template)
- Matched design patterns from architect.yaml
- Applicable coding rules from RULES.yaml with examples

### 2. Review Code Changes

```bash
# Review a file against coding standards
architect-mcp review-code-change packages/my-app/src/services/UserService.ts
```

This checks:
- Must not do violations (critical issues)
- Must do missing (required patterns not followed)
- Should do suggestions (best practices)

### 3. Add Custom Rules

```bash
# Add a new rule to your template
architect-mcp add-rule api-standards "API endpoint standards" \
  --template-name my-template \
  --must-do "Use RESTful naming conventions" \
  --must-do "Include OpenAPI documentation" \
  --must-not-do "Never expose internal IDs"
```

## Template Structure

architect-mcp works with templates that have:

1. **architect.yaml** - Design patterns and file organization
   ```yaml
   features:
     - name: Service Layer
       design_pattern: Service classes with dependency injection
       includes:
         - src/services/**/*.ts
       description: Business logic in service classes
   ```

2. **RULES.yaml** - Coding standards and rules
   ```yaml
   version: "1.0"
   template: my-template
   rules:
     - pattern: src/services/**/*.ts
       description: Service implementation standards
       must_do:
         - rule: Use dependency injection
         - rule: Return typed results
       must_not_do:
         - rule: Never use static-only utility classes
   ```

## How It Works

1. **Project Detection**: Finds the project containing the file using project.json
2. **Template Resolution**: Identifies the source template from project configuration
3. **Pattern Matching**: Matches file path against patterns in architect.yaml and RULES.yaml
4. **Rule Inheritance**: Resolves inherited rules from global and template-specific configs
5. **Analysis**: Returns patterns and rules, or performs LLM-based analysis if enabled

## Documentation

For detailed information about the architecture and design philosophy:

- **[Design Pattern Overview](./docs/design-pattern-overview.md)**: High-level explanation of the design pattern system, architectural philosophy, and core principles
- **[Rules Overview](./docs/rules-overview.md)**: Detailed guide to the coding rules system (RULES.yaml), rule inheritance, and code review workflow

## License

AGPL-3.0
