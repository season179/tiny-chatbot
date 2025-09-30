import { nanoid } from 'nanoid';
import type { ChatMessage, ChatSession, SessionStore } from '../repositories/SessionStore.js';
import type { OpenAIService, StreamChunk } from './OpenAIService.js';

export interface HandleMessageInput {
  sessionId: string;
  message: string;
}

export interface HandleMessageResult {
  sessionId: string;
  assistantMessage: ChatMessage;
}

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Session ${sessionId} was not found`);
    this.name = 'SessionNotFoundError';
  }
}

export class ConversationService {
  constructor(
    private readonly sessionStore: SessionStore,
    private readonly openAIService: OpenAIService
  ) {}

  async handleUserMessage(input: HandleMessageInput): Promise<HandleMessageResult> {
    const session = this.sessionStore.getSession(input.sessionId);

    if (!session) {
      throw new SessionNotFoundError(input.sessionId);
    }

    const userMessage = this.buildMessage('user', input.message);
    const updatedSession = this.sessionStore.appendMessage(session.id, userMessage);

    const assistantMessage = await this.buildAssistantMessage(updatedSession);
    this.sessionStore.appendMessage(session.id, assistantMessage);

    return {
      sessionId: session.id,
      assistantMessage
    };
  }

  async *handleUserMessageStreaming(
    input: HandleMessageInput
  ): AsyncGenerator<StreamChunk | { type: 'completed'; assistantMessage: ChatMessage }, void, undefined> {
    const session = this.sessionStore.getSession(input.sessionId);

    if (!session) {
      throw new SessionNotFoundError(input.sessionId);
    }

    const userMessage = this.buildMessage('user', input.message);
    const updatedSession = this.sessionStore.appendMessage(session.id, userMessage);

    const generator = this.openAIService.generateStreamingResponse(updatedSession.messages);
    let fullText = '';

    for await (const chunk of generator) {
      fullText += chunk.delta;
      yield chunk;
    }

    const assistantMessage = this.buildMessage('assistant', fullText);
    this.sessionStore.appendMessage(session.id, assistantMessage);

    yield { type: 'completed', assistantMessage };
  }

  private buildMessage(role: ChatMessage['role'], content: string): ChatMessage {
    return {
      id: nanoid(),
      role,
      content,
      createdAt: new Date().toISOString()
    };
  }

  private async buildAssistantMessage(session: ChatSession): Promise<ChatMessage> {
    const content = await this.openAIService.generateResponse(session.messages);
    return this.buildMessage('assistant', content);
  }
}
