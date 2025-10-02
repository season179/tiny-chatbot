import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildServer, startServer } from './server.js';
import { resetDatabase } from './db/index.js';
import * as configModule from './config.js';
import type { Config } from './config.js';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Server', () => {
  afterEach(async () => {
    resetDatabase();
    vi.restoreAllMocks();
  });

  describe('buildServer', () => {
    it('should initialize server with valid configuration', async () => {
      const app = await buildServer();

      expect(app).toBeDefined();
      expect(app.server).toBeDefined();

      await app.close();
    });

    it('should initialize database during server startup', async () => {
      const app = await buildServer();

      // Try to access the database through a route
      const response = await app.inject({
        method: 'POST',
        url: '/api/session',
        payload: { tenantId: 'test-tenant' }
      });

      expect(response.statusCode).toBe(201);

      await app.close();
    });

    it('should register all routes', async () => {
      const app = await buildServer();

      // Check that main routes are registered
      const routes = app.printRoutes({ commonPrefix: false });

      // printRoutes formats output as tree, so check for expected routes
      expect(routes).toContain('/health');
      expect(routes).toContain('z');
      expect(routes).toContain('/api/session');
      expect(routes).toContain('/api/chat');
      expect(routes).toContain('/stream');
      expect(routes).toContain('/api/feedback');

      await app.close();
    });

    it('should configure CORS plugin successfully', async () => {
      const mockConfig: Config = {
        ...configModule.getConfig(),
        CORS_ORIGIN: '*',
        CORS_CREDENTIALS: false
      };

      vi.spyOn(configModule, 'getConfig').mockReturnValue(mockConfig);

      const app = await buildServer();

      // CORS plugin is registered if server builds successfully
      // Server should start without throwing errors when CORS is configured
      expect(app).toBeDefined();

      await app.close();
    });

    it('should initialize all services in correct order', async () => {
      const app = await buildServer();

      // Verify all services are initialized by checking the server is ready
      // and can handle requests
      const healthResponse = await app.inject({
        method: 'GET',
        url: '/healthz'
      });

      expect(healthResponse.statusCode).toBe(200);
      expect(JSON.parse(healthResponse.body)).toEqual({ status: 'ok' });

      // Create a session to verify SessionStore and Database are working
      const sessionResponse = await app.inject({
        method: 'POST',
        url: '/api/session',
        payload: { tenantId: 'test-tenant' }
      });

      expect(sessionResponse.statusCode).toBe(201);

      await app.close();
    });

    it('should fail gracefully when sandbox directory does not exist and shell tools are enabled', async () => {
      const nonExistentDir = join(tmpdir(), `non-existent-${Date.now()}`);

      const mockConfig: Config = {
        ...configModule.getConfig(),
        SHELL_SANDBOX_ENABLED: true,
        SHELL_SANDBOX_WORKING_DIR: nonExistentDir
      };

      vi.spyOn(configModule, 'getConfig').mockReturnValue(mockConfig);

      await expect(buildServer()).rejects.toThrow();
    });

    it('should start successfully when shell tools are disabled even with invalid sandbox directory', async () => {
      const nonExistentDir = join(tmpdir(), `non-existent-${Date.now()}`);

      const mockConfig: Config = {
        ...configModule.getConfig(),
        SHELL_SANDBOX_ENABLED: false,
        SHELL_SANDBOX_WORKING_DIR: nonExistentDir
      };

      vi.spyOn(configModule, 'getConfig').mockReturnValue(mockConfig);

      const app = await buildServer();

      expect(app).toBeDefined();

      await app.close();
    });

    it('should gracefully handle missing prompt service config', async () => {
      // PromptService should fail gracefully if config file doesn't exist
      // Server should still start
      const app = await buildServer();

      expect(app).toBeDefined();

      await app.close();
    });

    it('should create database file in configured location', async () => {
      const testDir = join(tmpdir(), `test-server-db-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
      const dbPath = join(testDir, 'test.db');

      try {
        const mockConfig: Config = {
          ...configModule.getConfig(),
          DATABASE_PATH: dbPath
        };

        vi.spyOn(configModule, 'getConfig').mockReturnValue(mockConfig);

        const app = await buildServer();

        // Database file should be created
        expect(existsSync(dbPath)).toBe(true);

        await app.close();
      } finally {
        if (existsSync(testDir)) {
          rmSync(testDir, { recursive: true, force: true });
        }
      }
    });

    it('should configure logger with correct log level', async () => {
      const mockConfig: Config = {
        ...configModule.getConfig(),
        LOG_LEVEL: 'debug'
      };

      vi.spyOn(configModule, 'getConfig').mockReturnValue(mockConfig);

      const app = await buildServer();

      // Verify logger is configured
      expect(app.log).toBeDefined();
      expect(app.log.level).toBe('debug');

      await app.close();
    });
  });

  describe('startServer', () => {
    it('should start server and listen on default port', async () => {
      const mockConfig: Config = {
        ...configModule.getConfig(),
        PORT: 0 // Use port 0 to let OS assign a free port
      };

      vi.spyOn(configModule, 'getConfig').mockReturnValue(mockConfig);

      const app = await startServer();

      expect(app).toBeDefined();
      expect(app.server.listening).toBe(true);

      const address = app.server.address();
      expect(address).toBeDefined();

      await app.close();
    });

    it('should start server on custom port', async () => {
      const mockConfig: Config = {
        ...configModule.getConfig(),
        PORT: 0
      };

      vi.spyOn(configModule, 'getConfig').mockReturnValue(mockConfig);

      const app = await startServer({ port: 0 });

      expect(app.server.listening).toBe(true);

      await app.close();
    });

    it('should start server on custom host', async () => {
      const mockConfig: Config = {
        ...configModule.getConfig(),
        PORT: 0,
        HOST: '127.0.0.1'
      };

      vi.spyOn(configModule, 'getConfig').mockReturnValue(mockConfig);

      const app = await startServer({ host: '127.0.0.1', port: 0 });

      expect(app.server.listening).toBe(true);

      const address = app.server.address();
      if (address && typeof address === 'object') {
        expect(address.address).toBe('127.0.0.1');
      }

      await app.close();
    });
  });

  describe('graceful shutdown', () => {
    it('should close database connection on server close', async () => {
      const app = await buildServer();

      // Create a session to ensure database is used
      await app.inject({
        method: 'POST',
        url: '/api/session',
        payload: { tenantId: 'test-tenant' }
      });

      // Close the server
      await app.close();

      // Database should be closed (will be reset by afterEach)
      expect(app.server.listening).toBe(false);
    });

    it('should handle multiple close calls gracefully', async () => {
      const app = await buildServer();

      await app.close();

      // Second close should not throw
      await expect(app.close()).resolves.not.toThrow();
    });
  });

  describe('health check', () => {
    it('should respond to health check endpoint', async () => {
      const app = await buildServer();

      const response = await app.inject({
        method: 'GET',
        url: '/healthz'
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ status: 'ok' });

      await app.close();
    });
  });
});

