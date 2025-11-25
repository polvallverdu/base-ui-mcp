/**
 * @fileoverview Tests for the base-ui-doc resource definition.
 * @module tests/mcp-server/resources/definitions/base-ui-doc.resource.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { baseUiDocResourceDefinition } from '../../../../src/mcp-server/resources/definitions/base-ui-doc.resource.js';
import { requestContextService } from '../../../../src/utils/index.js';
import { z } from 'zod';
import {
  JsonRpcErrorCode,
  McpError,
} from '../../../../src/types-global/errors.js';

describe('baseUiDocResourceDefinition', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have the correct name, title, and description', () => {
    expect(baseUiDocResourceDefinition.name).toBe('base-ui-doc');
    expect(baseUiDocResourceDefinition.title).toBe('Base UI Documentation');
    expect(baseUiDocResourceDefinition.description).toContain(
      'dynamic resource that provides access to Base UI documentation pages',
    );
  });

  it('should have correct metadata', () => {
    expect(baseUiDocResourceDefinition.uriTemplate).toBe('base-ui://{path}');
    expect(baseUiDocResourceDefinition.mimeType).toBe('text/markdown');
    expect(baseUiDocResourceDefinition.annotations).toEqual({
      readOnlyHint: true,
      openWorldHint: true,
    });
    expect(baseUiDocResourceDefinition.examples).toHaveLength(1);
    expect(baseUiDocResourceDefinition.examples?.[0]).toEqual({
      name: 'Accordion Component',
      uri: 'base-ui://react/components/accordion.md',
    });
  });

  it('should process a valid documentation request', async () => {
    const mockContent =
      '# Accordion Component\n\nThis is the accordion documentation.';
    const mockResponse = new Response(mockContent, {
      status: 200,
      headers: { 'Content-Type': 'text/markdown' },
    });

    fetchSpy.mockResolvedValue(mockResponse);

    const uri = new URL('base-ui://react/components/accordion.md');
    const rawParams = { path: 'react/components/accordion.md' };
    const parsedParams =
      baseUiDocResourceDefinition.paramsSchema.parse(rawParams);
    const context = requestContextService.createRequestContext({
      operation: 'test',
    });

    const result = await baseUiDocResourceDefinition.logic(
      uri,
      parsedParams,
      context,
    );

    if (!baseUiDocResourceDefinition.outputSchema) {
      throw new Error('Output schema is not defined');
    }

    const typedResult = result as z.infer<
      typeof baseUiDocResourceDefinition.outputSchema
    >;

    expect(typedResult.path).toBe('react/components/accordion.md');
    expect(typedResult.content).toBe(mockContent);
    expect(typedResult.url).toBe(
      'https://base-ui.com/react/components/accordion.md',
    );
    expect(typedResult).toHaveProperty('timestamp');
    expect(typedResult.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );

    expect(fetchSpy).toHaveBeenCalled();
  });

  it('should extract path from URI when not provided in params', async () => {
    const mockContent =
      '# Button Component\n\nThis is the button documentation.';
    const mockResponse = new Response(mockContent, {
      status: 200,
      headers: { 'Content-Type': 'text/markdown' },
    });

    fetchSpy.mockResolvedValue(mockResponse);

    const uri = new URL('base-ui://react/components/button.md');
    const rawParams = {};
    const parsedParams =
      baseUiDocResourceDefinition.paramsSchema.parse(rawParams);
    const context = requestContextService.createRequestContext({
      operation: 'test',
    });

    const result = await baseUiDocResourceDefinition.logic(
      uri,
      parsedParams,
      context,
    );

    const typedResult = result as z.infer<
      typeof baseUiDocResourceDefinition.outputSchema
    >;

    expect(typedResult.path).toBe('react/components/button.md');
    expect(typedResult.content).toBe(mockContent);
  });

  it('should throw error when path is missing from both URI and params', async () => {
    const uri = new URL('base-ui://');
    const rawParams = {};
    const parsedParams =
      baseUiDocResourceDefinition.paramsSchema.parse(rawParams);
    const context = requestContextService.createRequestContext({
      operation: 'test',
    });

    await expect(
      baseUiDocResourceDefinition.logic(uri, parsedParams, context),
    ).rejects.toThrow(McpError);
  });

  it('should throw error for path traversal attempts', async () => {
    const uri = new URL('base-ui://test');
    const rawParams = { path: '../../../etc/passwd' };
    const parsedParams =
      baseUiDocResourceDefinition.paramsSchema.parse(rawParams);
    const context = requestContextService.createRequestContext({
      operation: 'test',
    });

    await expect(
      baseUiDocResourceDefinition.logic(uri, parsedParams, context),
    ).rejects.toThrow(McpError);
  });

  it('should throw error for full URL paths', async () => {
    const uri = new URL('base-ui://test');
    const rawParams = { path: 'https://evil.com/path' };
    const parsedParams =
      baseUiDocResourceDefinition.paramsSchema.parse(rawParams);
    const context = requestContextService.createRequestContext({
      operation: 'test',
    });

    await expect(
      baseUiDocResourceDefinition.logic(uri, parsedParams, context),
    ).rejects.toThrow(McpError);
  });

  it('should throw error when fetch fails', async () => {
    const mockResponse = new Response('Not Found', {
      status: 404,
      statusText: 'Not Found',
    });

    fetchSpy.mockResolvedValue(mockResponse);

    const uri = new URL('base-ui://react/components/nonexistent.md');
    const rawParams = { path: 'react/components/nonexistent.md' };
    const parsedParams =
      baseUiDocResourceDefinition.paramsSchema.parse(rawParams);
    const context = requestContextService.createRequestContext({
      operation: 'test',
    });

    await expect(
      baseUiDocResourceDefinition.logic(uri, parsedParams, context),
    ).rejects.toThrow(McpError);
  });

  it('should format response correctly', () => {
    const mockResult = {
      path: 'react/components/accordion.md',
      content: '# Accordion\n\nContent here.',
      url: 'https://base-ui.com/react/components/accordion.md',
      timestamp: new Date().toISOString(),
    };

    const uri = new URL('base-ui://react/components/accordion.md');
    const formatted = baseUiDocResourceDefinition.responseFormatter!(
      mockResult,
      { uri, mimeType: 'text/markdown' },
    );

    expect(formatted).toHaveLength(1);
    expect(formatted[0]).toHaveProperty('uri', uri.href);
    expect(formatted[0]).toHaveProperty('text', mockResult.content);
    expect(formatted[0]).toHaveProperty('mimeType', 'text/markdown');
  });

  it('should provide resource list for discovery', async () => {
    const list = baseUiDocResourceDefinition.list;
    expect(list).toBeDefined();

    const mockIndexContent = `# Base UI Documentation

- [Accordion](https://base-ui.com/react/components/accordion.md)
- [Button](https://base-ui.com/react/components/button.md)
- [Input](https://base-ui.com/react/components/input.md)
`;

    const mockResponse = new Response(mockIndexContent, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });

    fetchSpy.mockResolvedValue(mockResponse);

    // Mock RequestHandlerExtra parameter
    const mockExtra = {
      signal: new AbortController().signal,
      _meta: {},
    } as any;

    const resourceList = await list!(mockExtra);
    expect(resourceList.resources).toHaveLength(3);
    expect(resourceList.resources[0]).toEqual({
      uri: 'base-ui://react/components/accordion.md',
      name: 'Accordion',
      description: 'Base UI documentation: Accordion',
    });
    expect(resourceList.resources[1]).toEqual({
      uri: 'base-ui://react/components/button.md',
      name: 'Button',
      description: 'Base UI documentation: Button',
    });
    expect(resourceList.resources[2]).toEqual({
      uri: 'base-ui://react/components/input.md',
      name: 'Input',
      description: 'Base UI documentation: Input',
    });
  });

  it('should handle empty documentation index', async () => {
    const list = baseUiDocResourceDefinition.list;
    expect(list).toBeDefined();

    const mockResponse = new Response('# No documentation available', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });

    fetchSpy.mockResolvedValue(mockResponse);

    const mockExtra = {
      signal: new AbortController().signal,
      _meta: {},
    } as any;

    const resourceList = await list!(mockExtra);
    expect(resourceList.resources).toHaveLength(0);
  });

  it('should handle list failure gracefully', async () => {
    const list = baseUiDocResourceDefinition.list;
    expect(list).toBeDefined();

    const mockResponse = new Response('Internal Server Error', {
      status: 500,
      statusText: 'Internal Server Error',
    });

    fetchSpy.mockResolvedValue(mockResponse);

    const mockExtra = {
      signal: new AbortController().signal,
      _meta: {},
    } as any;

    await expect(list!(mockExtra)).rejects.toThrow(McpError);
  });
});
