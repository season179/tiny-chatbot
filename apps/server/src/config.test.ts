import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, resetConfig } from './config.js';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset config cache and environment for each test
    resetConfig();
    process.env = { ...originalEnv, OPENAI_API_KEY: 'sk-test-key' };
    delete process.env.SHELL_SANDBOX_ENABLED;
    delete process.env.SHELL_SANDBOX_ALLOWED_COMMANDS;
    delete process.env.SHELL_SANDBOX_WORKING_DIR;
    delete process.env.SHELL_SANDBOX_MAX_OUTPUT_BYTES;
    delete process.env.SHELL_SANDBOX_TIMEOUT_MS;
  });

  afterEach(() => {
    resetConfig();
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should load config with default values', () => {
      // Clear relevant env vars
      delete process.env.NODE_ENV;
      delete process.env.PORT;
      delete process.env.HOST;
      delete process.env.CORS_ORIGIN;
      delete process.env.CORS_CREDENTIALS;
      delete process.env.LOG_LEVEL;

      const config = loadConfig();

      expect(config.NODE_ENV).toBe('development');
      expect(config.PORT).toBe(4000);
      expect(config.HOST).toBe('0.0.0.0');
      expect(config.CORS_ORIGIN).toBe('*');
      expect(config.CORS_CREDENTIALS).toBe(false);
      expect(config.LOG_LEVEL).toBe('info');
      expect(config.SHELL_SANDBOX_ENABLED).toBe(false);
      expect(config.SHELL_SANDBOX_ALLOWED_COMMANDS).toEqual([
        'cat',
        'ls',
        'rg',
        'head',
        'tail'
      ]);
      expect(config.SHELL_SANDBOX_WORKING_DIR).toBe('./');
      expect(config.SHELL_SANDBOX_MAX_OUTPUT_BYTES).toBe(16384);
      expect(config.SHELL_SANDBOX_TIMEOUT_MS).toBe(5000);
    });

    it('should load config from environment variables', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8080';
      process.env.HOST = '127.0.0.1';
      process.env.CORS_ORIGIN = 'https://example.com';
      process.env.CORS_CREDENTIALS = 'true';
      process.env.LOG_LEVEL = 'debug';
      process.env.SHELL_SANDBOX_ENABLED = 'true';
      process.env.SHELL_SANDBOX_ALLOWED_COMMANDS = 'ls,cat';
      process.env.SHELL_SANDBOX_WORKING_DIR = '/tmp';
      process.env.SHELL_SANDBOX_MAX_OUTPUT_BYTES = '4096';
      process.env.SHELL_SANDBOX_TIMEOUT_MS = '2500';

      const config = loadConfig();

      expect(config.NODE_ENV).toBe('production');
      expect(config.PORT).toBe(8080);
      expect(config.HOST).toBe('127.0.0.1');
      expect(config.CORS_ORIGIN).toBe('https://example.com');
      expect(config.CORS_CREDENTIALS).toBe(true);
      expect(config.LOG_LEVEL).toBe('debug');
      expect(config.SHELL_SANDBOX_ENABLED).toBe(true);
      expect(config.SHELL_SANDBOX_ALLOWED_COMMANDS).toEqual(['ls', 'cat']);
      expect(config.SHELL_SANDBOX_WORKING_DIR).toBe('/tmp');
      expect(config.SHELL_SANDBOX_MAX_OUTPUT_BYTES).toBe(4096);
      expect(config.SHELL_SANDBOX_TIMEOUT_MS).toBe(2500);
    });

    it('should coerce PORT to number', () => {
      process.env.PORT = '3000';

      const config = loadConfig();

      expect(typeof config.PORT).toBe('number');
      expect(config.PORT).toBe(3000);
    });

    it('should coerce CORS_CREDENTIALS to boolean', () => {
      process.env.CORS_CREDENTIALS = 'true';
      const config1 = loadConfig();
      expect(config1.CORS_CREDENTIALS).toBe(true);

      // Reset for second test
      resetConfig();
      process.env = { ...originalEnv };
      process.env.CORS_CREDENTIALS = 'false';
      const config2 = loadConfig();
      expect(config2.CORS_CREDENTIALS).toBe(false);
    });

    it('should throw error for invalid PORT (too high)', () => {
      process.env.PORT = '99999';

      expect(() => loadConfig()).toThrow('Invalid configuration');
    });

    it('should throw error for invalid PORT (zero)', () => {
      process.env.PORT = '0';

      expect(() => loadConfig()).toThrow('Invalid configuration');
    });

    it('should throw error for invalid PORT (negative)', () => {
      process.env.PORT = '-100';

      expect(() => loadConfig()).toThrow('Invalid configuration');
    });

    it('should accept valid PORT values', () => {
      process.env.PORT = '1';
      const config1 = loadConfig();
      expect(config1.PORT).toBe(1);

      resetConfig();
      process.env = { ...originalEnv };
      process.env.PORT = '65535';
      const config2 = loadConfig();
      expect(config2.PORT).toBe(65535);

      resetConfig();
      process.env = { ...originalEnv };
      process.env.PORT = '8080';
      const config3 = loadConfig();
      expect(config3.PORT).toBe(8080);
    });

    it('should throw error for invalid NODE_ENV', () => {
      process.env.NODE_ENV = 'invalid';

      expect(() => loadConfig()).toThrow('Invalid configuration');
    });

    it('should accept valid NODE_ENV values', () => {
      process.env.NODE_ENV = 'development';
      const config1 = loadConfig();
      expect(config1.NODE_ENV).toBe('development');

      resetConfig();
      process.env = { ...originalEnv };
      process.env.NODE_ENV = 'production';
      const config2 = loadConfig();
      expect(config2.NODE_ENV).toBe('production');

      resetConfig();
      process.env = { ...originalEnv };
      process.env.NODE_ENV = 'test';
      const config3 = loadConfig();
      expect(config3.NODE_ENV).toBe('test');
    });

    it('should throw error for invalid LOG_LEVEL', () => {
      process.env.LOG_LEVEL = 'invalid';

      expect(() => loadConfig()).toThrow('Invalid configuration');
    });

    it('should accept all valid LOG_LEVEL values', () => {
      const levels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];

      for (const level of levels) {
        resetConfig();
        process.env = { ...originalEnv };
        process.env.LOG_LEVEL = level;
        const config = loadConfig();
        expect(config.LOG_LEVEL).toBe(level);
      }
    });
  });
});
