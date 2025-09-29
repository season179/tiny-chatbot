import { FastifyInstance } from 'fastify';
import { registerHealthRoute } from './routes/health.js';
import { registerSessionRoutes } from './routes/session.js';
import { registerChatRoutes } from './routes/chat.js';
import { registerStreamRoute } from './routes/streamChat.js';
import { registerFeedbackRoutes } from './routes/feedback.js';

export async function registerRoutes(app: FastifyInstance) {
  await registerHealthRoute(app);
  await registerSessionRoutes(app);
  await registerChatRoutes(app);
  await registerStreamRoute(app);
  await registerFeedbackRoutes(app);
}
