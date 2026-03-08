/**
 * @fileoverview Prompt template for explaining how to use the MCP server.
 * Provides guidance on available tools, resources, and best practices.
 * @module src/mcp-server/prompts/definitions/mcp-server-usage.prompt
 */
import { z } from 'zod';

import type { PromptDefinition } from '../utils/promptDefinition.js';

const PROMPT_NAME = 'base-ui-task';
const PROMPT_DESCRIPTION =
  'Provides comprehensive guidance on how to use this MCP server, including available tools, resources, and usage examples.';

const ArgumentsSchema = z.object({
  focus: z
    .string()
    .optional()
    .describe(
      "The specific area to focus on ('tools' | 'resources' | 'examples' | 'all'). Defaults to 'all'.",
    ),
});

export const baseUiTaskPrompt: PromptDefinition<typeof ArgumentsSchema> = {
  name: PROMPT_NAME,
  description: PROMPT_DESCRIPTION,
  argumentsSchema: ArgumentsSchema,
  generate: (args) => {
    const focus = (args.focus as string) || 'all';

    const toolsSection = `## Available Tools

This MCP server provides the following tools for accessing Base UI documentation:

### 1. base_ui_list_docs
**Purpose**: Fetches the Base UI documentation index (llms.txt) and returns it with URLs replaced by identifiers.

**Usage**:
- No input parameters required
- Returns a markdown-formatted list of all available documentation pages
- Each entry includes a path identifier that can be used with the get-doc tool

**Example**:
\`\`\`
Call: base_ui_list_docs with no parameters
Result: A list of documentation entries like:
- [Accordion](react/components/accordion.md)
- [v1.2.0](react/overview/releases/v1-2-0.md)
- etc.
\`\`\`

### 2. base_ui_get_doc
**Purpose**: Fetches a specific Base UI documentation page by path identifier.

**Usage**:
- **Required parameter**: \`path\` - The documentation path identifier (e.g., "react/overview/releases/v1-2-0.md")
- The path should come from the list-docs tool output
- Returns the full markdown content of the documentation page

**Example**:
\`\`\`
Call: base_ui_get_doc with path: "react/overview/releases/v1-2-0.md"
Result: The complete markdown documentation for the Base UI v1.2.0 release notes
\`\`\`

**Best Practice**: Always use \`base_ui_list_docs\` first to discover available documentation, then use \`base_ui_get_doc\` to fetch specific pages.`;

    const resourcesSection = `## Available Resources

### base-ui-doc Resource
**Purpose**: Provides dynamic access to Base UI documentation pages via resource URIs.

**URI Template**: \`base-ui://{path}\`

**Usage**:
- Access documentation using resource URIs like: \`base-ui://react/components/accordion.md\`
- The path parameter can be provided in the URI or as a separate parameter
- Returns the documentation content as markdown

**Example URIs**:
- \`base-ui://react/components/accordion.md\` - Accordion component documentation
- \`base-ui://react/overview/releases/v1-2-0.md\` - Base UI v1.2.0 release notes

**Resource Discovery**:
- Use the \`list\` operation to discover all available documentation resources
- Each resource includes a name, description, and URI

**Best Practice**: Resources are ideal for direct URI access, while tools provide more structured interaction with validation and error handling.`;

    const examplesSection = `## Usage Examples

### Example 1: Discovering and Reading Documentation

**Step 1**: List all available documentation
\`\`\`
Tool: base_ui_list_docs
\`\`\`

**Step 2**: Choose a specific page and fetch it
\`\`\`
Tool: base_ui_get_doc
Parameters: { "path": "react/overview/releases/v1-2-0.md" }
\`\`\`

### Example 2: Using Resources

**Direct URI Access**:
\`\`\`
Resource: base-ui://react/overview/releases/v1-2-0.md
\`\`\`

**List All Resources**:
\`\`\`
List operation on base-ui-doc resource
Returns: Array of all available documentation resources with URIs
\`\`\`

### Example 3: Complete Workflow

1. **Discovery**: Use \`base_ui_list_docs\` to see what's available
2. **Selection**: Choose a component or topic of interest
3. **Retrieval**: Use \`base_ui_get_doc\` with the path from step 1
4. **Alternative**: Or use the resource URI directly: \`base-ui://{path}\``;

    const bestPracticesSection = `## Best Practices

1. **Start with Discovery**: Always use \`base_ui_list_docs\` first to see what documentation is available
2. **Use Paths from List**: The paths returned by \`base_ui_list_docs\` are guaranteed to work with \`base_ui_get_doc\`
3. **Error Handling**: Both tools validate paths and will return clear error messages for invalid paths
4. **Security**: Path traversal attacks are prevented - only valid relative paths are accepted
5. **Performance**: Resources are cached where possible, but tools always fetch fresh content
6. **Choose the Right Interface**: 
   - Use **tools** for programmatic access with validation
   - Use **resources** for direct URI-based access

## Common Patterns

- **Browsing**: Use \`base_ui_list_docs\` → review list → use \`base_ui_get_doc\` for interesting pages
- **Direct Access**: Use resource URIs when you already know the exact path
- **Integration**: Tools provide structured responses suitable for programmatic use`;

    let content = `# How to Use This MCP Server

This MCP server provides access to Base UI documentation through tools and resources. Base UI is a collection of unstyled React components and hooks.

`;

    if (focus === 'tools' || focus === 'all') {
      content += toolsSection + '\n\n';
    }

    if (focus === 'resources' || focus === 'all') {
      content += resourcesSection + '\n\n';
    }

    if (focus === 'examples' || focus === 'all') {
      content += examplesSection + '\n\n';
    }

    if (focus === 'all') {
      content += bestPracticesSection;
    }

    return [
      {
        role: 'user',
        content: {
          type: 'text',
          text: content,
        },
      },
    ];
  },
};
