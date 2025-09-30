import OpenAI from 'openai';
import type { Config } from '../config.js';
import type { ChatMessage } from '../repositories/SessionStore.js';
import { retryWithBackoff, type RetryOptions } from '../utils/retry.js';

export interface OpenAIGenerateOptions {
  temperature?: number;
  maxOutputTokens?: number;
}

export interface StreamChunk {
  delta: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface OpenAILogger {
  info: (msg: string, metadata?: Record<string, unknown>) => void;
  warn: (msg: string, metadata?: Record<string, unknown>) => void;
  error: (msg: string, metadata?: Record<string, unknown>) => void;
}

export interface HealthCheckResult {
  healthy: boolean;
  error?: string;
  latencyMs?: number;
}

export class OpenAIError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'OpenAIError';
  }
}

export class OpenAIRateLimitError extends OpenAIError {
  constructor(message: string, public readonly retryAfter?: number) {
    super(message);
    this.name = 'OpenAIRateLimitError';
  }
}

export class OpenAIService {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly maxOutputTokens?: number;
  private readonly retryOptions: RetryOptions;
  private readonly logger?: OpenAILogger;

  constructor(config: Config, logger?: OpenAILogger) {
    this.client = new OpenAI({
      apiKey: config.OPENAI_API_KEY
    });
    this.model = config.OPENAI_MODEL;
    this.maxOutputTokens = config.OPENAI_MAX_OUTPUT_TOKENS;
    this.logger = logger;
    this.retryOptions = {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      retryableStatusCodes: [429, 500, 502, 503, 504]
    };
  }

  async generateResponse(
    messages: ChatMessage[],
    options: OpenAIGenerateOptions = {}
  ): Promise<string> {
    const startTime = Date.now();
    try {
      const input = this.convertMessagesToOpenAIFormat(messages);

      this.logger?.info('OpenAI API request initiated', {
        model: this.model,
        messageCount: messages.length
      });

      const response = await retryWithBackoff(
        async () =>
          await this.client.responses.create({
            model: this.model,
            input,
            reasoning: { effort: 'low' },
            text: { verbosity: 'low' },
            max_output_tokens: options.maxOutputTokens ?? this.maxOutputTokens
          }),
        this.retryOptions
      );

      const duration = Date.now() - startTime;
      const tokenUsage = this.extractTokenUsage(response);

      this.logger?.info('OpenAI API request completed', {
        model: this.model,
        durationMs: duration,
        ...tokenUsage
      });

      return this.extractTextFromResponse(response);
    } catch (error) {
      const duration = Date.now() - startTime;

      // Check if it's a rate limit error
      if (this.isRateLimitError(error)) {
        const retryAfter = this.extractRetryAfter(error);
        this.logger?.warn('OpenAI rate limit exceeded', {
          model: this.model,
          durationMs: duration,
          retryAfter
        });
        throw new OpenAIRateLimitError(
          'OpenAI rate limit exceeded. Please try again later.',
          retryAfter
        );
      }

      this.logger?.error('OpenAI API request failed', {
        model: this.model,
        durationMs: duration,
        error: error instanceof Error ? error.message : String(error)
      });

      throw new OpenAIError('Failed to generate response from OpenAI', error);
    }
  }

  async *generateStreamingResponse(
    messages: ChatMessage[],
    options: OpenAIGenerateOptions = {}
  ): AsyncGenerator<StreamChunk, string, undefined> {
    const startTime = Date.now();
    try {
      const input = this.convertMessagesToOpenAIFormat(messages);

      this.logger?.info('OpenAI streaming API request initiated', {
        model: this.model,
        messageCount: messages.length
      });

      const stream = await retryWithBackoff(
        async () =>
          await this.client.responses.create({
            model: this.model,
            input,
            reasoning: { effort: 'low' },
            text: { verbosity: 'low' },
            max_output_tokens: options.maxOutputTokens ?? this.maxOutputTokens,
            stream: true
          }),
        this.retryOptions
      );

      let fullText = '';

      for await (const event of stream) {
        if (event.type === 'response.output_text.delta') {
          const delta = event.delta;
          fullText += delta;
          yield { delta };
        }
      }

      const duration = Date.now() - startTime;
      this.logger?.info('OpenAI streaming API request completed', {
        model: this.model,
        durationMs: duration,
        responseLength: fullText.length
      });

      return fullText;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Check if it's a rate limit error
      if (this.isRateLimitError(error)) {
        const retryAfter = this.extractRetryAfter(error);
        this.logger?.warn('OpenAI streaming rate limit exceeded', {
          model: this.model,
          durationMs: duration,
          retryAfter
        });
        throw new OpenAIRateLimitError(
          'OpenAI rate limit exceeded. Please try again later.',
          retryAfter
        );
      }

      this.logger?.error('OpenAI streaming API request failed', {
        model: this.model,
        durationMs: duration,
        error: error instanceof Error ? error.message : String(error)
      });

      throw new OpenAIError('Failed to generate streaming response from OpenAI', error);
    }
  }

