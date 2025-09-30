import type {
  ChatRole,
  ChatMessage,
  ChatSession,
  ChatToolMessage,
  ChatTextMessage
} from '@tiny-chatbot/shared';

export type { ChatRole, ChatMessage, ChatSession, ChatToolMessage, ChatTextMessage };

export interface CreateSessionInput {
  tenantId: string;
  userId?: string;
  traits?: Record<string, unknown>;
}

export interface SessionStore {
  createSession(input: CreateSessionInput): ChatSession;
  getSession(sessionId: string): ChatSession | undefined;
  appendMessage(sessionId: string, message: ChatMessage): ChatSession;
}
