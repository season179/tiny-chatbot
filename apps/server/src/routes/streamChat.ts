import { FastifyInstance } from 'fastify';
import { streamChatRequestSchema } from '@tiny-chatbot/shared';
import type { ConversationService } from '../services/ConversationService.js';
import { SessionNotFoundError } from '../services/ConversationService.js';

export async function registerStreamRoute(app: FastifyInstance, conversationService: ConversationService) {
  app.post('/api/chat/stream', async (request, reply) => {
    const parseResult = streamChatRequestSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'INVALID_REQUEST',
        details: parseResult.error.flatten()
      });
    }

    // Hijack the reply to take full control of the response lifecycle
    reply.hijack();

    // Set CORS headers manually for streaming response
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    reply.raw.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');

    try {
      const streamStart = Date.now();
      let chunkCount = 0;
      app.log.info(`[StreamRoute ${streamStart}] Starting to consume conversation service generator...`);

      const generator = conversationService.handleUserMessageStreaming({
        sessionId: parseResult.data.sessionId,
        message: parseResult.data.message
      });

      for await (const event of generator) {
        const elapsed = Date.now() - streamStart;

        if ('type' in event && event.type === 'completed') {
          // Final completion event with assistant message
          app.log.info(`[StreamRoute +${elapsed}ms] Sending completion event (received ${chunkCount} chunks total)`);
          reply.raw.write(
            `data: ${JSON.stringify({ type: 'completed', message: event.assistantMessage })}\n\n`
          );
        } else {
          // Stream chunk
          chunkCount++;
          const chunkPreview = event.delta.substring(0, 30).replace(/\n/g, '\\n');
          app.log.info(`[StreamRoute +${elapsed}ms] Chunk #${chunkCount} received, sending to client: "${chunkPreview}..."`);

          const writeStart = Date.now();
          reply.raw.write(`data: ${JSON.stringify({ type: 'chunk', data: event.delta })}\n\n`);
          const writeDuration = Date.now() - writeStart;

          if (writeDuration > 5) {
            app.log.warn(`[StreamRoute +${elapsed}ms] Slow write detected: ${writeDuration}ms`);
          }
        }
      }

      const totalDuration = Date.now() - streamStart;
      app.log.info(`[StreamRoute +${totalDuration}ms] Stream completed, ending response`);
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
