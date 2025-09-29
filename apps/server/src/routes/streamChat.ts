import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const streamSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1)
});

const cannedChunks = (message: string) => [
  'Thanks for reaching out. ',
  `You said: "${message}". `,
  'Real streaming will arrive once the LLM integration lands.'
];

export async function registerStreamRoute(app: FastifyInstance) {
  app.post('/api/chat/stream', { websocket: false }, async (request, reply) => {
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

    const chunks = cannedChunks(parseResult.data.message);

    for (const chunk of chunks) {
      reply.raw.write(`data: ${JSON.stringify({ type: 'chunk', data: chunk })}\n\n`);
    }

    reply.raw.write('data: {"type":"done"}\n\n');
    reply.raw.end();

    return reply;
  });
}
