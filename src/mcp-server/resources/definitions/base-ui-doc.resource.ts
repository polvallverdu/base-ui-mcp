/**
 * @fileoverview Base UI documentation resource definition.
 * Provides dynamic access to Base UI documentation pages via resource URIs.
 * @module src/mcp-server/resources/definitions/base-ui-doc.resource
 */
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import {
  type RequestContext,
  logger,
  fetchWithTimeout,
  requestContextService,
} from '@/utils/index.js';
import { type ResourceDefinition } from '@/mcp-server/resources/utils/resourceDefinition.js';
import { JsonRpcErrorCode, McpError } from '@/types-global/errors.js';

/** Base URL for Base UI documentation. */
const BASE_DOCS_URL = 'https://base-ui.com';
/** URL for the documentation index. */
const DOCS_INDEX_URL = 'https://base-ui.com/llms.txt';
/** Default timeout for fetching documentation (30 seconds). */
const DEFAULT_TIMEOUT_MS = 30000;

const ParamsSchema = z
  .object({
    path: z
      .string()
      .optional()
      .describe(
        'The documentation path identifier (e.g., "react/components/accordion.md"). If omitted, it may be derived from the URI path.',
      ),
  })
  .describe('Base UI documentation resource parameters.');

const OutputSchema = z
  .object({
    path: z.string().describe('The path identifier that was requested.'),
    content: z
      .string()
      .describe('The markdown content of the documentation page.'),
    url: z.string().url().describe('The full URL that was fetched.'),
    timestamp: z
      .string()
      .datetime()
      .describe('ISO 8601 timestamp when the response was generated.'),
  })
  .describe('Base UI documentation resource response payload.');

type BaseUiDocParams = z.infer<typeof ParamsSchema>;
type BaseUiDocOutput = z.infer<typeof OutputSchema>;

/**
 * Validates and sanitizes a documentation path.
 */
function sanitizePath(path: string, context: RequestContext): string {
  let sanitizedPath = path.trim();

  // Remove leading slash if present
  if (sanitizedPath.startsWith('/')) {
    sanitizedPath = sanitizedPath.slice(1);
  }

  // Ensure it doesn't start with http:// or https://
  if (
    sanitizedPath.startsWith('http://') ||
    sanitizedPath.startsWith('https://')
  ) {
    throw new McpError(
      JsonRpcErrorCode.InvalidParams,
      'Path should be a relative path (e.g., "react/components/accordion.md"), not a full URL.',
      { ...context, providedPath: path },
    );
  }

  // Prevent path traversal attacks
  if (sanitizedPath.includes('..') || sanitizedPath.includes('//')) {
    throw new McpError(
      JsonRpcErrorCode.InvalidParams,
      'Invalid path: path traversal detected.',
      { ...context, providedPath: path },
    );
  }

  return sanitizedPath;
}

async function baseUiDocLogic(
  uri: URL,
  params: BaseUiDocParams,
  context: RequestContext,
): Promise<BaseUiDocOutput> {
  // Extract path from URI or params
  const pathFromUri = uri.hostname || uri.pathname.replace(/^\/+/, '');
  const pathToFetch = params.path || pathFromUri;

  if (!pathToFetch) {
    throw new McpError(
      JsonRpcErrorCode.InvalidParams,
      'Path is required. Provide it either in the URI (e.g., base-ui://react/components/accordion.md) or as a parameter.',
      { ...context, uri: uri.href },
    );
  }

  const sanitizedPath = sanitizePath(pathToFetch, context);

  logger.debug('Fetching Base UI documentation page.', {
    ...context,
    path: sanitizedPath,
    resourceUri: uri.href,
  });

  const fullUrl = `${BASE_DOCS_URL}/${sanitizedPath}`;

  const response = await fetchWithTimeout(
    fullUrl,
    DEFAULT_TIMEOUT_MS,
    context,
    {
      headers: {
        Accept: 'text/markdown, text/plain, */*',
      },
    },
  );

  if (!response.ok) {
    throw new McpError(
      JsonRpcErrorCode.InternalError,
      `Failed to fetch documentation: ${response.status} ${response.statusText}`,
      {
        ...context,
        path: sanitizedPath,
        url: fullUrl,
        status: response.status,
      },
    );
  }

  const content = await response.text();

  logger.debug('Successfully fetched documentation page.', {
    ...context,
    path: sanitizedPath,
    url: fullUrl,
    contentLength: content.length,
  });

  return {
    path: sanitizedPath,
    content,
    url: fullUrl,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Formats the documentation content response.
 */
function responseFormatter(
  result: unknown,
  meta: { uri: URL; mimeType: string },
): ReadResourceResult['contents'] {
  const docResult = result as BaseUiDocOutput;
  return [
    {
      uri: meta.uri.href,
      text: docResult.content,
      mimeType: 'text/markdown',
    },
  ];
}

/**
 * Lists available Base UI documentation resources by fetching the llms.txt index.
 */
async function listBaseUiDocs() {
  const response = await fetchWithTimeout(
    DOCS_INDEX_URL,
    DEFAULT_TIMEOUT_MS,
    requestContextService.createRequestContext({
      operation: 'ListBaseUiDocs',
    }),
  );

  if (!response.ok) {
    throw new McpError(
      JsonRpcErrorCode.InternalError,
      `Failed to fetch documentation index: ${response.status} ${response.statusText}`,
      {
        url: DOCS_INDEX_URL,
        status: response.status,
      },
    );
  }

  const content = await response.text();

  // Extract paths from markdown links
  // Pattern: [Text](https://base-ui.com/path/to/file.md) -> path/to/file.md
  const urlPattern = /\[([^\]]+)\]\(https:\/\/base-ui\.com\/([^)]+)\)/g;
  const resources: Array<{ uri: string; name: string; description: string }> =
    [];

  let match;
  while ((match = urlPattern.exec(content)) !== null) {
    const [, text, path] = match;
    if (text && path) {
      resources.push({
        uri: `base-ui://${path}`,
        name: text,
        description: `Base UI documentation: ${text}`,
      });
    }
  }

  return {
    resources,
  };
}

export const baseUiDocResourceDefinition: ResourceDefinition<
  typeof ParamsSchema,
  typeof OutputSchema
> = {
  name: 'base-ui-doc',
  title: 'Base UI Documentation',
  description:
    'A dynamic resource that provides access to Base UI documentation pages. Use a path identifier (e.g., "react/components/accordion.md") to fetch specific documentation.',
  uriTemplate: 'base-ui://{path}',
  paramsSchema: ParamsSchema,
  outputSchema: OutputSchema,
  mimeType: 'text/markdown',
  examples: [
    {
      name: 'Accordion Component',
      uri: 'base-ui://react/components/accordion.md',
    },
  ],
  annotations: { readOnlyHint: true, openWorldHint: true },
  list: async (_extra) => {
    return await listBaseUiDocs();
  },
  logic: baseUiDocLogic,
  responseFormatter,
};
