import { FastifyInstance } from 'fastify';
import { feedbackRequestSchema } from '@tiny-chatbot/shared';

export async function registerFeedbackRoutes(app: FastifyInstance) {
  app.post('/api/feedback', async (request, reply) => {
    const parsed = feedbackRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'INVALID_REQUEST',
        details: parsed.error.flatten()
      });
    }

    return reply.status(202).send({ status: 'RECEIVED' });
  });
}
