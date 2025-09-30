import { z } from 'zod';

const configSchema = z.object({
  // Server settings
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('0.0.0.0'),

  // CORS settings
  CORS_ORIGIN: z.string().default('*'),
  CORS_CREDENTIALS: z.coerce.boolean().default(false),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Future: LLM settings (placeholders for when integrating real LLM)
  // LLM_API_KEY: z.string().optional(),
  // LLM_MODEL: z.string().optional(),
  // LLM_MAX_TOKENS: z.coerce.number().optional(),
});

export type Config = z.infer<typeof configSchema>;

let cachedConfig: Config | null = null;

export function loadConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const parseResult = configSchema.safeParse(process.env);

  if (!parseResult.success) {
    const errors = parseResult.error.flatten();
    console.error('Configuration validation failed:');
    console.error(JSON.stringify(errors, null, 2));
    throw new Error('Invalid configuration. Please check your environment variables.');
  }

  cachedConfig = parseResult.data;
  return cachedConfig;
}

export function getConfig(): Config {
  if (!cachedConfig) {
    throw new Error('Configuration has not been loaded. Call loadConfig() first.');
  }
  return cachedConfig;
}