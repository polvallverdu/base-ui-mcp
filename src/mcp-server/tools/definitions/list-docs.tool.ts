/**
 * @fileoverview Tool definition for listing Base UI documentation from llms.txt.
 * Fetches the llms.txt file and replaces URLs with identifiers for the get-doc tool.
 * @module src/mcp-server/tools/definitions/list-docs.tool
 */
import type { ContentBlock } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import type {
  SdkContext,
  ToolAnnotations,
  ToolDefinition,
} from '@/mcp-server/tools/utils/index.js';
import { markdown } from '@/utils/index.js';
import {
  type RequestContext,
  logger,
  fetchWithTimeout,
} from '@/utils/index.js';

/**
 * Programmatic tool name (must be unique).
 */
const TOOL_NAME = 'base_ui_list_docs';
/** --------------------------------------------------------- */

/** Human-readable title used by UIs. */
const TOOL_TITLE = 'List Base UI Documentation';
/** --------------------------------------------------------- */

/**
 * LLM-facing description of the tool.
 */
const TOOL_DESCRIPTION =
  'Fetches the Base UI documentation index (llms.txt) and returns it with URLs replaced by identifiers that can be used with the get-doc tool.';
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
const BASE_DOCS_URL = 'https://base-ui.com/llms.txt';
/** Default timeout for fetching documentation (30 seconds). */
const DEFAULT_TIMEOUT_MS = 30000;

//
// Schemas (input and output)
// --------------------------
const InputSchema = z
  .object({})
  .describe('No input parameters required for listing documentation.');

const OutputSchema = z
  .object({
    documentation: z
      .string()
      .describe(
        'The llms.txt content with URLs replaced by identifiers for use with get-doc tool.',
      ),
    docCount: z
      .number()
      .int()
      .min(0)
      .describe('The number of documentation entries found.'),
  })
  .describe('List docs tool response payload.');

type ListDocsToolInput = z.infer<typeof InputSchema>;
type ListDocsToolResponse = z.infer<typeof OutputSchema>;

//
// Pure business logic (no try/catch; throw McpError on failure)
// -------------------------------------------------------------
async function listDocsToolLogic(
  _input: ListDocsToolInput,
  appContext: RequestContext,
  _sdkContext: SdkContext,
): Promise<ListDocsToolResponse> {
  logger.debug('Fetching Base UI documentation index.', {
    ...appContext,
    url: BASE_DOCS_URL,
  });

  const response = await fetchWithTimeout(
    BASE_DOCS_URL,
    DEFAULT_TIMEOUT_MS,
    appContext,
  );

  const content = await response.text();

  // Replace URLs with identifiers
  // Pattern: [Text](https://base-ui.com/path/to/file.md) -> [Text](path/to/file.md)
  // This extracts the path part which can be used by get-doc tool
  const urlPattern = /\[([^\]]+)\]\(https:\/\/base-ui\.com\/([^)]+)\)/g;
  let docCount = 0;
  const processedContent = content.replace(urlPattern, (_match, text, path) => {
    docCount++;
    // Return markdown link with just the path as identifier
    return `[${text}](${path})`;
  });

  logger.debug('Successfully processed documentation index.', {
    ...appContext,
    docCount,
  });

  return {
    documentation: processedContent,
    docCount,
  };
}

/**
 * Formats the documentation list response.
 */
function responseFormatter(result: ListDocsToolResponse): ContentBlock[] {
  const md = markdown()
    .h2('Base UI Documentation Index')
    .text(`Found ${result.docCount} documentation entries.\n\n`)
    .codeBlock(result.documentation, 'markdown');

  return [
    {
      type: 'text',
      text: md.build(),
    },
  ];
}

/**
 * The complete tool definition for listing Base UI documentation.
 */
export const listDocsTool: ToolDefinition<
  typeof InputSchema,
  typeof OutputSchema
> = {
  name: TOOL_NAME,
  title: TOOL_TITLE,
  description: TOOL_DESCRIPTION,
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  annotations: TOOL_ANNOTATIONS,
  logic: listDocsToolLogic,
  responseFormatter,
};
