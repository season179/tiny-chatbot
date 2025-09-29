import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const feedbackSchema = z.object({
  sessionId: z.string().min(1),
  messageId: z.string().min(1),
  score: z.enum(['up', 'down']),
  comments: z.string().max(1000).optional()
});

export async function registerFeedbackRoutes(app: FastifyInstance) {
  app.post('/api/feedback', async (request, reply) => {
    const parsed = feedbackSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'INVALID_REQUEST',
        details: parsed.error.flatten()
      });
    }

    return reply.status(202).send({ status: 'RECEIVED' });
  });
}
