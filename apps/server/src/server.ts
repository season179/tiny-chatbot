import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { loadConfig, getConfig } from './config.js';
import { registerRoutes } from './registerRoutes.js';
import { SqliteSessionStore } from './repositories/SqliteSessionStore.js';
import { ConversationService } from './services/ConversationService.js';
import { OpenAIService } from './services/OpenAIService.js';
import { PromptService } from './services/PromptService.js';
import { ShellToolService } from './services/ShellToolService.js';
import { type ToolsConfig, SHELL_TOOL_DEFINITIONS } from './config/toolsConfig.js';
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
    credentials: config.CORS_CREDENTIALS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Type']
  });

  const sessionStore = new SqliteSessionStore();
  const openAIService = new OpenAIService(config, app.log);

  // Initialize PromptService (optional - gracefully handles missing config file)
  let promptService: PromptService | undefined;
  try {
    promptService = new PromptService();
    app.log.info('PromptService initialized with custom prompts');
  } catch (error) {
    app.log.warn('PromptService not initialized - using default behavior without system prompts');
  }

  // Initialize ShellToolService with environment-based configuration
  const toolsConfig: ToolsConfig = {
    workingDirRoot: config.SHELL_SANDBOX_WORKING_DIR, // Must be absolute path
    maxOutputBytes: config.SHELL_SANDBOX_MAX_OUTPUT_BYTES,
    executionTimeoutMs: config.SHELL_SANDBOX_TIMEOUT_MS
  };
  
  const shellToolService = new ShellToolService(toolsConfig, app.log);
  
  // Validate sandbox directory exists if shell tools are enabled
  if (config.SHELL_SANDBOX_ENABLED) {
    try {
      shellToolService.validateWorkingDirectory();
    } catch (error) {
      app.log.fatal(
        'Failed to start: Shell sandbox is enabled but the working directory is invalid.\n' +
        'Please fix SHELL_SANDBOX_WORKING_DIR in your .env file or set SHELL_SANDBOX_ENABLED=false'
      );
      throw error; // This will cause the server to exit
    }
  }
  
  app.log.info(
    'ShellToolService initialized with tools: ' +
      `${SHELL_TOOL_DEFINITIONS.map((t) => t.name).join(', ')} ` +
      `(enabled: ${config.SHELL_SANDBOX_ENABLED}, workingDir: ${toolsConfig.workingDirRoot})`
  );

  const conversationService = new ConversationService(
    sessionStore,
    openAIService,
    promptService,
    shellToolService,
    SHELL_TOOL_DEFINITIONS,
    { maxToolRounds: config.MAX_TOOL_ROUNDS }
  );

  await registerRoutes(app, { sessionStore, conversationService, openAIService });

  // Handle graceful shutdown
  app.addHook('onClose', async () => {
    app.log.info('Closing database connection...');
    closeDatabase();
    app.log.info('Database connection closed');
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
  const app = await startServer();

  // Handle graceful shutdown on SIGINT (Ctrl+C) and SIGTERM
  const gracefulShutdown = async (signal: string) => {
    app.log.info(`${signal} received, starting graceful shutdown...`);
    
    try {
      await app.close();
      app.log.info('Server closed gracefully');
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}
