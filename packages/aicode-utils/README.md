# @agiflowai/aicode-utils

Shared utilities and types for AI-powered code generation, scaffolding, and template management in monorepo/monolith workspaces.

## What It Does

Core utilities used across the aicode-toolkit ecosystem:
- **Template discovery** - Find templates/ folder by walking up from any directory
- **Workspace detection** - Locate .git root and resolve project structure
- **Config management** - Read/write toolkit.yaml and project.json configurations
- **CLI output** - Themed console utilities with consistent formatting
- **Project resolution** - Find which project owns a given file path

## Installation

```bash
pnpm add @agiflowai/aicode-utils
```

## Quick Start

### 1. Find Templates Directory

```typescript
import { TemplatesManagerService } from '@agiflowai/aicode-utils';

// Searches upward from cwd, checks toolkit.yaml, defaults to templates/
const templatesPath = await TemplatesManagerService.findTemplatesPath();
console.log(templatesPath); // /workspace/templates
```

**Algorithm**:
1. Find workspace root (searches for .git)
2. Check toolkit.yaml for custom templatesPath
3. Falls back to /workspace/templates

### 2. Read Toolkit Configuration

```typescript
const config = await TemplatesManagerService.readToolkitConfig();
console.log(config);
// {
//   version: '1.0',
//   templatesPath: 'templates',
//   projectType: 'monorepo',
//   sourceTemplate: 'nextjs-15'
// }
```

### 3. Pretty CLI Output

```typescript
import { print, messages, sections } from '@agiflowai/aicode-utils';

messages.success('Templates initialized');
print.header('Available Templates');
print.item('nextjs-15');
print.item('typescript-mcp-package');

sections.createdFiles([
  'src/app/page.tsx',
  'src/components/Button.tsx',
]);
```

**Output**:
```
✅ Templates initialized

Available Templates
   - nextjs-15
   - typescript-mcp-package

📁 Created files:
   - src/app/page.tsx
   - src/components/Button.tsx
```

### 4. Find Project Config for File

```typescript
import { ProjectFinderService } from '@agiflowai/aicode-utils';

const finder = new ProjectFinderService('/workspace');
const project = await finder.findProjectForFile('/workspace/apps/web/src/page.tsx');

console.log(project);
// {
//   name: 'web',
//   root: '/workspace/apps/web',
//   sourceTemplate: 'nextjs-15',
//   projectType: 'monorepo'
// }
```

## API Reference

### TemplatesManagerService

Static service for template and workspace management.

#### Find Templates

```typescript
// Async - searches upward from startPath for workspace root + templates
static async findTemplatesPath(startPath?: string): Promise<string>

// Sync version
static findTemplatesPathSync(startPath?: string): string

// Check if templates folder exists
static async isInitialized(templatesPath: string): Promise<boolean>
```

#### Workspace Root

```typescript
// Find workspace root (where .git exists)
static async getWorkspaceRoot(startPath?: string): Promise<string>

// Sync version
static getWorkspaceRootSync(startPath?: string): string
```

#### Toolkit Config (toolkit.yaml)

```typescript
// Read toolkit.yaml from workspace root
static async readToolkitConfig(startPath?: string): Promise<ToolkitConfig | null>

// Sync version
static readToolkitConfigSync(startPath?: string): ToolkitConfig | null

// Write toolkit.yaml to workspace root
static async writeToolkitConfig(config: ToolkitConfig, startPath?: string): Promise<void>
```

**ToolkitConfig interface**:
```typescript
interface ToolkitConfig {
  version?: string;
  templatesPath?: string; // Relative or absolute path
  projectType?: 'monolith' | 'monorepo';
  sourceTemplate?: string; // For monolith projects
}
```

#### Constants

```typescript
static getConfigFileName(): string // Returns 'scaffold.yaml'
static getTemplatesFolderName(): string // Returns 'templates'
```

### ProjectFinderService

Find project configuration by walking up directory tree.

```typescript
constructor(workspaceRoot?: string)

// Find project.json for a given file
async findProjectForFile(filePath: string): Promise<ProjectConfig | null>

// Sync version
findProjectForFileSync(filePath: string): ProjectConfig | null

// Get workspace root
getWorkspaceRoot(): string

// Clear internal cache
clearCache(): void
```

**ProjectConfig interface**:
```typescript
interface ProjectConfig {
  name: string;
  root: string; // Absolute path to project directory
  sourceTemplate?: string;
  projectType?: 'monolith' | 'monorepo';
}
```

**Use case**: Used by MCP servers to determine which template rules apply to a file being edited.

### CLI Output Utilities

#### print - Basic output

```typescript
import { print } from '@agiflowai/aicode-utils';

print.info('Information message');     // Cyan
print.success('Success message');      // Green
print.warning('Warning message');      // Yellow
print.error('Error message');          // Red
print.debug('Debug message');          // Gray
print.header('Section Header');        // Bold cyan
print.item('List item');               // White with "   - " prefix
print.indent('Indented text');         // White with "   " prefix
print.highlight('Important text');     // Bold green
print.newline();                       // Empty line
```

#### messages - Output with icons

