import { FastifyInstance } from 'fastify';
import type { OpenAIService } from '../services/OpenAIService.js';
import type { SessionStore } from '../repositories/SessionStore.js';

export interface HealthRouteOptions {
  openAIService: OpenAIService;
  sessionStore: SessionStore;
}

export async function registerHealthRoute(
  app: FastifyInstance,
  options?: HealthRouteOptions
) {
  app.get('/healthz', async () => ({ status: 'ok' }));

  // Detailed health check endpoint
  if (options) {
    app.get('/health', async (request, reply) => {
      const checks: Record<string, unknown> = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'unknown',
        openai: 'unknown'
      };

      let isHealthy = true;

      // Check database connectivity
      try {
        // Try to perform a simple operation to verify database is accessible
        const testSessionId = `health-check-${Date.now()}`;
        const testSession = options.sessionStore.createSession({
          tenantId: 'health-check',
          userId: 'health-check'
        });
        // Clean up the test session
        // Note: SessionStore doesn't have a delete method yet, but this verifies connectivity
        checks.database = 'healthy';
      } catch (error) {
        checks.database = 'unhealthy';
        checks.databaseError = error instanceof Error ? error.message : String(error);
        isHealthy = false;
      }

      // Check OpenAI connectivity
      try {
        const healthCheckResult = await options.openAIService.healthCheck();
        checks.openai = healthCheckResult.healthy ? 'healthy' : 'unhealthy';
        if (!healthCheckResult.healthy) {
          checks.openaiError = healthCheckResult.error;
          isHealthy = false;
        }
      } catch (error) {
        checks.openai = 'unhealthy';
        checks.openaiError = error instanceof Error ? error.message : String(error);
        isHealthy = false;
      }

      checks.status = isHealthy ? 'healthy' : 'degraded';
      reply.code(isHealthy ? 200 : 503).send(checks);
    });
  }
}
