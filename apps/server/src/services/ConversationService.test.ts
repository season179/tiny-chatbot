import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationService, SessionNotFoundError } from './ConversationService.js';
import { InMemorySessionStore } from '../repositories/InMemorySessionStore.js';
import type { SessionStore } from '../repositories/SessionStore.js';
import type { OpenAIService } from './OpenAIService.js';

describe('ConversationService', () => {
  let sessionStore: SessionStore;
  let conversationService: ConversationService;
  let mockOpenAIService: OpenAIService;

  beforeEach(() => {
    sessionStore = new InMemorySessionStore();

    mockOpenAIService = {
      generateResponse: vi.fn().mockResolvedValue({
        content: 'Mocked OpenAI response',
        finishReason: 'stop'
      }),
      generateStreamingResponse: vi.fn().mockImplementation(async function* (): AsyncGenerator<{ delta: string }, string, undefined> {
        yield { delta: 'Mocked ' };
        yield { delta: 'streaming ' };
        yield { delta: 'response' };
        return 'Mocked streaming response';
      })
    } as unknown as OpenAIService;

    conversationService = new ConversationService(sessionStore, mockOpenAIService);
  });

  describe('handleUserMessage', () => {
    it('should throw SessionNotFoundError for non-existent session', async () => {
      await expect(
        conversationService.handleUserMessage({
          sessionId: 'non-existent',
          message: 'Hello'
        })
      ).rejects.toThrow(SessionNotFoundError);
    });

    it('should return assistant message for valid session', async () => {
      const session = sessionStore.createSession({ tenantId: 'tenant-1' });

      const result = await conversationService.handleUserMessage({
        sessionId: session.id,
        message: 'Hello'
      });

      expect(result.sessionId).toBe(session.id);
      expect(result.assistantMessage).toBeDefined();
      expect(result.assistantMessage.role).toBe('assistant');
      expect(result.assistantMessage.content).toBe('Mocked OpenAI response');
      expect(result.assistantMessage.id).toBeTruthy();
      expect(result.assistantMessage.createdAt).toBeTruthy();
    });

    it('should call OpenAI service with conversation history', async () => {
      const session = sessionStore.createSession({ tenantId: 'tenant-1' });

      await conversationService.handleUserMessage({
        sessionId: session.id,
        message: 'Hello'
      });

      expect(mockOpenAIService.generateResponse).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: 'Hello'
          })
        ]),
        expect.objectContaining({
          tools: undefined
        })
      );
    });

    it('should store both user and assistant messages in session', async () => {
      const session = sessionStore.createSession({ tenantId: 'tenant-1' });

      await conversationService.handleUserMessage({
        sessionId: session.id,
        message: 'Hello'
      });

      const updatedSession = sessionStore.getSession(session.id);
      expect(updatedSession?.messages).toHaveLength(2);
      expect(updatedSession?.messages[0].role).toBe('user');
      expect(updatedSession?.messages[0].content).toBe('Hello');
      expect(updatedSession?.messages[1].role).toBe('assistant');
      expect(updatedSession?.messages[1].content).toBe('Mocked OpenAI response');
    });

    it('should include conversation history in subsequent calls', async () => {
      const session = sessionStore.createSession({ tenantId: 'tenant-1' });

      await conversationService.handleUserMessage({
        sessionId: session.id,
        message: 'First'
      });

      vi.mocked(mockOpenAIService.generateResponse).mockClear();

      await conversationService.handleUserMessage({
        sessionId: session.id,
        message: 'Second'
      });

      expect(mockOpenAIService.generateResponse).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'First' }),
          expect.objectContaining({ role: 'assistant', content: 'Mocked OpenAI response' }),
          expect.objectContaining({ role: 'user', content: 'Second' })
        ]),
        expect.objectContaining({
          tools: undefined
        })
      );
    });
  });

  describe('handleUserMessageStreaming', () => {
    it('should throw SessionNotFoundError for non-existent session', async () => {
      const generator = conversationService.handleUserMessageStreaming({
        sessionId: 'non-existent',
        message: 'Hello'
      });

      await expect(generator.next()).rejects.toThrow(SessionNotFoundError);
    });

    it('should yield chunks from OpenAI streaming', async () => {
      const session = sessionStore.createSession({ tenantId: 'tenant-1' });

      const generator = conversationService.handleUserMessageStreaming({
        sessionId: session.id,
        message: 'Hello'
      });

      const events: Array<{ delta?: string; type?: string }> = [];
      for await (const event of generator) {
        if ('type' in event && event.type === 'completed') {
          events.push({ type: 'completed' });
        } else if ('delta' in event) {
          events.push({ delta: event.delta });
        }
      }

      // Now uses generateResponse and chunks the response
      expect(events.length).toBeGreaterThanOrEqual(2); // At least one chunk + completed
      expect(events[events.length - 1]).toEqual({ type: 'completed' });
    });

    it('should call OpenAI service with conversation history', async () => {
      const session = sessionStore.createSession({ tenantId: 'tenant-1' });

      const generator = conversationService.handleUserMessageStreaming({
        sessionId: session.id,
        message: 'Hello'
      });

      // Consume generator
      // biome-ignore lint/correctness/noUnusedVariables: need to consume generator
      for await (const _chunk of generator) {
        // consume
      }

      // Now uses generateResponse instead of generateStreamingResponse
      expect(mockOpenAIService.generateResponse).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: 'Hello'
          })
        ]),
        expect.objectContaining({
          tools: undefined
        })
      );
    });

    it('should store messages in session after streaming completes', async () => {
      const session = sessionStore.createSession({ tenantId: 'tenant-1' });

      const generator = conversationService.handleUserMessageStreaming({
        sessionId: session.id,
        message: 'Hello streaming'
      });

      // Consume all chunks
      // biome-ignore lint/correctness/noUnusedVariables: need to consume generator
      for await (const _chunk of generator) {
        // consume
      }

      const updatedSession = sessionStore.getSession(session.id);
      expect(updatedSession?.messages).toHaveLength(2);
      expect(updatedSession?.messages[0].role).toBe('user');
      expect(updatedSession?.messages[0].content).toBe('Hello streaming');
      expect(updatedSession?.messages[1].role).toBe('assistant');
      expect(updatedSession?.messages[1].content).toBe('Mocked OpenAI response');
    });

    it('should accumulate full text from chunks', async () => {
      const session = sessionStore.createSession({ tenantId: 'tenant-1' });

      const generator = conversationService.handleUserMessageStreaming({
        sessionId: session.id,
        message: 'Test'
      });

      let fullText = '';
      for await (const event of generator) {
        if ('delta' in event) {
          fullText += event.delta;
        }
      }

      expect(fullText).toBe('Mocked OpenAI response');

      const updatedSession = sessionStore.getSession(session.id);
      expect(updatedSession?.messages[1].content).toBe('Mocked OpenAI response');
    });
  });

  describe('SessionNotFoundError', () => {
    it('should have correct error name and message', () => {
      const error = new SessionNotFoundError('test-session-id');

      expect(error.name).toBe('SessionNotFoundError');
      expect(error.message).toContain('test-session-id');
      expect(error.message).toContain('was not found');
    });

    it('should be instance of Error', () => {
      const error = new SessionNotFoundError('test-id');
      expect(error).toBeInstanceOf(Error);
    });
  });
});