/**
 * @fileoverview Cloudflare Worker entry point for the MCP TypeScript Template.
 * This script adapts the existing MCP server to run in a serverless environment.
 * It initializes the core application logic, creates the Hono app, and exports
 * it for the Cloudflare Workers runtime with support for bindings (KV, R2, D1, AI).
 * @module src/worker
 */
import 'reflect-metadata';

import type { IncomingRequestCfProperties as CfProperties } from '@cloudflare/workers-types';

import { composeContainer } from '@/container/index.js';
import { createMcpServerInstance } from '@/mcp-server/server.js';
import { createHttpApp } from '@/mcp-server/transports/http/httpTransport.js';
import {
  initializePerformance_Hrt,
  requestContextService,
} from '@/utils/index.js';
import { logger } from '@/utils/internal/logger.js';
import { Hono } from 'hono';

/**
 * Define Cloudflare Worker Bindings with proper type safety.
 * These bindings are configured in wrangler.toml and injected at runtime.
 */
export interface CloudflareBindings {
  // Environment variables (secrets)
  ENVIRONMENT?: string;
  LOG_LEVEL?: string;
  MCP_ALLOWED_ORIGINS?: string;
  OTEL_ENABLED?: string;
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_METRICS_ENDPOINT?: string;

  // Allow additional string-based bindings
  [key: string]: unknown;
}

/**
 * Define the complete Hono environment for the worker.
 * This type is used to configure the Hono app with Cloudflare-specific bindings.
 */
type WorkerEnv = {
  Bindings: CloudflareBindings;
};

// Use a Promise to ensure the app is only initialized once per worker instance.
let appPromise: Promise<Hono<WorkerEnv>> | null = null;

/**
 * Injects Cloudflare environment variables into process.env for consumption
 * by the config module. This enables seamless environment variable access
 * across local and Worker environments.
 */
function injectEnvVars(env: CloudflareBindings): void {
  if (typeof process === 'undefined') {
    return; // No process in pure Workers runtime
  }

  const envMappings: Array<[keyof CloudflareBindings, string]> = [
    ['ENVIRONMENT', 'NODE_ENV'],
    ['LOG_LEVEL', 'MCP_LOG_LEVEL'],
    ['MCP_ALLOWED_ORIGINS', 'MCP_ALLOWED_ORIGINS'],
    ['OTEL_ENABLED', 'OTEL_ENABLED'],
    [
      'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
      'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
    ],
    [
      'OTEL_EXPORTER_OTLP_METRICS_ENDPOINT',
      'OTEL_EXPORTER_OTLP_METRICS_ENDPOINT',
    ],
  ];

  for (const [bindingKey, processKey] of envMappings) {
    const value = env[bindingKey];
    if (typeof value === 'string' && value.trim() !== '') {
      process.env[processKey] = value;
    }
  }
}

/**
 * Initializes the Hono application with proper error handling and observability.
 * This function is idempotent and returns a cached promise after first invocation.
 */
