import { z } from 'zod';

const configSchema = z.object({
  // Server settings
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('0.0.0.0'),

  // CORS settings
  CORS_ORIGIN: z.string().default('*'),
  CORS_CREDENTIALS: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // OpenAI settings
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_MODEL: z.string().default('gpt-5'),
  OPENAI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().optional(),
  OPENAI_TEMPERATURE: z.coerce.number().min(0).max(2).default(1.0),
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

// For testing purposes only
export function resetConfig(): void {
  cachedConfig = null;
}