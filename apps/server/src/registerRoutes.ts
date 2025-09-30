import { FastifyInstance } from 'fastify';
import { registerHealthRoute } from './routes/health.js';
import { registerSessionRoutes } from './routes/session.js';
import { registerChatRoutes } from './routes/chat.js';
import { registerStreamRoute } from './routes/streamChat.js';
import { registerFeedbackRoutes } from './routes/feedback.js';
import type { SessionStore } from './repositories/SessionStore.js';
import type { ConversationService } from './services/ConversationService.js';
import type { OpenAIService } from './services/OpenAIService.js';

export interface RouteDependencies {
  sessionStore: SessionStore;
  conversationService: ConversationService;
  openAIService: OpenAIService;
}

export async function registerRoutes(app: FastifyInstance, deps: RouteDependencies) {
  await registerHealthRoute(app, {
    openAIService: deps.openAIService,
    sessionStore: deps.sessionStore
  });
  await registerSessionRoutes(app, deps.sessionStore);
  await registerChatRoutes(app, deps.conversationService);
  await registerStreamRoute(app, deps.conversationService);
  await registerFeedbackRoutes(app);
}
