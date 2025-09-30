import { FastifyInstance } from 'fastify';
import { createSessionRequestSchema } from '@tiny-chatbot/shared';
import type { SessionStore } from '../repositories/SessionStore.js';

export async function registerSessionRoutes(app: FastifyInstance, sessionStore: SessionStore) {
  app.post('/api/session', async (request, reply) => {
    const parseResult = createSessionRequestSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'INVALID_REQUEST',
        details: parseResult.error.flatten()
      });
    }

    const session = sessionStore.createSession(parseResult.data);

    return reply.status(201).send({
      sessionId: session.id,
      tenantId: session.tenantId,
      userId: session.userId,
      createdAt: session.createdAt
    });
  });
}
