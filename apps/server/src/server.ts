import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { config as loadEnv } from 'dotenv';
import { registerRoutes } from './registerRoutes.js';

loadEnv();

export interface ServerOptions {
  port?: number;
  host?: string;
}

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true
  });

  await app.register(cors, {
    origin: true
  });

  await registerRoutes(app);

  return app;
}

export async function startServer(options: ServerOptions = {}): Promise<FastifyInstance> {
  const app = await buildServer();
  const port = options.port ?? Number(process.env.PORT ?? 4000);
  const host = options.host ?? process.env.HOST ?? '0.0.0.0';

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
