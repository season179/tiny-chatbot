import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ConversationService } from '../services/ConversationService.js';
import { SessionNotFoundError } from '../services/ConversationService.js';

const streamSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1)
});

export async function registerStreamRoute(app: FastifyInstance, conversationService: ConversationService) {
  app.post('/api/chat/stream', async (request, reply) => {
    const parseResult = streamSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'INVALID_REQUEST',
        details: parseResult.error.flatten()
      });
    }

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');

    try {
      const result = conversationService.handleUserMessageStreaming({
        sessionId: parseResult.data.sessionId,
        message: parseResult.data.message
      });

      for (const chunk of result.chunks) {
        reply.raw.write(`data: ${JSON.stringify({ type: 'chunk', data: chunk })}\n\n`);
      }

      reply.raw.write(
        `data: ${JSON.stringify({ type: 'completed', message: result.assistantMessage })}\n\n`
      );
      reply.raw.end();
      return reply;
    } catch (error) {
      if (error instanceof SessionNotFoundError) {
        reply.code(404);
        reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: 'SESSION_NOT_FOUND' })}\n\n`);
        reply.raw.end();
        return reply;
      }

      app.log.error({ err: error }, 'Failed to stream chat message');
      reply.code(500);
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: 'INTERNAL_SERVER_ERROR' })}\n\n`);
      reply.raw.end();
      return reply;
    }
  });
}
