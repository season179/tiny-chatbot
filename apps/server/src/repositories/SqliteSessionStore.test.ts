import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteSessionStore } from './SqliteSessionStore.js';
import type { ChatMessage } from './SessionStore.js';
import { initDatabase, closeDatabase, resetDatabase } from '../db/index.js';

describe('SqliteSessionStore', () => {
  let store: SqliteSessionStore;

  beforeEach(() => {
    // Use in-memory database for tests
    initDatabase({ path: ':memory:', runMigrations: false });
    store = new SqliteSessionStore();
  });

  afterEach(() => {
    resetDatabase();
  });

  describe('createSession', () => {
    it('should create a new session with required fields', () => {
      const session = store.createSession({
        tenantId: 'tenant-123',
        userId: 'user-456'
      });

      expect(session).toBeDefined();
      expect(session.id).toBeTruthy();
      expect(session.tenantId).toBe('tenant-123');
      expect(session.userId).toBe('user-456');
      expect(session.createdAt).toBeTruthy();
      expect(session.messages).toEqual([]);
    });

    it('should create a session without optional userId', () => {
      const session = store.createSession({
        tenantId: 'tenant-123'
      });

      expect(session.userId).toBeUndefined();
    });

    it('should create a session with traits', () => {
      const traits = { role: 'admin', locale: 'en-US' };
      const session = store.createSession({
        tenantId: 'tenant-123',
        traits
      });

      expect(session.traits).toEqual(traits);
    });

    it('should generate unique session IDs', () => {
      const session1 = store.createSession({ tenantId: 'tenant-1' });
      const session2 = store.createSession({ tenantId: 'tenant-1' });

      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('getSession', () => {
    it('should retrieve an existing session', () => {
      const created = store.createSession({ tenantId: 'tenant-123' });
      const retrieved = store.getSession(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.tenantId).toBe('tenant-123');
    });

    it('should return undefined for non-existent session', () => {
      const retrieved = store.getSession('non-existent-id');
      expect(retrieved).toBeUndefined();
    });

    it('should retrieve session with all fields intact', () => {
      const traits = { role: 'admin', locale: 'en-US' };
      const created = store.createSession({
        tenantId: 'tenant-123',
        userId: 'user-456',
        traits
      });

      const retrieved = store.getSession(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.tenantId).toBe('tenant-123');
      expect(retrieved?.userId).toBe('user-456');
      expect(retrieved?.traits).toEqual(traits);
      expect(retrieved?.createdAt).toBe(created.createdAt);
      expect(retrieved?.messages).toEqual([]);
    });
  });

  describe('appendMessage', () => {
    it('should append a message to an existing session', () => {
      const session = store.createSession({ tenantId: 'tenant-123' });
      const message: ChatMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        createdAt: new Date().toISOString()
      };

      const updated = store.appendMessage(session.id, message);

      expect(updated.messages).toHaveLength(1);
      expect(updated.messages[0]).toEqual(message);
    });

    it('should append multiple messages in order', () => {
      const session = store.createSession({ tenantId: 'tenant-123' });
      const message1: ChatMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        createdAt: new Date().toISOString()
      };
      const message2: ChatMessage = {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi there',
        createdAt: new Date().toISOString()
      };

      store.appendMessage(session.id, message1);
      const updated = store.appendMessage(session.id, message2);

      expect(updated.messages).toHaveLength(2);
      expect(updated.messages[0]).toEqual(message1);
      expect(updated.messages[1]).toEqual(message2);
    });

    it('should throw error when appending to non-existent session', () => {
      const message: ChatMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        createdAt: new Date().toISOString()
      };

      expect(() => {
        store.appendMessage('non-existent-id', message);
      }).toThrow('Session non-existent-id was not found');
    });

    it('should persist messages across getSession calls', () => {
      const session = store.createSession({ tenantId: 'tenant-123' });
      const message1: ChatMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        createdAt: new Date().toISOString()
      };
      const message2: ChatMessage = {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi there',
        createdAt: new Date().toISOString()
      };

      store.appendMessage(session.id, message1);
      store.appendMessage(session.id, message2);

      const retrieved = store.getSession(session.id);

      expect(retrieved?.messages).toHaveLength(2);
      expect(retrieved?.messages[0]).toEqual(message1);
      expect(retrieved?.messages[1]).toEqual(message2);
    });

    it('should persist tool invocation payloads', () => {
      const session = store.createSession({ tenantId: 'tenant-123' });
      const toolMessage: ChatMessage = {
        id: 'msg-tool',
        role: 'tool',
        toolName: 'shell/read_file',
        toolCallId: 'call-1',
        arguments: { path: 'README.md' },
        result: {
          status: 'success',
          stdout: 'file contents',
          exitCode: 0,
          durationMs: 12
        },
        metadata: { attempt: 1 },
        createdAt: new Date().toISOString()
      };

      const updated = store.appendMessage(session.id, toolMessage);
      expect(updated.messages).toHaveLength(1);
      expect(updated.messages[0]).toEqual(toolMessage);

      const fetched = store.getSession(session.id);
      expect(fetched?.messages[0]).toEqual(toolMessage);
    });
  });

  describe('persistence', () => {
    it('should handle system role messages', () => {
      const session = store.createSession({ tenantId: 'tenant-123' });
      const systemMessage: ChatMessage = {
        id: 'msg-system',
        role: 'system',
        content: 'You are a helpful assistant',
        createdAt: new Date().toISOString()
      };

      const updated = store.appendMessage(session.id, systemMessage);

      expect(updated.messages).toHaveLength(1);
      expect(updated.messages[0].role).toBe('system');
      expect(updated.messages[0].content).toBe('You are a helpful assistant');
    });

    it('should handle long message content', () => {
      const session = store.createSession({ tenantId: 'tenant-123' });
      const longContent = 'A'.repeat(10000);
      const message: ChatMessage = {
        id: 'msg-1',
        role: 'user',
        content: longContent,
        createdAt: new Date().toISOString()
      };

      const updated = store.appendMessage(session.id, message);
      const retrieved = store.getSession(session.id);

      expect(retrieved?.messages[0].content).toBe(longContent);
      expect(retrieved?.messages[0].content.length).toBe(10000);
    });

    it('should handle complex traits object', () => {
      const complexTraits = {
        role: 'admin',
        locale: 'en-US',
        preferences: {
          theme: 'dark',
          notifications: true,
          nested: {
            deep: {
              value: 42
            }
          }
        },
        tags: ['premium', 'beta-tester']
      };

      const session = store.createSession({
        tenantId: 'tenant-123',
        traits: complexTraits
      });

      const retrieved = store.getSession(session.id);

      expect(retrieved?.traits).toEqual(complexTraits);
    });

    it('should maintain message order with many messages', () => {
      const session = store.createSession({ tenantId: 'tenant-123' });
      const messageCount = 50;
      const messages: ChatMessage[] = [];

      for (let i = 0; i < messageCount; i++) {
        const message: ChatMessage = {
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
          createdAt: new Date().toISOString()
        };
        messages.push(message);
        store.appendMessage(session.id, message);
      }

      const retrieved = store.getSession(session.id);

      expect(retrieved?.messages).toHaveLength(messageCount);
      for (let i = 0; i < messageCount; i++) {
        expect(retrieved?.messages[i].id).toBe(`msg-${i}`);
        expect(retrieved?.messages[i].content).toBe(`Message ${i}`);
      }
    });
  });
});
