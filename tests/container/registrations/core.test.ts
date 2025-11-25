/**
 * @fileoverview Tests for core service registration.
 * @module tests/container/registrations/core.test.ts
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { container } from 'tsyringe';
import { registerCoreServices } from '@/container/registrations/core.js';
import { AppConfig, Logger, RateLimiterService } from '@/container/tokens.js';

describe('Core Service Registration', () => {
  beforeAll(() => {
    registerCoreServices();
  });

  describe('registerCoreServices', () => {
    it('should register AppConfig as a value', () => {
      const config = container.resolve(AppConfig) as ReturnType<
        typeof import('@/config/index.js').parseConfig
      >;

      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
      expect(config.mcpServerName).toBeDefined();
      expect(config.mcpServerVersion).toBeDefined();
    });

    it('should register Logger as a value', () => {
      const logger = container.resolve(
        Logger,
      ) as typeof import('@/utils/index.js').logger;

      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warning).toBe('function');
    });

    it('should register RateLimiterService as singleton', () => {
      const rateLimiter1 = container.resolve(
        RateLimiterService,
      ) as import('@/utils/security/rateLimiter.js').RateLimiter;
      const rateLimiter2 = container.resolve(
        RateLimiterService,
      ) as import('@/utils/security/rateLimiter.js').RateLimiter;

      expect(rateLimiter1).toBeDefined();
      expect(rateLimiter1).toBe(rateLimiter2); // Same instance
    });

    it('should resolve same AppConfig instance multiple times', () => {
      const config1 = container.resolve(AppConfig) as ReturnType<
        typeof import('@/config/index.js').parseConfig
      >;
      const config2 = container.resolve(AppConfig) as ReturnType<
        typeof import('@/config/index.js').parseConfig
      >;

      expect(config1).toBe(config2);
    });
  });

  describe('Error Handling', () => {
    it('should register services even with minimal configuration', () => {
      // All essential services should be registered
      expect(() => container.resolve(AppConfig)).not.toThrow();
      expect(() => container.resolve(Logger)).not.toThrow();
    });
  });
});
