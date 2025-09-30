import OpenAI from 'openai';
import type { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses';
import type { Config } from '../config.js';
import type { ChatMessage, ChatToolMessage } from '../repositories/SessionStore.js';
import type { ShellToolDefinition } from '../types/tools.js';
import { retryWithBackoff, type RetryOptions } from '../utils/retry.js';

export interface OpenAIGenerateOptions {
  temperature?: number;
  maxOutputTokens?: number;
  tools?: ShellToolDefinition[];
}

export interface StreamChunk {
  delta: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface GenerateResponseResult {
  content?: string;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | 'error';
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
  ): Promise<GenerateResponseResult> {
    const startTime = Date.now();
    try {
      const input = this.convertMessagesToOpenAIFormat(messages);

      this.logger?.info('OpenAI API request initiated', {
        model: this.model,
        messageCount: messages.length,
        toolsEnabled: !!options.tools
      });

      const params: ResponseCreateParamsNonStreaming = {
        model: this.model,
        input,
        reasoning: { effort: 'minimal' },
        text: { verbosity: 'low' },
        max_output_tokens: options.maxOutputTokens ?? this.maxOutputTokens
      };

      // Add tools if provided
      // Note: The Responses API tool format is different from Chat Completions API
      if (options.tools && options.tools.length > 0) {
        params.tools = options.tools.map((tool) => ({
          type: 'function' as const,
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
          strict: false
        })) as any; // Type assertion needed due to SDK type mismatch
      }

      const response = await retryWithBackoff(
        async () => await this.client.responses.create(params),
        this.retryOptions
      );

      const duration = Date.now() - startTime;
      const tokenUsage = this.extractTokenUsage(response);

      this.logger?.info('OpenAI API request completed', {
        model: this.model,
        durationMs: duration,
        ...tokenUsage
      });

      return this.extractResponseResult(response);
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
            reasoning: { effort: 'minimal' },
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

  private convertMessagesToOpenAIFormat(
    messages: ChatMessage[]
  ): ResponseCreateParamsNonStreaming['input'] {
    const formatted = messages.map((msg) => {
      // Map our role types to OpenAI's role types
      let role: 'user' | 'assistant' | 'system';
      if (msg.role === 'system') {
        role = 'system';
      } else if (msg.role === 'user') {
        role = 'user';
      } else {
        // Treat assistant and tool outputs as assistant role for the OpenAI Responses API
        role = 'assistant';
      }

      const contentType = role === 'assistant' ? 'output_text' : 'input_text';

      return {
        role,
        type: 'message' as const,
        content: [
          {
            type: contentType,
            text: this.renderMessageContent(msg)
          }
        ]
      };
    });

    return formatted as ResponseCreateParamsNonStreaming['input'];
  }

  private renderMessageContent(message: ChatMessage): string {
    if (message.role === 'tool') {
      return this.renderToolMessageContent(message);
    }

    return message.content;
  }

  private renderToolMessageContent(message: ChatToolMessage): string {
    if (message.content) {
      return message.content;
    }

    const segments: string[] = [`Tool ${message.toolName} result:`];

    if (message.result?.status) {
      segments.push(`status: ${message.result.status}`);
    }

    if (message.result?.stdout) {
      segments.push(`stdout:\n${message.result.stdout}`);
    }

    if (message.result?.stderr) {
      segments.push(`stderr:\n${message.result.stderr}`);
    }

    if (message.result?.errorMessage) {
      segments.push(`error:\n${message.result.errorMessage}`);
    }

    if (message.result?.exitCode !== undefined) {
      segments.push(`exitCode: ${message.result.exitCode}`);
    }

    if (message.result?.truncated) {
      segments.push('output was truncated');
    }

    if (message.result?.durationMs !== undefined) {
      segments.push(`durationMs: ${message.result.durationMs}`);
    }

    if (message.result?.metadata) {
      segments.push(`metadata: ${JSON.stringify(message.result.metadata)}`);
    }

    return segments.join('\n\n');
  }

  private extractResponseResult(
    response: OpenAI.Responses.Response
  ): GenerateResponseResult {
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

    // Extract text content
    const textSegments = content
      .filter(
        (part): part is OpenAI.Responses.ResponseOutputText =>
          typeof part === 'object' &&
          part !== null &&
          'type' in part &&
          (part as { type: unknown }).type === 'output_text'
      )
      .map((part) => part.text);

    // Extract tool calls
    // Note: Responses API returns function_call items in content
    const toolCalls = content
      .filter(
        (part): boolean =>
          typeof part === 'object' &&
          part !== null &&
          'type' in part &&
          (part as { type: unknown }).type === 'function_call'
      )
      .map((part: any) => ({
        id: part.id || '',
        name: part.name || '',
        arguments: (part.arguments as Record<string, unknown>) || {}
      }));

    // Determine finish reason
    let finishReason: GenerateResponseResult['finishReason'] = 'stop';
    if (toolCalls.length > 0) {
      finishReason = 'tool_calls';
    }

    const result: GenerateResponseResult = {
      finishReason
    };

    if (textSegments.length > 0) {
      result.content = textSegments.join('');
    }

    if (toolCalls.length > 0) {
      result.toolCalls = toolCalls;
    }

    return result;
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
      await this.client.responses.create({
        model: this.model,
        input: 'ping',
        text: { verbosity: 'low' },
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
