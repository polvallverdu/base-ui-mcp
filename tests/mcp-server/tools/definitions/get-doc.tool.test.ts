/**
 * @fileoverview Tests for the get doc tool definition.
 * @module tests/mcp-server/tools/definitions/get-doc.tool.test
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getDocTool } from '../../../../src/mcp-server/tools/definitions/get-doc.tool.js';
import { requestContextService } from '../../../../src/utils/index.js';
import { McpError } from '../../../../src/types-global/errors.js';

describe('getDocTool', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch the Base UI v1.2.0 release notes', async () => {
    const mockContent = '# v1.2.0\n\nRelease notes.';

    fetchSpy.mockResolvedValue(
      new Response(mockContent, {
        status: 200,
        headers: { 'Content-Type': 'text/markdown' },
      }),
    );

    const context = requestContextService.createRequestContext({
      operation: 'test',
    });

    const result = await getDocTool.logic(
      { path: 'react/overview/releases/v1-2-0.md' },
      context,
      {} as never,
    );

    expect(result.path).toBe('react/overview/releases/v1-2-0.md');
    expect(result.content).toBe(mockContent);
    expect(result.url).toBe(
      'https://base-ui.com/react/overview/releases/v1-2-0.md',
    );
  });

  it('should reject invalid full URL inputs', async () => {
    const context = requestContextService.createRequestContext({
      operation: 'test',
    });

    await expect(
      getDocTool.logic(
        { path: 'https://base-ui.com/react/overview/releases/v1-2-0.md' },
        context,
        {} as never,
      ),
    ).rejects.toThrow(McpError);
  });
});
