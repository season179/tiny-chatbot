import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';

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

  await app.register(websocket);

  app.get('/healthz', async () => ({ status: 'ok' }));

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

const isExecutedDirectly = () => {
  const directCaller = fileURLToPath(import.meta.url);
  const entryPoint = process.argv[1];
  return entryPoint ? directCaller === entryPoint : false;
};

if (isExecutedDirectly()) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
