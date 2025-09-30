import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import {
  ChatMessage,
  ChatSession,
  CreateSessionInput,
  SessionStore
} from './SessionStore.js';
import { getDatabase } from '../db/index.js';
import { sessions, messages } from '../db/schema.js';

export class SqliteSessionStore implements SessionStore {
  createSession(input: CreateSessionInput): ChatSession {
    const db = getDatabase();
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: nanoid(),
      tenantId: input.tenantId,
      userId: input.userId,
      traits: input.traits,
      createdAt: now,
      messages: []
    };

    db.insert(sessions).values({
      id: session.id,
      tenantId: session.tenantId,
      userId: session.userId,
      traits: session.traits ? JSON.stringify(session.traits) : null,
      createdAt: session.createdAt
    }).run();

    return session;
  }

  getSession(sessionId: string): ChatSession | undefined {
    const db = getDatabase();

    // Get session
    const sessionRow = db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .get();

    if (!sessionRow) {
      return undefined;
    }

    // Get messages for this session
    const messageRows = db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .all();

    // Reconstruct ChatSession
    const session: ChatSession = {
      id: sessionRow.id,
      tenantId: sessionRow.tenantId,
      userId: sessionRow.userId ?? undefined,
      traits: sessionRow.traits ? JSON.parse(sessionRow.traits) : undefined,
      createdAt: sessionRow.createdAt,
      messages: messageRows.map((msg) => ({
        id: msg.id,
        role: msg.role as ChatMessage['role'],
        content: msg.content,
        createdAt: msg.createdAt
      }))
    };

    return session;
  }

  appendMessage(sessionId: string, message: ChatMessage): ChatSession {
    const db = getDatabase();

    // Check if session exists
    const sessionExists = db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .get();

    if (!sessionExists) {
      throw new Error(`Session ${sessionId} was not found`);
    }

    // Insert message
    db.insert(messages).values({
      id: message.id,
      sessionId,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt
    }).run();

    // Return updated session
    const updatedSession = this.getSession(sessionId);
    if (!updatedSession) {
      throw new Error(`Failed to retrieve session ${sessionId} after appending message`);
    }

    return updatedSession;
  }
}