function initializeApp(env: CloudflareBindings): Promise<Hono<WorkerEnv>> {
  if (appPromise) {
    return appPromise;
  }

  appPromise = (async () => {
    const initStartTime = Date.now();

    try {
      // Set a process-level flag to indicate a serverless environment.
      if (typeof process !== 'undefined' && process.env) {
        process.env.IS_SERVERLESS = 'true';
      } else {
        Object.assign(globalThis, { IS_SERVERLESS: true });
      }

      // Inject environment variables from Cloudflare bindings
      injectEnvVars(env);

      // Initialize core services lazily.
      composeContainer();
      await initializePerformance_Hrt();

      // Initialize logger with level from env or default to 'info'
      // Workers always use HTTP transport (no STDIO support)
      const logLevel = env.LOG_LEVEL?.toLowerCase() ?? 'info';
      // Validate log level is one of the supported values
      type ValidLogLevel =
        | 'debug'
        | 'info'
        | 'notice'
        | 'warning'
        | 'error'
        | 'crit'
        | 'alert'
        | 'emerg';
      const validLogLevels: ValidLogLevel[] = [
        'debug',
        'info',
        'notice',
        'warning',
        'error',
        'crit',
        'alert',
        'emerg',
      ];
      const validatedLogLevel = validLogLevels.includes(
        logLevel as ValidLogLevel,
      )
        ? (logLevel as ValidLogLevel)
        : 'info';
      await logger.initialize(validatedLogLevel, 'http');

      // Create a root context for the worker's lifecycle.
      const workerContext = requestContextService.createRequestContext({
        operation: 'WorkerInitialization',
        isServerless: true,
      });

      logger.info('Cloudflare Worker initializing...', {
        ...workerContext,
        environment: env.ENVIRONMENT ?? 'production',
      });

      // Create the MCP Server instance.
      const mcpServer = await createMcpServerInstance();

      // Create the Hono application with Cloudflare Worker bindings.
      // createHttpApp is generic and accepts the binding type as a type parameter.
      const app = createHttpApp<CloudflareBindings>(mcpServer, workerContext);

      const initDuration = Date.now() - initStartTime;
      logger.info('Cloudflare Worker initialized successfully.', {
        ...workerContext,
        initDurationMs: initDuration,
      });

      return app;
    } catch (error: unknown) {
      const initDuration = Date.now() - initStartTime;
      const errorContext = requestContextService.createRequestContext({
        operation: 'WorkerInitialization',
        isServerless: true,
        initDurationMs: initDuration,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      logger.crit(
        'Failed to initialize Cloudflare Worker.',
        error instanceof Error ? error : new Error(String(error)),
        errorContext,
      );

      // Reset appPromise to allow retry on next request
      appPromise = null;

      throw error;
    }
  })();

  return appPromise;
}

/**
 * The default export for Cloudflare Workers runtime.
 * Implements the standard Worker interface with fetch, scheduled, and optional handlers.
 */
export default {
  /**
   * Handles incoming HTTP requests.
   * Extracts Worker-specific metadata and passes it to the request context.
   */
  async fetch(
    request: Request,
    env: CloudflareBindings,
    ctx: ExecutionContext,
  ): Promise<Response> {
    try {
      const app = await initializeApp(env);

      // Extract Cloudflare-specific request metadata
      // TypeScript doesn't know about the cf property, but it's added by Cloudflare runtime
      type RequestWithCf = Request & { cf?: CfProperties };
      const cfProperties = (request as RequestWithCf).cf;
      const requestId = request.headers.get('cf-ray') ?? crypto.randomUUID();

      // Create enhanced request context with Worker metadata
      const requestContext = requestContextService.createRequestContext({
        operation: 'WorkerFetch',
        requestId,
        isServerless: true,
        // Optional: Add CF-specific metadata
        ...(cfProperties && {
          colo: cfProperties.colo,
          country: cfProperties.country,
          city: cfProperties.city,
        }),
      });

      logger.debug('Processing Worker fetch request.', {
        ...requestContext,
        method: request.method,
        url: request.url,
        colo: cfProperties?.colo,
      });

      // Use ctx.waitUntil for background tasks (future enhancement)
      // Example: ctx.waitUntil(someBackgroundTask());

      return await app.fetch(request, env, ctx);
    } catch (error: unknown) {
      const requestId = request.headers.get('cf-ray');
      const errorContext = requestContextService.createRequestContext({
        operation: 'WorkerFetch',
        isServerless: true,
        method: request.method,
        url: request.url,
        ...(requestId && { requestId }),
      });

      logger.error(
        'Worker fetch handler error.',
        error instanceof Error ? error : new Error(String(error)),
        errorContext,
      );

      // Return a user-friendly error response
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message:
            error instanceof Error
              ? error.message
              : 'An unknown error occurred',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  },

  /**
   * Handles scheduled/cron events.
   * Enable by adding cron triggers in wrangler.toml.
   * @example
   * [triggers]
   * crons = ["0 *\/6 * * *"]  # Run every 6 hours
   */
  async scheduled(
    event: ScheduledEvent,
    env: CloudflareBindings,
    _ctx: ExecutionContext,
  ): Promise<void> {
    try {
      // Initialize app to ensure services are ready
      await initializeApp(env);

      const scheduledContext = requestContextService.createRequestContext({
        operation: 'WorkerScheduled',
        isServerless: true,
        cron: event.cron,
      });

      logger.info('Processing scheduled event.', {
        ...scheduledContext,
        cron: event.cron,
        scheduledTime: new Date(event.scheduledTime).toISOString(),
      });

      // Add your scheduled task logic here
      // Example: Cleanup expired sessions, send reports, etc.
      // Use _ctx.waitUntil() for background operations if needed

      logger.info('Scheduled event completed.', scheduledContext);
    } catch (error: unknown) {
      const errorContext = requestContextService.createRequestContext({
        operation: 'WorkerScheduled',
        isServerless: true,
        cron: event.cron,
      });

      logger.error(
        'Worker scheduled handler error.',
        error instanceof Error ? error : new Error(String(error)),
        errorContext,
      );

      // Errors in scheduled handlers don't return responses
      // but should be logged for monitoring
    }
  },
};

/**
 * Type definition for scheduled event.
 */
interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
  type: 'scheduled';
}
