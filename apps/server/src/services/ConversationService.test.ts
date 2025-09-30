import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationService, SessionNotFoundError } from './ConversationService.js';
import { InMemorySessionStore } from '../repositories/InMemorySessionStore.js';
import type { SessionStore } from '../repositories/SessionStore.js';

describe('ConversationService', () => {
  let sessionStore: SessionStore;
  let conversationService: ConversationService;

  beforeEach(() => {
    sessionStore = new InMemorySessionStore();
    conversationService = new ConversationService(sessionStore);
  });

  describe('handleUserMessage', () => {
    it('should throw SessionNotFoundError for non-existent session', () => {
      expect(() => {
        conversationService.handleUserMessage({
          sessionId: 'non-existent',
          message: 'Hello'
        });
      }).toThrow(SessionNotFoundError);
    });

    it('should return assistant message for valid session', () => {
      const session = sessionStore.createSession({ tenantId: 'tenant-1' });

      const result = conversationService.handleUserMessage({
        sessionId: session.id,
        message: 'Hello'
      });

      expect(result.sessionId).toBe(session.id);
      expect(result.assistantMessage).toBeDefined();
      expect(result.assistantMessage.role).toBe('assistant');
      expect(result.assistantMessage.content).toBeTruthy();
      expect(result.assistantMessage.id).toBeTruthy();
      expect(result.assistantMessage.createdAt).toBeTruthy();
    });

    it('should include user message in response content', () => {
      const session = sessionStore.createSession({ tenantId: 'tenant-1' });

      const result = conversationService.handleUserMessage({
        sessionId: session.id,
        message: 'Test message'
      });

      expect(result.assistantMessage.content).toContain('Test message');
    });

    it('should store both user and assistant messages in session', () => {
      const session = sessionStore.createSession({ tenantId: 'tenant-1' });

      conversationService.handleUserMessage({
        sessionId: session.id,
        message: 'Hello'
      });

      const updatedSession = sessionStore.getSession(session.id);
      expect(updatedSession?.messages).toHaveLength(2);
      expect(updatedSession?.messages[0].role).toBe('user');
      expect(updatedSession?.messages[0].content).toBe('Hello');
      expect(updatedSession?.messages[1].role).toBe('assistant');
    });

    it('should increment reply count for subsequent messages', () => {
      const session = sessionStore.createSession({ tenantId: 'tenant-1' });

      const result1 = conversationService.handleUserMessage({
        sessionId: session.id,
        message: 'First'
      });

      const result2 = conversationService.handleUserMessage({
        sessionId: session.id,
        message: 'Second'
      });

      expect(result1.assistantMessage.content).toContain('#1');
      expect(result2.assistantMessage.content).toContain('#2');
    });

    it('should return deterministic canned response', () => {
      const session = sessionStore.createSession({ tenantId: 'tenant-1' });

      const result = conversationService.handleUserMessage({
        sessionId: session.id,
        message: 'Hello'
      });

      expect(result.assistantMessage.content).toContain('Placeholder reply');
      expect(result.assistantMessage.content).toContain('You said:');
      expect(result.assistantMessage.content).toContain('Connect the ConversationService to a real LLM');
    });
  });

  describe('handleUserMessageStreaming', () => {
    it('should throw SessionNotFoundError for non-existent session', () => {
      expect(() => {
        conversationService.handleUserMessageStreaming({
          sessionId: 'non-existent',
          message: 'Hello'
        });
      }).toThrow(SessionNotFoundError);
    });

    it('should return assistant message and chunks', () => {
      const session = sessionStore.createSession({ tenantId: 'tenant-1' });

      const result = conversationService.handleUserMessageStreaming({
        sessionId: session.id,
        message: 'Hello'
      });

      expect(result.sessionId).toBe(session.id);
      expect(result.assistantMessage).toBeDefined();
      expect(result.chunks).toBeDefined();
      expect(Array.isArray(result.chunks)).toBe(true);
    });

    it('should split response into sentence chunks', () => {
      const session = sessionStore.createSession({ tenantId: 'tenant-1' });

      const result = conversationService.handleUserMessageStreaming({
        sessionId: session.id,
        message: 'Hello'
      });

      expect(result.chunks.length).toBeGreaterThan(1);

      // Verify chunks are non-empty strings
      for (const chunk of result.chunks) {
        expect(chunk).toBeTruthy();
        expect(typeof chunk).toBe('string');
      }

      // Verify chunks contain parts of the original message
      const fullChunks = result.chunks.join(' ');
      expect(fullChunks).toContain('Placeholder reply');
      expect(fullChunks).toContain('You said');
      expect(fullChunks).toContain('Connect the ConversationService');
    });

    it('should store messages in session', () => {
      const session = sessionStore.createSession({ tenantId: 'tenant-1' });

      conversationService.handleUserMessageStreaming({
        sessionId: session.id,
        message: 'Hello streaming'
      });

      const updatedSession = sessionStore.getSession(session.id);
      expect(updatedSession?.messages).toHaveLength(2);
      expect(updatedSession?.messages[0].content).toBe('Hello streaming');
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