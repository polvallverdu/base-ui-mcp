/**
 * @fileoverview Loads, validates, and exports application configuration.
 * This module centralizes configuration management, sourcing values from
 * environment variables. It uses Zod for schema validation to ensure type safety
 * and correctness of configuration parameters, and is designed to be
 * environment-agnostic (e.g., Node.js, Cloudflare Workers).
 *
 * @module src/config/index
 */
import dotenv from 'dotenv';
import { z } from 'zod';

import packageJson from '../../package.json' with { type: 'json' };
import { JsonRpcErrorCode, McpError } from '../types-global/errors.js';

type PackageManifest = {
  name?: string;
  version?: string;
  description?: string;
};

const packageManifest = packageJson as PackageManifest;
const hasFileSystemAccess =
  typeof process !== 'undefined' &&
  typeof process.versions === 'object' &&
  process.versions !== null &&
  typeof process.versions.node === 'string';

// Suppress dotenv's noisy initial log message as suggested by its output.
dotenv.config({ quiet: true });

// --- Helper Functions ---
const emptyStringAsUndefined = (val: unknown) => {
  if (typeof val === 'string' && val.trim() === '') {
    return undefined;
  }
  return val;
};

// --- Schema Definition ---
const ConfigSchema = z.object({
  // Package information sourced from environment variables
  pkg: z.object({
    name: z.string(),
    version: z.string(),
    description: z.string().optional(),
  }),
  mcpServerName: z.string(), // Will be derived from pkg.name
  mcpServerVersion: z.string(), // Will be derived from pkg.version
  mcpServerDescription: z.string().optional(), // Will be derived from pkg.description
  logLevel: z
    .preprocess(
      (val) => {
        const str = emptyStringAsUndefined(val);
        if (typeof str === 'string') {
          const lower = str.toLowerCase();
          const aliasMap: Record<string, string> = {
            warning: 'warn',
            err: 'error',
            information: 'info',
          };
          return aliasMap[lower] ?? lower;
        }
        return str;
      },
      z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
    )
    .default('debug'),
  logsPath: z.string().optional(), // Made optional as it's Node-specific
  environment: z
    .preprocess(
      (val) => {
        const str = emptyStringAsUndefined(val);
        if (typeof str === 'string') {
          const lower = str.toLowerCase();
          const aliasMap: Record<string, string> = {
            dev: 'development',
            prod: 'production',
            test: 'testing',
          };
          return aliasMap[lower] ?? lower;
        }
        return str;
      },
      z.enum(['development', 'production', 'testing']),
    )
    .default('development'),
  mcpTransportType: z.preprocess(
    emptyStringAsUndefined,
    z.enum(['stdio', 'http']).default('stdio'),
  ),
  mcpResponseVerbosity: z.preprocess(
    emptyStringAsUndefined,
    z.enum(['minimal', 'standard', 'full']).default('standard'),
  ),
  mcpHttpPort: z.coerce.number().default(3010),
  mcpHttpHost: z.string().default('127.0.0.1'),
  mcpHttpEndpointPath: z.string().default('/mcp'),
  mcpHttpMaxPortRetries: z.coerce.number().default(15),
  mcpHttpPortRetryDelayMs: z.coerce.number().default(50),
  mcpAllowedOrigins: z.array(z.string()).optional(),
  openTelemetry: z.object({
    enabled: z.coerce.boolean().default(false),
    serviceName: z.string(),
    serviceVersion: z.string(),
    tracesEndpoint: z.string().url().optional(),
    metricsEndpoint: z.string().url().optional(),
    samplingRatio: z.coerce.number().default(1.0),
    logLevel: z
      .preprocess(
        (val) => {
          const str = emptyStringAsUndefined(val);
          if (typeof str === 'string') {
            const lower = str.toLowerCase();
            const aliasMap: Record<string, string> = {
              err: 'ERROR',
              warning: 'WARN',
              information: 'INFO',
            };
            return aliasMap[lower] ?? str.toUpperCase();
          }
          return str;
        },
        z.enum(['NONE', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'VERBOSE', 'ALL']),
      )
      .default('INFO'),
  }),
});

