import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { config as loadEnv } from 'dotenv';
import { loadConfig, getConfig } from './config.js';
import { registerRoutes } from './registerRoutes.js';
import { SqliteSessionStore } from './repositories/SqliteSessionStore.js';
import { ConversationService } from './services/ConversationService.js';
import { OpenAIService } from './services/OpenAIService.js';
import { initDatabase, closeDatabase } from './db/index.js';

loadEnv();
loadConfig();

export interface ServerOptions {
  port?: number;
  host?: string;
}

export async function buildServer(): Promise<FastifyInstance> {
  const config = getConfig();

  // Initialize database
  initDatabase({
    path: config.DATABASE_PATH,
    runMigrations: false // Migrations should be run separately via db:migrate
  });

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL
    }
  });

  await app.register(cors, {
    origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN,
    credentials: config.CORS_CREDENTIALS
  });

  const sessionStore = new SqliteSessionStore();
  const openAIService = new OpenAIService(config);
  const conversationService = new ConversationService(sessionStore, openAIService);

  await registerRoutes(app, { sessionStore, conversationService });

  // Handle graceful shutdown
  app.addHook('onClose', async () => {
    closeDatabase();
  });

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
