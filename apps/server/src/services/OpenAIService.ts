import OpenAI from 'openai';
import type { Config } from '../config.js';
import type { ChatMessage } from '../repositories/SessionStore.js';

export interface OpenAIGenerateOptions {
  temperature?: number;
  maxOutputTokens?: number;
}

export interface StreamChunk {
  delta: string;
}

export class OpenAIError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'OpenAIError';
  }
}

export class OpenAIService {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly defaultTemperature: number;
  private readonly maxOutputTokens?: number;

  constructor(config: Config) {
    this.client = new OpenAI({
      apiKey: config.OPENAI_API_KEY
    });
    this.model = config.OPENAI_MODEL;
    this.defaultTemperature = config.OPENAI_TEMPERATURE;
    this.maxOutputTokens = config.OPENAI_MAX_OUTPUT_TOKENS;
  }

  async generateResponse(
    messages: ChatMessage[],
    options: OpenAIGenerateOptions = {}
  ): Promise<string> {
    try {
      const input = this.convertMessagesToOpenAIFormat(messages);

      const response = await this.client.responses.create({
        model: this.model,
        input,
        temperature: options.temperature ?? this.defaultTemperature,
        max_output_tokens: options.maxOutputTokens ?? this.maxOutputTokens
      });

      return this.extractTextFromResponse(response);
    } catch (error) {
      throw new OpenAIError('Failed to generate response from OpenAI', error);
    }
  }

  async *generateStreamingResponse(
    messages: ChatMessage[],
    options: OpenAIGenerateOptions = {}
  ): AsyncGenerator<StreamChunk, string, undefined> {
    try {
      const input = this.convertMessagesToOpenAIFormat(messages);

      const stream = await this.client.responses.create({
        model: this.model,
        input,
        temperature: options.temperature ?? this.defaultTemperature,
        max_output_tokens: options.maxOutputTokens ?? this.maxOutputTokens,
        stream: true
      });

      let fullText = '';

      for await (const event of stream) {
        if (event.type === 'response.output_text.delta') {
          const delta = event.delta;
          fullText += delta;
          yield { delta };
        }
      }

      return fullText;
    } catch (error) {
      throw new OpenAIError('Failed to generate streaming response from OpenAI', error);
    }
  }

  private convertMessagesToOpenAIFormat(messages: ChatMessage[]): Array<{
    role: 'user' | 'assistant' | 'system' | 'developer';
    content: string;
  }> {
    return messages.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
  }

  private extractTextFromResponse(response: OpenAI.Responses.Response): string {
    const output = response.output;

    if (!output || output.length === 0) {
      throw new OpenAIError('No output in OpenAI response');
    }

    const firstMessage = output[0];

    if (firstMessage.type !== 'message') {
      throw new OpenAIError(`Unexpected output type: ${firstMessage.type}`);
    }

    const content = firstMessage.content;

    if (!content || content.length === 0) {
      throw new OpenAIError('No content in OpenAI message');
    }

    const textContent = content.find((c) => c.type === 'output_text');

    if (!textContent || textContent.type !== 'output_text') {
      throw new OpenAIError('No text content in OpenAI message');
    }

    return textContent.text;
  }
}