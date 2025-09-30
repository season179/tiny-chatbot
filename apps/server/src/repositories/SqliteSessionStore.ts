import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import {
  ChatMessage,
  ChatSession,
  ChatTextMessage,
  ChatToolMessage,
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
      messages: messageRows.map((msg) => reconstructMessage(msg))
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
    const insertValues: typeof messages.$inferInsert = {
      id: message.id,
      sessionId,
      role: message.role,
      content: '',
      toolName: null,
      toolCallId: null,
      arguments: null,
      result: null,
      metadata: stringifyOrNull(message.metadata),
      createdAt: message.createdAt
    };

    if (message.role === 'tool') {
      insertValues.toolName = message.toolName;
      insertValues.toolCallId = message.toolCallId ?? null;
      insertValues.arguments = stringifyOrNull(message.arguments);
      insertValues.result = stringifyOrNull(message.result);
      insertValues.content = message.content ?? '';
    } else {
      if (message.content === undefined) {
        throw new Error(
          `Message ${message.id} with role ${message.role} is missing content`
        );
      }
      insertValues.content = message.content;
    }

    db.insert(messages).values(insertValues).run();

    // Return updated session
    const updatedSession = this.getSession(sessionId);
    if (!updatedSession) {
      throw new Error(`Failed to retrieve session ${sessionId} after appending message`);
    }

    return updatedSession;
  }
}

type MessageRow = typeof messages.$inferSelect;

function reconstructMessage(row: MessageRow): ChatMessage {
  const metadata = parseJsonField<Record<string, unknown>>(row.metadata, 'metadata', row.id);

  if (row.role === 'tool') {
    if (!row.toolName) {
      throw new Error(`Tool message ${row.id} is missing a tool name`);
    }

    const toolMessage: ChatToolMessage = {
      id: row.id,
      role: 'tool',
      toolName: row.toolName,
      toolCallId: row.toolCallId ?? undefined,
      arguments: parseJsonField<Record<string, unknown>>(row.arguments, 'arguments', row.id),
      result: parseJsonField<ChatToolMessage['result']>(row.result, 'result', row.id),
      content: row.content === '' ? undefined : row.content,
      metadata,
      createdAt: row.createdAt
    };

    return toolMessage;
  }

  const textMessage: ChatTextMessage = {
    id: row.id,
    role: row.role as ChatTextMessage['role'],
    content: row.content ?? '',
    metadata,
    createdAt: row.createdAt
  };

  return textMessage;
}

function stringifyOrNull(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return JSON.stringify(value);
}

function parseJsonField<T>(value: string | null, field: string, messageId: string): T | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${field} for message ${messageId}: ${errorMessage}`);
  }
}
