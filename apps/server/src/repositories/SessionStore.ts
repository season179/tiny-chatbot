export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  tenantId: string;
  userId?: string;
  traits?: Record<string, unknown>;
  createdAt: string;
  messages: ChatMessage[];
}

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
