/**
 * @fileoverview Tool definition for fetching individual Base UI documentation pages.
 * Accepts a path identifier from list-docs and fetches the corresponding markdown file.
 * @module src/mcp-server/tools/definitions/get-doc.tool
 */
import type { ContentBlock } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import type {
  SdkContext,
  ToolAnnotations,
  ToolDefinition,
} from '@/mcp-server/tools/utils/index.js';
import { markdown } from '@/utils/index.js';
import { JsonRpcErrorCode, McpError } from '@/types-global/errors.js';
import {
  type RequestContext,
  logger,
  fetchWithTimeout,
} from '@/utils/index.js';

/**
 * Programmatic tool name (must be unique).
 */
const TOOL_NAME = 'base_ui_get_doc';
/** --------------------------------------------------------- */

/** Human-readable title used by UIs. */
const TOOL_TITLE = 'Get Base UI Documentation';
/** --------------------------------------------------------- */

/**
 * LLM-facing description of the tool.
 */
const TOOL_DESCRIPTION =
  'Fetches a specific Base UI documentation page by path identifier (e.g., "react/components/accordion.md"). The identifier should come from the list-docs tool output.';
/** --------------------------------------------------------- */

/**
 * UI/behavior hints for clients.
 */
const TOOL_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: true,
};
/** --------------------------------------------------------- */

/** Base URL for Base UI documentation. */
const BASE_DOCS_URL = 'https://base-ui.com';
/** Default timeout for fetching documentation (30 seconds). */
const DEFAULT_TIMEOUT_MS = 30000;

//
// Schemas (input and output)
// --------------------------
const InputSchema = z
  .object({
    path: z
      .string()
      .min(1, 'Path cannot be empty.')
      .describe(
        'The documentation path identifier (e.g., "react/components/accordion.md"). This should come from the list-docs tool output.',
      ),
  })
  .describe('Get a specific Base UI documentation page by path.');

const OutputSchema = z
  .object({
    path: z.string().describe('The path identifier that was requested.'),
    content: z
      .string()
      .describe('The markdown content of the documentation page.'),
    url: z.string().url().describe('The full URL that was fetched.'),
  })
  .describe('Get doc tool response payload.');

type GetDocToolInput = z.infer<typeof InputSchema>;
type GetDocToolResponse = z.infer<typeof OutputSchema>;

//
// Pure business logic (no try/catch; throw McpError on failure)
// -------------------------------------------------------------
async function getDocToolLogic(
  input: GetDocToolInput,
  appContext: RequestContext,
  _sdkContext: SdkContext,
): Promise<GetDocToolResponse> {
  logger.debug('Fetching Base UI documentation page.', {
    ...appContext,
    path: input.path,
  });

  // Validate and sanitize the path
  // Remove leading slash if present, ensure it doesn't start with http:// or https://
  let sanitizedPath = input.path.trim();
  if (sanitizedPath.startsWith('/')) {
    sanitizedPath = sanitizedPath.slice(1);
  }
  if (
    sanitizedPath.startsWith('http://') ||
    sanitizedPath.startsWith('https://')
  ) {
    throw new McpError(
      JsonRpcErrorCode.InvalidParams,
      'Path should be a relative path (e.g., "react/components/accordion.md"), not a full URL.',
      { ...appContext, providedPath: input.path },
    );
  }

  // Prevent path traversal attacks
  if (sanitizedPath.includes('..') || sanitizedPath.includes('//')) {
    throw new McpError(
      JsonRpcErrorCode.InvalidParams,
      'Invalid path: path traversal detected.',
      { ...appContext, providedPath: input.path },
    );
  }

  const fullUrl = `${BASE_DOCS_URL}/${sanitizedPath}`;

  const response = await fetchWithTimeout(
    fullUrl,
    DEFAULT_TIMEOUT_MS,
    appContext,
    {
      headers: {
        Accept: 'text/markdown, text/plain, */*',
      },
    },
  );

  const content = await response.text();

  logger.debug('Successfully fetched documentation page.', {
    ...appContext,
    path: input.path,
    url: fullUrl,
    contentLength: content.length,
  });

  return {
    path: input.path,
    content,
    url: fullUrl,
  };
}

/**
 * Formats the documentation content response.
 */
function responseFormatter(result: GetDocToolResponse): ContentBlock[] {
  const md = markdown()
    .h2('Base UI Documentation')
    .text(`**Path:** ${result.path}\n`)
    .text(`**URL:** ${result.url}\n\n`)
    .codeBlock(result.content, 'markdown');

  return [
    {
      type: 'text',
      text: md.build(),
    },
  ];
}

/**
 * The complete tool definition for getting Base UI documentation.
 */
export const getDocTool: ToolDefinition<
  typeof InputSchema,
  typeof OutputSchema
> = {
  name: TOOL_NAME,
  title: TOOL_TITLE,
  description: TOOL_DESCRIPTION,
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  annotations: TOOL_ANNOTATIONS,
  logic: getDocToolLogic,
  responseFormatter,
};
