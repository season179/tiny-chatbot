import { describe, it, expect, vi, beforeEach } from 'vitest';
import OpenAI from 'openai';
import { OpenAIService, OpenAIError } from './OpenAIService.js';
import type { Config } from '../config.js';
import type { ChatMessage } from '../repositories/SessionStore.js';

vi.mock('openai', () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      responses: {
        create: mockCreate
      }
    }))
  };
});

describe('OpenAIService', () => {
  let config: Config;
  let service: OpenAIService;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    config = {
      NODE_ENV: 'test',
      PORT: 4000,
      HOST: '0.0.0.0',
      CORS_ORIGIN: '*',
      CORS_CREDENTIALS: false,
      LOG_LEVEL: 'info',
      OPENAI_API_KEY: 'sk-test-key',
      OPENAI_MODEL: 'gpt-5',
      OPENAI_TEMPERATURE: 1.0
    };

    // Create a new service instance, which will use the mocked OpenAI constructor
    service = new OpenAIService(config);

    // Get the mock create function from the mocked OpenAI instance
    const MockedOpenAI = vi.mocked(OpenAI);
    const mockInstance = MockedOpenAI.mock.results[MockedOpenAI.mock.results.length - 1].value;
    mockCreate = mockInstance.responses.create;
  });

  describe('generateResponse', () => {
    it('should generate a response from OpenAI', async () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date().toISOString()
        }
      ];

      const mockResponse = {
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'Hello! How can I help you?'
              }
            ]
          }
        ]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await service.generateResponse(messages);

      expect(result).toBe('Hello! How can I help you?');
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-5',
        input: [{ role: 'user', content: 'Hello' }],
        temperature: 1.0,
        max_output_tokens: undefined
      });
    });

    it('should handle multiple messages in conversation', async () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Hi there!',
          createdAt: new Date().toISOString()
        },
        {
          id: '3',
          role: 'user',
          content: 'How are you?',
          createdAt: new Date().toISOString()
        }
      ];

      const mockResponse = {
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'I am doing well!'
              }
            ]
          }
        ]
      };

      mockCreate.mockResolvedValue(mockResponse);

      await service.generateResponse(messages);

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-5',
        input: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' }
        ],
        temperature: 1.0,
        max_output_tokens: undefined
      });
    });

    it('should throw OpenAIError when API call fails', async () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date().toISOString()
        }
      ];

      mockCreate.mockRejectedValue(new Error('API Error'));

      await expect(service.generateResponse(messages)).rejects.toThrow(OpenAIError);
      await expect(service.generateResponse(messages)).rejects.toThrow(
        'Failed to generate response from OpenAI'
      );
    });

    it('should throw OpenAIError when response has no output', async () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date().toISOString()
        }
      ];

      mockCreate.mockResolvedValue({ output: [] });

      await expect(service.generateResponse(messages)).rejects.toThrow(OpenAIError);
      await expect(service.generateResponse(messages)).rejects.toThrow('Failed to generate response from OpenAI');
    });

    it('should use custom temperature and max tokens when provided', async () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date().toISOString()
        }
      ];

      const mockResponse = {
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'Response'
              }
            ]
          }
        ]
      };

      mockCreate.mockResolvedValue(mockResponse);

      await service.generateResponse(messages, {
        temperature: 0.5,
        maxOutputTokens: 100
      });

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-5',
        input: [{ role: 'user', content: 'Hello' }],
        temperature: 0.5,
        max_output_tokens: 100
      });
    });
  });

  describe('generateStreamingResponse', () => {
    it('should generate streaming response from OpenAI', async () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date().toISOString()
        }
      ];

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'response.output_text.delta', delta: 'Hello' };
          yield { type: 'response.output_text.delta', delta: ' there!' };
          yield { type: 'response.completed' };
        }
      };

      mockCreate.mockResolvedValue(mockStream);

      const chunks: string[] = [];
      const generator = service.generateStreamingResponse(messages);

      for await (const chunk of generator) {
        chunks.push(chunk.delta);
      }

      expect(chunks).toEqual(['Hello', ' there!']);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-5',
        input: [{ role: 'user', content: 'Hello' }],
        temperature: 1.0,
        max_output_tokens: undefined,
        stream: true
      });
    });

    it('should return full text after streaming completes', async () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date().toISOString()
        }
      ];

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'response.output_text.delta', delta: 'Hello' };
          yield { type: 'response.output_text.delta', delta: ' world' };
        }
      };

      mockCreate.mockResolvedValue(mockStream);

      const generator = service.generateStreamingResponse(messages);
      const chunks: string[] = [];

      for await (const chunk of generator) {
        chunks.push(chunk.delta);
      }

      expect(chunks).toEqual(['Hello', ' world']);
    });

    it('should throw OpenAIError when streaming fails', async () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date().toISOString()
        }
      ];

      mockCreate.mockRejectedValue(new Error('Streaming Error'));

      const generator = service.generateStreamingResponse(messages);

      await expect(async () => {
        // biome-ignore lint/correctness/noUnusedVariables: need to consume generator
        for await (const _chunk of generator) {
          // consume generator to trigger error
        }
      }).rejects.toThrow(OpenAIError);
    });
  });
});