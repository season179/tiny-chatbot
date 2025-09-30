import { describe, it, expect, vi, beforeEach } from 'vitest';
import OpenAI from 'openai';
import { OpenAIService, OpenAIError, OpenAIRateLimitError } from './OpenAIService.js';
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

// Mock the retry utility to avoid waiting for delays in tests
vi.mock('../utils/retry.js', () => ({
  retryWithBackoff: vi.fn(async (operation) => await operation()),
  RetryError: class RetryError extends Error {
    constructor(message: string, public attempts: number, public lastError: unknown) {
      super(message);
      this.name = 'RetryError';
    }
  }
}));

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
      DATABASE_PATH: ':memory:'
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
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5',
          input: [
            expect.objectContaining({
              role: 'user',
              type: 'message',
              content: [
                {
                  type: 'input_text',
                  text: 'Hello'
                }
              ]
            })
          ],
          max_output_tokens: undefined
        })
      );
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

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5',
          input: [
            expect.objectContaining({
              role: 'user',
              type: 'message',
              content: [
                {
                  type: 'input_text',
                  text: 'Hello'
                }
              ]
            }),
            expect.objectContaining({
              role: 'assistant',
              type: 'message',
              content: [
                {
                  type: 'output_text',
                  text: 'Hi there!'
                }
              ]
            }),
            expect.objectContaining({
              role: 'user',
              type: 'message',
              content: [
                {
                  type: 'input_text',
                  text: 'How are you?'
                }
              ]
            })
          ],
          max_output_tokens: undefined
        })
      );
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
        maxOutputTokens: 100
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5',
          input: [
            expect.objectContaining({
              role: 'user',
              type: 'message',
              content: [
                {
                  type: 'input_text',
                  text: 'Hello'
                }
              ]
            })
          ],
          max_output_tokens: 100
        })
      );
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
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5',
          input: [
            expect.objectContaining({
              role: 'user',
              type: 'message',
              content: [
                {
                  type: 'input_text',
                  text: 'Hello'
                }
              ]
            })
          ],
          max_output_tokens: undefined,
          stream: true
        })
      );
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

  describe('error handling', () => {
    it('should throw OpenAIRateLimitError for 429 status codes', async () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date().toISOString()
        }
      ];

      const rateLimitError = {
        status: 429,
        headers: {
          'retry-after': '60'
        }
      };

      mockCreate.mockRejectedValue(rateLimitError);

      await expect(service.generateResponse(messages)).rejects.toThrow(OpenAIRateLimitError);
      await expect(service.generateResponse(messages)).rejects.toThrow(
        'OpenAI rate limit exceeded'
      );
    });

    it('should extract retry-after from rate limit errors', async () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date().toISOString()
        }
      ];

      const rateLimitError = {
        status: 429,
        headers: {
          'retry-after': '120'
        }
      };

      mockCreate.mockRejectedValue(rateLimitError);

      try {
        await service.generateResponse(messages);
        expect.fail('Should have thrown OpenAIRateLimitError');
      } catch (error) {
        expect(error).toBeInstanceOf(OpenAIRateLimitError);
        if (error instanceof OpenAIRateLimitError) {
          expect(error.retryAfter).toBe(120);
        }
      }
    });

    it('should log errors when logger is provided', async () => {
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      };

      const serviceWithLogger = new OpenAIService(config, mockLogger);

      // Mock the OpenAI instance for the new service
      const MockedOpenAI = vi.mocked(OpenAI);
      const mockInstance = MockedOpenAI.mock.results[MockedOpenAI.mock.results.length - 1].value;
      const mockCreateWithLogger = mockInstance.responses.create;

      const messages: ChatMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date().toISOString()
        }
      ];

      mockCreateWithLogger.mockRejectedValue(new Error('API Error'));

      await expect(serviceWithLogger.generateResponse(messages)).rejects.toThrow(OpenAIError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'OpenAI API request failed',
        expect.objectContaining({
          model: 'gpt-5',
          error: 'API Error'
        })
      );
    });

    it('should log token usage when response includes usage data', async () => {
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      };

      const serviceWithLogger = new OpenAIService(config, mockLogger);

      // Mock the OpenAI instance for the new service
      const MockedOpenAI = vi.mocked(OpenAI);
      const mockInstance = MockedOpenAI.mock.results[MockedOpenAI.mock.results.length - 1].value;
      const mockCreateWithLogger = mockInstance.responses.create;

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
        ],
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30
        }
      };

      mockCreateWithLogger.mockResolvedValue(mockResponse);

      await serviceWithLogger.generateResponse(messages);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'OpenAI API request completed',
        expect.objectContaining({
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30
        })
      );
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when API is accessible', async () => {
      const mockResponse = {
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'pong'
              }
            ]
          }
        ]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await service.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('should return unhealthy status when API is not accessible', async () => {
      mockCreate.mockRejectedValue(new Error('Connection refused'));

      const result = await service.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Connection refused');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should use minimal tokens for health check', async () => {
      const mockResponse = {
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'pong'
              }
            ]
          }
        ]
      };

      mockCreate.mockResolvedValue(mockResponse);

      await service.healthCheck();

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_output_tokens: 5
        })
      );
    });
  });
});
