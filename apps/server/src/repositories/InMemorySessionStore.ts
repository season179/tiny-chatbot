import { nanoid } from 'nanoid';
import {
  ChatMessage,
  ChatSession,
  CreateSessionInput,
  SessionStore
} from './SessionStore.js';

export class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, ChatSession>();

  createSession(input: CreateSessionInput): ChatSession {
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: nanoid(),
      tenantId: input.tenantId,
      userId: input.userId,
      traits: input.traits,
      createdAt: now,
      messages: []
    };

    this.sessions.set(session.id, session);
    return structuredClone(session);
  }

  getSession(sessionId: string): ChatSession | undefined {
    const session = this.sessions.get(sessionId);
    return session ? structuredClone(session) : undefined;
  }

  appendMessage(sessionId: string, message: ChatMessage): ChatSession {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} was not found`);
    }

    session.messages.push(message);
    return structuredClone(session);
  }
}

function structuredClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