// --- Parsing Logic ---
const parseConfig = () => {
  const env = process.env;

  const rawConfig = {
    pkg: {
      name: env.PACKAGE_NAME ?? packageManifest.name,
      version: env.PACKAGE_VERSION ?? packageManifest.version,
      description: env.PACKAGE_DESCRIPTION ?? packageManifest.description,
    },
    logLevel: env.MCP_LOG_LEVEL,
    logsPath: env.LOGS_DIR,
    environment: env.NODE_ENV,
    mcpTransportType: env.MCP_TRANSPORT_TYPE,
    mcpResponseVerbosity: env.MCP_RESPONSE_VERBOSITY,
    mcpHttpPort: env.MCP_HTTP_PORT,
    mcpHttpHost: env.MCP_HTTP_HOST,
    mcpHttpEndpointPath: env.MCP_HTTP_ENDPOINT_PATH,
    mcpHttpMaxPortRetries: env.MCP_HTTP_MAX_PORT_RETRIES,
    mcpHttpPortRetryDelayMs: env.MCP_HTTP_PORT_RETRY_DELAY_MS,
    mcpAllowedOrigins: env.MCP_ALLOWED_ORIGINS?.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    openTelemetry: {
      enabled: env.OTEL_ENABLED,
      serviceName: env.OTEL_SERVICE_NAME,
      serviceVersion: env.OTEL_SERVICE_VERSION,
      tracesEndpoint: env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
      metricsEndpoint: env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
      samplingRatio: env.OTEL_TRACES_SAMPLER_ARG,
      logLevel: env.OTEL_LOG_LEVEL,
    },
    // The following fields will be derived and are not directly from env
    mcpServerName: env.MCP_SERVER_NAME,
    mcpServerVersion: env.MCP_SERVER_VERSION,
    mcpServerDescription: env.MCP_SERVER_DESCRIPTION,
  };

  // Use a temporary schema to parse package info and provide defaults
  const pkgSchema = z.object({
    name: z.string(),
    version: z.string(),
    description: z.string().optional(),
  });
  const parsedPkg = pkgSchema.parse(rawConfig.pkg);

  // Now add the derived values to the main rawConfig object to be parsed
  const finalRawConfig = {
    ...rawConfig,
    pkg: parsedPkg,
    logsPath: rawConfig.logsPath ?? (hasFileSystemAccess ? 'logs' : undefined),
    mcpServerName: env.MCP_SERVER_NAME ?? parsedPkg.name,
    mcpServerVersion: env.MCP_SERVER_VERSION ?? parsedPkg.version,
    mcpServerDescription: env.MCP_SERVER_DESCRIPTION ?? parsedPkg.description,
    openTelemetry: {
      ...rawConfig.openTelemetry,
      serviceName: env.OTEL_SERVICE_NAME ?? parsedPkg.name,
      serviceVersion: env.OTEL_SERVICE_VERSION ?? parsedPkg.version,
    },
  };

  const parsedConfig = ConfigSchema.safeParse(finalRawConfig);

  if (!parsedConfig.success) {
    // Keep existing TTY error logging for developer convenience.
    if (process.stdout.isTTY) {
      console.error(
        '❌ Invalid configuration found. Please check your environment variables.',
        parsedConfig.error.flatten().fieldErrors,
      );
    }
    // Throw a specific, typed error instead of exiting.
    throw new McpError(
      JsonRpcErrorCode.ConfigurationError,
      'Invalid application configuration.',
      {
        validationErrors: parsedConfig.error.flatten().fieldErrors,
      },
    );
  }

  return parsedConfig.data;
};

const config = parseConfig();

/**
 * Export the runtime configuration, parser, and schema, plus a static AppConfig type.
 */
export type AppConfig = z.infer<typeof ConfigSchema>;

export { config, ConfigSchema, parseConfig };
