import { nanoid } from 'nanoid';
import type { ChatMessage, ChatSession, SessionStore } from '../repositories/SessionStore.js';

export interface HandleMessageInput {
  sessionId: string;
  message: string;
}

export interface HandleMessageResult {
  sessionId: string;
  assistantMessage: ChatMessage;
}

export interface StreamMessageResult extends HandleMessageResult {
  chunks: string[];
}

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Session ${sessionId} was not found`);
    this.name = 'SessionNotFoundError';
  }
}

export class ConversationService {
  constructor(private readonly sessionStore: SessionStore) {}

  handleUserMessage(input: HandleMessageInput): HandleMessageResult {
    const session = this.sessionStore.getSession(input.sessionId);

    if (!session) {
      throw new SessionNotFoundError(input.sessionId);
    }

    const userMessage = this.buildMessage('user', input.message);
    const updatedSession = this.sessionStore.appendMessage(session.id, userMessage);

    const assistantMessage = this.buildAssistantMessage(input.message, updatedSession);
    this.sessionStore.appendMessage(session.id, assistantMessage);

    return {
      sessionId: session.id,
      assistantMessage
    };
  }

  handleUserMessageStreaming(input: HandleMessageInput): StreamMessageResult {
    const { assistantMessage } = this.handleUserMessage(input);
    const chunks = this.generateChunks(assistantMessage);

    return {
      sessionId: input.sessionId,
      assistantMessage,
      chunks
    };
  }

  private buildMessage(role: ChatMessage['role'], content: string): ChatMessage {
    return {
      id: nanoid(),
      role,
      content,
      createdAt: new Date().toISOString()
    };
  }

  private buildAssistantMessage(userInput: string, session: ChatSession): ChatMessage {
    const assistantCount = session.messages.filter((msg) => msg.role === 'assistant').length + 1;
    const content = [
      `Placeholder reply #${assistantCount} for session ${session.id}.`,
      `You said: "${userInput}".`,
      'Connect the ConversationService to a real LLM pipeline to replace this canned response.'
    ].join(' ');

    return this.buildMessage('assistant', content);
  }

  private generateChunks(message: ChatMessage): string[] {
    const sentences = message.content.split('. ').filter((part) => part.length > 0);
    return sentences.map((sentence, index) => {
      const suffix = index === sentences.length - 1 ? '' : '.';
      return `${sentence}${suffix}`;
    });
  }
}
