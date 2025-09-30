import { describe, it, expect, beforeEach } from 'vitest';
import { InMemorySessionStore } from './InMemorySessionStore.js';
import type { ChatMessage } from './SessionStore.js';

describe('InMemorySessionStore', () => {
  let store: InMemorySessionStore;

  beforeEach(() => {
    store = new InMemorySessionStore();
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

    it('should return a clone, not the original session', () => {
      const created = store.createSession({ tenantId: 'tenant-123' });
      const retrieved = store.getSession(created.id);

      expect(retrieved).not.toBe(created);
      expect(retrieved).toEqual(created);
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

    it('should return a clone after appending', () => {
      const session = store.createSession({ tenantId: 'tenant-123' });
      const message: ChatMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        createdAt: new Date().toISOString()
      };

      const updated = store.appendMessage(session.id, message);
      const retrieved = store.getSession(session.id);

      expect(updated).not.toBe(retrieved);
      expect(updated).toEqual(retrieved);
    });
  });
});