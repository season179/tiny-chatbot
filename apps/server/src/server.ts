import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { config as loadEnv } from 'dotenv';
import { loadConfig, getConfig } from './config.js';
import { registerRoutes } from './registerRoutes.js';
import { InMemorySessionStore } from './repositories/InMemorySessionStore.js';
import { ConversationService } from './services/ConversationService.js';

loadEnv();
loadConfig();

export interface ServerOptions {
  port?: number;
  host?: string;
}

export async function buildServer(): Promise<FastifyInstance> {
  const config = getConfig();

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL
    }
  });

  await app.register(cors, {
    origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN,
    credentials: config.CORS_CREDENTIALS
  });

  const sessionStore = new InMemorySessionStore();
  const conversationService = new ConversationService(sessionStore);

  await registerRoutes(app, { sessionStore, conversationService });

  return app;
}

export async function startServer(options: ServerOptions = {}): Promise<FastifyInstance> {
  const config = getConfig();
  const app = await buildServer();
  const port = options.port ?? config.PORT;
  const host = options.host ?? config.HOST;

  await app.listen({ port, host });
  app.log.info(`Server listening on http://${host}:${port}`);
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
