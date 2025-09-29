import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const chatRequestSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),
  metadata: z.record(z.any()).optional()
});

const cannedAssistantReply = (message: string) =>
  `Thanks for sharing: "${message}". I am a placeholder assistant response.`;

export async function registerChatRoutes(app: FastifyInstance) {
  app.post('/api/chat', async (request, reply) => {
    const parseResult = chatRequestSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'INVALID_REQUEST',
        details: parseResult.error.flatten()
      });
    }

    const { sessionId, message } = parseResult.data;

    const assistantMessage = cannedAssistantReply(message);

    return reply.send({
      sessionId,
      message: {
        id: `${sessionId}-response-${Date.now()}`,
        role: 'assistant',
        content: assistantMessage,
        createdAt: new Date().toISOString()
      }
    });
  });
}
