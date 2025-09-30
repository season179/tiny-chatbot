import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ConversationService } from '../services/ConversationService.js';
import { SessionNotFoundError } from '../services/ConversationService.js';

const chatRequestSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),
  metadata: z.record(z.any()).optional()
});

export async function registerChatRoutes(app: FastifyInstance, conversationService: ConversationService) {
  app.post('/api/chat', async (request, reply) => {
    const parseResult = chatRequestSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'INVALID_REQUEST',
        details: parseResult.error.flatten()
      });
    }

    try {
      const { assistantMessage, sessionId } = conversationService.handleUserMessage({
        sessionId: parseResult.data.sessionId,
        message: parseResult.data.message
      });

      return reply.send({
        sessionId,
        message: assistantMessage
      });
    } catch (error) {
      if (error instanceof SessionNotFoundError) {
        return reply.status(404).send({ error: 'SESSION_NOT_FOUND' });
      }

      app.log.error({ err: error }, 'Failed to handle chat message');
      return reply.status(500).send({ error: 'INTERNAL_SERVER_ERROR' });
    }
  });
}
