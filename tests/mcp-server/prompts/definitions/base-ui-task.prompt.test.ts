/**
 * @fileoverview Test suite for base-ui-task prompt definition
 * @module tests/mcp-server/prompts/definitions/base-ui-task.prompt.test
 */

import { describe, it, expect } from 'vitest';

import { baseUiTaskPrompt } from '../../../../src/mcp-server/prompts/definitions/base-ui-task.prompt.js';

describe('Base UI Task Prompt', () => {
  it('should have the correct name and description', () => {
    expect(baseUiTaskPrompt.name).toBe('base-ui-task');
    expect(baseUiTaskPrompt.description).toContain(
      'comprehensive guidance on how to use this MCP server',
    );
  });

  it('should have an arguments schema', () => {
    expect(baseUiTaskPrompt.argumentsSchema).toBeDefined();
    const schema = baseUiTaskPrompt.argumentsSchema!;
    expect(schema.shape.focus).toBeDefined();
  });

  it('should generate prompt with default focus (all)', () => {
    const messages = baseUiTaskPrompt.generate({});

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content.type).toBe('text');
    const text = (messages[0].content as { type: 'text'; text: string }).text;

    // Should include all sections
    expect(text).toContain('# How to Use This MCP Server');
    expect(text).toContain('## Available Tools');
    expect(text).toContain('base_ui_list_docs');
    expect(text).toContain('base_ui_get_doc');
    expect(text).toContain('## Available Resources');
    expect(text).toContain('base-ui-doc Resource');
    expect(text).toContain('## Usage Examples');
    expect(text).toContain('## Best Practices');
  });

  it('should generate prompt with focus on tools only', () => {
    const messages = baseUiTaskPrompt.generate({ focus: 'tools' });

    expect(messages).toHaveLength(1);
    const text = (messages[0].content as { type: 'text'; text: string }).text;

    expect(text).toContain('## Available Tools');
    expect(text).toContain('base_ui_list_docs');
    expect(text).toContain('base_ui_get_doc');
    // Should not include other sections
    expect(text).not.toContain('## Available Resources');
    expect(text).not.toContain('## Usage Examples');
    expect(text).not.toContain('## Best Practices');
  });

  it('should generate prompt with focus on resources only', () => {
    const messages = baseUiTaskPrompt.generate({ focus: 'resources' });

    expect(messages).toHaveLength(1);
    const text = (messages[0].content as { type: 'text'; text: string }).text;

    expect(text).toContain('## Available Resources');
    expect(text).toContain('base-ui-doc Resource');
    expect(text).toContain('base-ui://');
    // Should not include other sections
    expect(text).not.toContain('## Available Tools');
    expect(text).not.toContain('## Usage Examples');
    expect(text).not.toContain('## Best Practices');
  });

  it('should generate prompt with focus on examples only', () => {
    const messages = baseUiTaskPrompt.generate({ focus: 'examples' });

    expect(messages).toHaveLength(1);
    const text = (messages[0].content as { type: 'text'; text: string }).text;

    expect(text).toContain('## Usage Examples');
    expect(text).toContain('Example 1:');
    expect(text).toContain('Example 2:');
    expect(text).toContain('Example 3:');
    // Should not include other sections
    expect(text).not.toContain('## Available Tools');
    expect(text).not.toContain('## Available Resources');
    expect(text).not.toContain('## Best Practices');
  });

  it('should generate prompt with focus on all', () => {
    const messages = baseUiTaskPrompt.generate({ focus: 'all' });

    expect(messages).toHaveLength(1);
    const text = (messages[0].content as { type: 'text'; text: string }).text;

    // Should include all sections
    expect(text).toContain('## Available Tools');
    expect(text).toContain('## Available Resources');
    expect(text).toContain('## Usage Examples');
    expect(text).toContain('## Best Practices');
  });

  it('should include tool descriptions in the generated prompt', () => {
    const messages = baseUiTaskPrompt.generate({ focus: 'tools' });
    const text = (messages[0].content as { type: 'text'; text: string }).text;

    expect(text).toContain('base_ui_list_docs');
    expect(text).toContain('Fetches the Base UI documentation index');
    expect(text).toContain('base_ui_get_doc');
    expect(text).toContain('Fetches a specific Base UI documentation page');
  });

  it('should include resource information in the generated prompt', () => {
    const messages = baseUiTaskPrompt.generate({ focus: 'resources' });
    const text = (messages[0].content as { type: 'text'; text: string }).text;

    expect(text).toContain('base-ui-doc Resource');
    expect(text).toContain('base-ui://{path}');
    expect(text).toContain('base-ui://react/components/accordion.md');
  });

  it('should include usage examples in the generated prompt', () => {
    const messages = baseUiTaskPrompt.generate({ focus: 'examples' });
    const text = (messages[0].content as { type: 'text'; text: string }).text;

    expect(text).toContain('base_ui_list_docs');
    expect(text).toContain('base_ui_get_doc');
    expect(text).toContain('base-ui://');
  });

  it('should include best practices when focus is all', () => {
    const messages = baseUiTaskPrompt.generate({ focus: 'all' });
    const text = (messages[0].content as { type: 'text'; text: string }).text;

    expect(text).toContain('## Best Practices');
    expect(text).toContain('Start with Discovery');
    expect(text).toContain('Common Patterns');
  });

  it('should validate arguments schema', () => {
    const schema = baseUiTaskPrompt.argumentsSchema!;

    // Valid: focus is optional
    expect(() => schema.parse({})).not.toThrow();
    expect(() => schema.parse({ focus: 'tools' })).not.toThrow();
    expect(() => schema.parse({ focus: 'resources' })).not.toThrow();
    expect(() => schema.parse({ focus: 'examples' })).not.toThrow();
    expect(() => schema.parse({ focus: 'all' })).not.toThrow();
  });
});
