/**
 * @fileoverview Tests for the list docs tool definition.
 * @module tests/mcp-server/tools/definitions/list-docs.tool.test
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listDocsTool } from '../../../../src/mcp-server/tools/definitions/list-docs.tool.js';
import { requestContextService } from '../../../../src/utils/index.js';

describe('listDocsTool', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should replace Base UI doc URLs with MCP path identifiers', async () => {
    const mockIndexContent = `# Base UI

- [Quick start](https://base-ui.com/react/overview/quick-start.md)
- [v1.2.0](https://base-ui.com/react/overview/releases/v1-2-0.md)
- [Accordion](https://base-ui.com/react/components/accordion.md)
`;

    fetchSpy.mockResolvedValue(
      new Response(mockIndexContent, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    const context = requestContextService.createRequestContext({
      operation: 'test',
    });

    const result = await listDocsTool.logic({} as never, context, {} as never);

    expect(result.docCount).toBe(3);
    expect(result.documentation).toContain(
      '[Quick start](react/overview/quick-start.md)',
    );
    expect(result.documentation).toContain(
      '[v1.2.0](react/overview/releases/v1-2-0.md)',
    );
    expect(result.documentation).toContain(
      '[Accordion](react/components/accordion.md)',
    );
    expect(result.documentation).not.toContain('https://base-ui.com/');
  });

  it('should format the response with the processed documentation index', () => {
    expect(listDocsTool.responseFormatter).toBeDefined();
    const formatted = listDocsTool.responseFormatter!({
      documentation: '[v1.2.0](react/overview/releases/v1-2-0.md)',
      docCount: 1,
    });
    const firstBlock = formatted[0];

    expect(formatted).toHaveLength(1);
    expect(firstBlock).toMatchObject({
      type: 'text',
    });
    expect(firstBlock?.type).toBe('text');
    expect(firstBlock && 'text' in firstBlock ? firstBlock.text : '').toContain(
      'Found 1 documentation entries.',
    );
    expect(firstBlock && 'text' in firstBlock ? firstBlock.text : '').toContain(
      '[v1.2.0](react/overview/releases/v1-2-0.md)',
    );
  });
});
