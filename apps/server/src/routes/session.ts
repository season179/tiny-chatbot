import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { SessionStore } from '../repositories/SessionStore.js';

const createSessionSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().optional(),
  traits: z.record(z.any()).optional()
});

export async function registerSessionRoutes(app: FastifyInstance, sessionStore: SessionStore) {
  app.post('/api/session', async (request, reply) => {
    const parseResult = createSessionSchema.safeParse(request.body);

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
