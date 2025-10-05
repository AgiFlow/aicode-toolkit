import type { PromptDefinition, PromptMessage } from './types';

/**
 * Prompt for generating boilerplates
 */
export class GenerateBoilerplatePrompt {
  static readonly PROMPT_NAME = 'generate-boilerplate';

  /**
   * Get the prompt definition for MCP
   */
  getDefinition(): PromptDefinition {
    return {
      name: GenerateBoilerplatePrompt.PROMPT_NAME,
      description: 'Generate a new boilerplate template configuration',
      arguments: [
        {
          name: 'request',
          description: 'Describe the boilerplate template you want to create',
          required: false,
        },
      ],
    };
  }

  /**
   * Get the prompt messages
   */
  getMessages(args?: { request?: string }): PromptMessage[] {
    const userRequest = args?.request || '';

    return [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `You are helping create a new boilerplate template configuration using the scaffold-mcp MCP tools.

${userRequest ? `User request: ${userRequest}\n` : ''}
Your task:

1. **Gather Information**: Ask for any missing details:
   - Framework/technology (e.g., "React Vite", "Express API", "Next.js 15")
   - Template name (kebab-case, e.g., "react-vite", "nextjs-15")
   - Boilerplate name (prefixed with "scaffold-", e.g., "scaffold-vite-app")
   - Target folder (e.g., "apps", "packages")
   - Project type (app, library, service, etc.)
   - Required variables (at minimum: appName or packageName)
   - Files to include in the template

2. **Use MCP Tools** in order:
   - \`generate-boilerplate\` - Creates the boilerplate configuration
   - \`generate-boilerplate-file\` - Creates each template file
   - \`list-boilerplates\` - Verify it appears
   - \`use-boilerplate\` - Test the boilerplate

Important:
- Template naming: Use kebab-case (e.g., "react-vite", "express-api")
- Boilerplate naming: Prefix with "scaffold-" (e.g., "scaffold-vite-app")
- Target folder: "apps" for applications, "packages" for libraries
- Include files explicitly - avoid wildcards
- Template syntax: use {{ variableName }}

**Description Field Guidelines (CRITICAL)**:
The description should be a comprehensive multi-paragraph overview (3-5 sentences):
- Paragraph 1: Core technology stack and primary value proposition
- Paragraph 2: Target use cases and ideal project types
- Paragraph 3: Key integrations or special features (if applicable)

Example:
"A modern React SPA template powered by Vite for lightning-fast HMR, featuring TanStack Router for type-safe routing and TanStack Query for server state management.
Perfect for building data-driven dashboards, admin panels, and interactive web applications requiring client-side routing and real-time data synchronization.

Includes Agiflow Config Management System integration with systematic environment variable naming (VITE_{CATEGORY}_{SUBCATEGORY}_{PROPERTY}) and auto-generated configuration templates for cloud deployment."

**Instruction Field Guidelines (CRITICAL)**:
The instruction should be a detailed multi-section guide that helps AI understand the codebase:

1. **File purposes** section: List each major file/directory with its purpose
   Format: "- path/to/file: Description of what this file does"

2. **How to use the scaffolded code** section: Step-by-step workflows
   Format: Numbered list with specific examples
   - How to add routes/pages
   - How to fetch data
   - How to handle authentication
   - How to configure environment variables

3. **Design patterns to follow** section: Key architectural decisions
   Format: "- Pattern Name: Explanation and when to use it"
   - Routing patterns
   - State management patterns
   - Data fetching patterns
   - Error handling patterns
   - Performance optimization patterns

Example structure:
"[Framework] application template with [key technologies].

File purposes:
- package.json: NPM package configuration with [framework] and dependencies
- src/main.tsx: Application entry point with [setup details]
- src/routes/: Route definitions following [pattern]
[... list all major files ...]

How to use the scaffolded code:
1. Routes: Create new routes by [specific instructions with example]
2. Data Fetching: Use [specific pattern] for [use case]
3. Authentication: Use [specific components/modules] for user management
[... numbered steps for common tasks ...]

Design patterns to follow:
- File-based Routing: Use directory structure in src/routes/ to define URL paths
- Type-safe Routes: Leverage [framework] type inference for params
- State Management: Use [library] for server state, [library] for client state
[... list key patterns with explanations ...]"

Template File Content Guidelines:
- Keep content MINIMAL and business-agnostic
- Focus on structure and patterns, not business logic
- Use placeholder/generic examples only
- Include essential boilerplate code only
- Let AI fill in specific logic later
- Add clear headers with design patterns and coding standards`,
        },
      },
    ];
  }
}