```typescript
import { messages } from '@agiflowai/aicode-utils';

messages.info('Info with ℹ️ icon');
messages.success('Success with ✅ icon');
messages.error('Error with ❌ icon');
messages.warning('Warning with ⚠️ icon');
messages.hint('Hint with 💡 icon');
messages.loading('Processing with 🚀 icon');
```

#### sections - Formatted sections

```typescript
import { sections } from '@agiflowai/aicode-utils';

sections.header('Main Title');

sections.list('Available Options', [
  'Option 1',
  'Option 2',
]);

sections.nextSteps([
  'Run pnpm install',
  'Run pnpm dev',
]);

sections.createdFiles([
  'src/app/page.tsx',
  'src/components/Button.tsx',
], 10); // maxShow = 10

sections.warnings([
  'Deprecated API usage',
  'Missing required field',
]);
```

#### icons - Emoji constants

```typescript
import { icons } from '@agiflowai/aicode-utils';

console.log(icons.rocket);    // 🚀
console.log(icons.check);     // ✅
console.log(icons.cross);     // ❌
console.log(icons.warning);   // ⚠️
console.log(icons.package);   // 📦
console.log(icons.folder);    // 📁
console.log(icons.bulb);      // 💡
// ... and more
```

### Constants

```typescript
import { ProjectType, ConfigSource } from '@agiflowai/aicode-utils';

// Project types
ProjectType.MONOLITH  // 'monolith'
ProjectType.MONOREPO  // 'monorepo'

// Config sources
ConfigSource.PROJECT_JSON   // 'project.json'
ConfigSource.TOOLKIT_YAML   // 'toolkit.yaml'
```

## Use Cases

### 1. MCP Server Project Detection

MCP servers use this package to detect which project contains a file being edited:

```typescript
import { ProjectFinderService, TemplatesManagerService } from '@agiflowai/aicode-utils';

const workspaceRoot = await TemplatesManagerService.getWorkspaceRoot();
const finder = new ProjectFinderService(workspaceRoot);

// User editing apps/web/src/components/Button.tsx
const project = await finder.findProjectForFile(
  '/workspace/apps/web/src/components/Button.tsx'
);

if (project?.sourceTemplate === 'nextjs-15') {
  // Apply Next.js 15 specific rules
}
```

### 2. CLI Tool Template Discovery

CLI tools use this to find templates without requiring user configuration:

```typescript
import { TemplatesManagerService } from '@agiflowai/aicode-utils';

// Automatically finds templates even when run from nested directories
const templatesPath = await TemplatesManagerService.findTemplatesPath();
const scaffoldYaml = path.join(templatesPath, 'nextjs-15', 'scaffold.yaml');
```

### 3. Consistent CLI Output

Build polished CLI tools with consistent formatting:

```typescript
import { messages, sections, print } from '@agiflowai/aicode-utils';

messages.loading('Downloading templates...');

sections.header('Setup Complete!');
sections.nextSteps([
  'cd my-project',
  'pnpm install',
  'pnpm dev',
]);

print.highlight('🎉 Ready to code!');
```

### 4. Workspace Configuration Management

Read and write toolkit.yaml for project configuration:

```typescript
import { TemplatesManagerService } from '@agiflowai/aicode-utils';

// Read existing config
const config = await TemplatesManagerService.readToolkitConfig();

// Update config
await TemplatesManagerService.writeToolkitConfig({
  version: '1.0',
  templatesPath: 'custom-templates',
  projectType: 'monorepo',
});
```

## Architecture

**Design patterns**:
- Static service classes for utility functions
- File system traversal with caching
- Upward directory search (finds .git root)
- Consistent error handling with descriptive messages

**Key features**:
- Both async and sync APIs for flexibility
- Caching in ProjectFinderService for performance
- Graceful fallbacks (defaults to cwd if no .git found)
- Type-safe constants with `as const` assertions

**Dependencies**:
- `chalk` - Terminal colors and styling
- `js-yaml` - YAML parsing for toolkit.yaml
- `pino` - Structured logging

## Common Patterns

### Workspace Root Discovery

All services use the same algorithm:
1. Start from provided path (or cwd)
2. Walk up directories looking for .git
3. Return .git parent directory
4. Fallback to cwd if no .git found

### Template Path Resolution

1. Find workspace root
2. Check toolkit.yaml for custom templatesPath
3. Handle absolute or relative paths
4. Fallback to /workspace/templates
5. Throw descriptive error if not found

### Project Config Resolution

1. Start from file path
2. Walk up directories
3. Find first project.json
4. Parse and cache result
5. Return null if none found

## Development

```bash
# Build
pnpm build

# Test
pnpm test

# Type check
pnpm typecheck
```

## Related Packages

- `@agiflowai/aicode-toolkit` - CLI tool using these utilities
- `@agiflowai/architect-mcp` - MCP server using project detection
- `@agiflowai/scaffold-mcp` - MCP server using template discovery

## License

AGPL-3.0

## Links

- [GitHub](https://github.com/AgiFlow/aicode-toolkit)
- [Issues](https://github.com/AgiFlow/aicode-toolkit/issues)
