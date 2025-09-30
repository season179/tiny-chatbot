import { nanoid } from 'nanoid';
import type { ChatMessage, ChatSession, SessionStore } from '../repositories/SessionStore.js';
import type { OpenAIService, StreamChunk } from './OpenAIService.js';
import type { PromptService } from './PromptService.js';

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
    private readonly openAIService: OpenAIService,
    private readonly promptService?: PromptService
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

    const messagesWithSystemPrompt = this.prependSystemPrompt(
      updatedSession.messages,
      updatedSession.tenantId
    );
    const generator = this.openAIService.generateStreamingResponse(messagesWithSystemPrompt);
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
    const messagesWithSystemPrompt = this.prependSystemPrompt(session.messages, session.tenantId);
    const content = await this.openAIService.generateResponse(messagesWithSystemPrompt);
    return this.buildMessage('assistant', content);
  }

  /**
   * Prepends a system prompt to the messages array if PromptService is available.
   * The system prompt is not persisted to the database - it's added only for the API call.
   */
  private prependSystemPrompt(messages: ChatMessage[], tenantId: string): ChatMessage[] {
    if (!this.promptService) {
      return messages;
    }

    // Check if there's already a system message at the start
    const hasSystemMessage = messages.length > 0 && messages[0].role === 'system';
    if (hasSystemMessage) {
      return messages;
    }

    const systemPrompt = this.promptService.getPromptForTenant(tenantId);
    const systemMessage: ChatMessage = {
      id: 'system-prompt', // Not persisted, so ID doesn't need to be unique
      role: 'system',
      content: systemPrompt,
      createdAt: new Date().toISOString()
    };

    return [systemMessage, ...messages];
  }
}
