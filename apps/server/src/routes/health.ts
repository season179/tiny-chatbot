import { FastifyInstance } from 'fastify';

export async function registerHealthRoute(app: FastifyInstance) {
  app.get('/healthz', async () => ({ status: 'ok' }));
}
