import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

const createSessionSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().optional(),
  traits: z.record(z.any()).optional()
});

export async function registerSessionRoutes(app: FastifyInstance) {
  app.post('/api/session', async (request, reply) => {
    const parseResult = createSessionSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'INVALID_REQUEST',
        details: parseResult.error.flatten()
      });
    }

    const sessionId = randomUUID();

    return reply.status(201).send({
      sessionId,
      tenantId: parseResult.data.tenantId,
      createdAt: new Date().toISOString()
    });
  });
}
