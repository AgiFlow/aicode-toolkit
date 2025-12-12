/**
 * Front Matter Parser Utility
 *
 * Parses YAML front matter from prompt content.
 * Front matter is a block of YAML at the beginning of a file,
 * delimited by `---` on its own lines.
 *
 * DESIGN PATTERNS:
 * - Pure function pattern for parsing
 * - Single responsibility principle
 *
 * CODING STANDARDS:
 * - Return typed result with both metadata and content
 * - Handle edge cases gracefully (no front matter, malformed YAML)
 *
 * AVOID:
 * - Throwing errors for missing front matter (it's optional)
 * - Using external YAML parsing libraries (keep it simple)
 */

/**
 * Parsed skill front matter fields
 * @property name - The skill name
 * @property description - The skill description
 */
export interface SkillFrontMatter {
  name: string;
  description: string;
}

/**
 * Result of parsing front matter from content
 * @property frontMatter - The parsed front matter object, or null if none found
 * @property content - The content with front matter removed
 */
export interface ParseFrontMatterResult {
  frontMatter: Record<string, string> | null;
  content: string;
}

/**
 * Parses YAML front matter from a string content.
 * Front matter must be at the start of the content, delimited by `---`.
 *
 * Supports:
 * - Simple key: value pairs
 * - Literal block scalar (|) for multi-line preserving newlines
 * - Folded block scalar (>) for multi-line folding to single line
 *
 * @param content - The content string that may contain front matter
 * @returns Object with parsed front matter (or null) and remaining content
 *
 * @example
 * const result = parseFrontMatter(`---
 * name: my-skill
 * description: A skill description
 * ---
 * The actual content here`);
 * // result.frontMatter = { name: 'my-skill', description: 'A skill description' }
 * // result.content = 'The actual content here'
 *
 * @example
 * // Multi-line with literal block scalar
 * const result = parseFrontMatter(`---
 * name: my-skill
 * description: |
 *   Line 1
 *   Line 2
 * ---
 * Content`);
 * // result.frontMatter.description = 'Line 1\nLine 2'
 */
export function parseFrontMatter(content: string): ParseFrontMatterResult {
  // Check if content starts with front matter delimiter
  const trimmedContent = content.trimStart();
  if (!trimmedContent.startsWith('---')) {
    return { frontMatter: null, content };
  }

  // Find the closing delimiter
  const endDelimiterIndex = trimmedContent.indexOf('\n---', 3);
  if (endDelimiterIndex === -1) {
    // No closing delimiter found
    return { frontMatter: null, content };
  }

  // Extract the YAML content between delimiters
  const yamlContent = trimmedContent.slice(4, endDelimiterIndex).trim();
  if (!yamlContent) {
    return { frontMatter: null, content };
  }

  // Parse YAML with support for multi-line values
  const frontMatter: Record<string, string> = {};
  const lines = yamlContent.split('\n');

  let currentKey: string | null = null;
  let currentValue: string[] = [];
  let multiLineMode: 'literal' | 'folded' | null = null;
  let baseIndent = 0;

  const saveCurrentKey = () => {
    if (currentKey && currentValue.length > 0) {
      if (multiLineMode === 'literal') {
        // Literal block: preserve newlines
        frontMatter[currentKey] = currentValue.join('\n').trimEnd();
      } else if (multiLineMode === 'folded') {
        // Folded block: join with spaces
        frontMatter[currentKey] = currentValue.join(' ').trim();
      } else {
        frontMatter[currentKey] = currentValue.join('').trim();
      }
    }
    currentKey = null;
    currentValue = [];
    multiLineMode = null;
    baseIndent = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Check if this is a new key (starts at column 0, has colon)
    const colonIndex = line.indexOf(':');
    const isNewKey = colonIndex !== -1 && !line.startsWith(' ') && !line.startsWith('\t');

    if (isNewKey) {
      // Save previous key if any
      saveCurrentKey();

      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();

      // Check for multi-line indicators
      if (value === '|' || value === '|-') {
        currentKey = key;
        multiLineMode = 'literal';
        // Determine base indent from next line
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          const match = nextLine.match(/^(\s+)/);
          baseIndent = match ? match[1].length : 2;
        }
      } else if (value === '>' || value === '>-') {
        currentKey = key;
        multiLineMode = 'folded';
        // Determine base indent from next line
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          const match = nextLine.match(/^(\s+)/);
          baseIndent = match ? match[1].length : 2;
        }
      } else {
        // Simple single-line value
        // Remove surrounding quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (key && value) {
          frontMatter[key] = value;
        }
      }
    } else if (multiLineMode && currentKey) {
      // Continuation of multi-line value
      // Check if line is indented (part of multi-line block)
      const lineIndent = line.match(/^(\s*)/)?.[1].length || 0;

      if (lineIndent >= baseIndent || trimmedLine === '') {
        // Remove base indentation
        const unindentedLine = lineIndent >= baseIndent ? line.slice(baseIndent) : trimmedLine;
        currentValue.push(unindentedLine);
      }
    }
  }

  // Save last key
  saveCurrentKey();

  // Extract content after front matter
  const remainingContent = trimmedContent.slice(endDelimiterIndex + 4).trimStart();

  return { frontMatter, content: remainingContent };
}

/**
 * Checks if parsed front matter contains valid skill metadata.
 * A valid skill front matter must have both `name` and `description` fields.
 *
 * @param frontMatter - The parsed front matter object
 * @returns True if front matter contains valid skill metadata
 */
export function isValidSkillFrontMatter(frontMatter: Record<string, string> | null): boolean {
  return (
    frontMatter !== null &&
    typeof frontMatter.name === 'string' &&
    frontMatter.name.length > 0 &&
    typeof frontMatter.description === 'string' &&
    frontMatter.description.length > 0
  );
}

/**
 * Extracts skill front matter from content if present and valid.
 *
 * @param content - The content string that may contain skill front matter
 * @returns Object with skill metadata and content, or null if no valid skill front matter
 */
export function extractSkillFrontMatter(
  content: string
): { skill: SkillFrontMatter; content: string } | null {
  const { frontMatter, content: remainingContent } = parseFrontMatter(content);

  if (frontMatter && isValidSkillFrontMatter(frontMatter)) {
    return {
      skill: {
        name: frontMatter.name,
        description: frontMatter.description,
      },
      content: remainingContent,
    };
  }

  return null;
}