  private convertMessagesToOpenAIFormat(messages: ChatMessage[]): Array<{
    role: 'user' | 'assistant' | 'system' | 'developer';
    content: Array<{ type: 'input_text'; text: string }>;
    type: 'message';
  }> {
    return messages.map((msg) => {
      // Map our role types to OpenAI's role types
      let role: 'user' | 'assistant' | 'system';
      if (msg.role === 'system') {
        role = 'system';
      } else if (msg.role === 'user') {
        role = 'user';
      } else {
        role = 'assistant';
      }

      return {
        role,
        type: 'message' as const,
        content: [
          {
            type: 'input_text' as const,
            text: msg.content
          }
        ]
      };
    });
  }

  private extractTextFromResponse(response: OpenAI.Responses.Response): string {
    const outputItems = response.output ?? [];

    if (outputItems.length === 0) {
      throw new OpenAIError('No output in OpenAI response');
    }

    const messageItem = outputItems.find(
      (item): item is OpenAI.Responses.ResponseOutputMessage => item.type === 'message'
    );

    if (!messageItem) {
      const availableTypes = outputItems
        .map((item) => ('type' in item ? String(item.type) : 'unknown'))
        .join(', ');
      throw new OpenAIError(
        `No message output in OpenAI response. Output item types: ${availableTypes || 'none'}`
      );
    }

    const content = messageItem.content;

    if (!Array.isArray(content) || content.length === 0) {
      throw new OpenAIError('No content in OpenAI message');
    }

    const textSegments = content
      .filter(
        (part): part is OpenAI.Responses.ResponseOutputText =>
          typeof part === 'object' &&
          part !== null &&
          'type' in part &&
          (part as { type: unknown }).type === 'output_text'
      )
      .map((part) => part.text);

    if (textSegments.length === 0) {
      throw new OpenAIError('No text content in OpenAI message');
    }

    return textSegments.join('');
  }

  private isRateLimitError(error: unknown): boolean {
    if (error && typeof error === 'object') {
      if ('status' in error && error.status === 429) return true;
      if ('statusCode' in error && error.statusCode === 429) return true;
      if ('error' in error && error.error && typeof error.error === 'object') {
        if ('status' in error.error && error.error.status === 429) return true;
      }
    }
    return false;
  }

  private extractRetryAfter(error: unknown): number | undefined {
    if (error && typeof error === 'object') {
      // Check for retry-after header in different possible locations
      if ('headers' in error && error.headers && typeof error.headers === 'object') {
        const headers = error.headers as Record<string, unknown>;
        if ('retry-after' in headers && typeof headers['retry-after'] === 'string') {
          const retryAfter = Number.parseInt(headers['retry-after'], 10);
          return Number.isNaN(retryAfter) ? undefined : retryAfter;
        }
      }
    }
    return undefined;
  }

  private extractTokenUsage(response: OpenAI.Responses.Response): TokenUsage | undefined {
    if (!response.usage) {
      return undefined;
    }

    return {
      promptTokens: response.usage.input_tokens ?? 0,
      completionTokens: response.usage.output_tokens ?? 0,
      totalTokens: response.usage.total_tokens ?? 0
    };
  }

  /**
   * Performs a health check by making a minimal API call to verify connectivity
   * and API key validity. Uses a short timeout to avoid blocking health checks.
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      // Make a minimal request to verify API connectivity
      const testMessage: ChatMessage = {
        id: 'health-check',
        role: 'user',
        content: 'ping',
        createdAt: new Date().toISOString()
      };

      // Don't use retry logic for health checks to get fast feedback
      const input = this.convertMessagesToOpenAIFormat([testMessage]);

      await this.client.responses.create({
        model: this.model,
        input,
        max_output_tokens: 5 // Minimal response
      });

      const latency = Date.now() - startTime;

      this.logger?.info('OpenAI health check passed', { latencyMs: latency });

      return {
        healthy: true,
        latencyMs: latency
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger?.warn('OpenAI health check failed', {
        latencyMs: latency,
        error: errorMessage
      });

      return {
        healthy: false,
        error: errorMessage,
        latencyMs: latency
      };
    }
  }
}
