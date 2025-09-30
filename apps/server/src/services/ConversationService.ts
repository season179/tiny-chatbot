import { nanoid } from 'nanoid';
import type {
  ChatMessage,
  ChatSession,
  SessionStore,
  ChatToolMessage
} from '../repositories/SessionStore.js';
import type { OpenAIService, StreamChunk, ToolCall } from './OpenAIService.js';
import type { PromptService } from './PromptService.js';
import type { ShellToolService } from './ShellToolService.js';
import type { ShellToolDefinition, ApprovedShellCommand } from '../types/tools.js';

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

export interface ConversationServiceOptions {
  maxToolRounds?: number;
}

export class ConversationService {
  private readonly maxToolRounds: number;

  constructor(
    private readonly sessionStore: SessionStore,
    private readonly openAIService: OpenAIService,
    private readonly promptService?: PromptService,
    private readonly shellToolService?: ShellToolService,
    private readonly availableTools?: ShellToolDefinition[],
    options?: ConversationServiceOptions
  ) {
    this.maxToolRounds = options?.maxToolRounds ?? 10;
  }

  async handleUserMessage(input: HandleMessageInput): Promise<HandleMessageResult> {
    const session = this.sessionStore.getSession(input.sessionId);

    if (!session) {
      throw new SessionNotFoundError(input.sessionId);
    }

    const userMessage = this.buildMessage('user', input.message);
    let currentSession = this.sessionStore.appendMessage(session.id, userMessage);

    // Agentic loop: handle tool calls until we get a final response
    let roundCount = 0;
    while (roundCount < this.maxToolRounds) {
      const messagesWithSystemPrompt = this.prependSystemPrompt(
        currentSession.messages,
        currentSession.tenantId
      );

      const response = await this.openAIService.generateResponse(
        messagesWithSystemPrompt,
        {
          tools: this.availableTools
        }
      );

      // If no tool calls, return the final assistant message
      if (response.finishReason !== 'tool_calls' || !response.toolCalls) {
        const assistantMessage = this.buildMessage(
          'assistant',
          response.content || ''
        );
        this.sessionStore.appendMessage(session.id, assistantMessage);

        return {
          sessionId: session.id,
          assistantMessage
        };
      }

      // Execute tool calls
      for (const toolCall of response.toolCalls) {
        const toolMessage = await this.executeToolCall(toolCall);
        currentSession = this.sessionStore.appendMessage(session.id, toolMessage);
      }

      roundCount++;
    }

    // If we exceed max rounds, return an error message
    const errorMessage = this.buildMessage(
      'assistant',
      'I apologize, but I exceeded the maximum number of tool execution rounds. Please try simplifying your request.'
    );
    this.sessionStore.appendMessage(session.id, errorMessage);

    return {
      sessionId: session.id,
      assistantMessage: errorMessage
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

  private async executeToolCall(toolCall: ToolCall): Promise<ChatToolMessage> {
    const baseMessage: ChatToolMessage = {
      id: nanoid(),
      role: 'tool',
      toolName: toolCall.name,
      toolCallId: toolCall.id,
      arguments: toolCall.arguments,
      createdAt: new Date().toISOString()
    };

    // If shell tool service is not available, return error
    if (!this.shellToolService) {
      return {
        ...baseMessage,
        result: {
          status: 'error',
          errorMessage: 'Tool execution is not enabled'
        }
      };
    }

    try {
      // Map tool arguments to command and args
      const { command, args } = this.mapToolCallToShellCommand(toolCall);

      // Execute the tool
      const result = await this.shellToolService.executeTool(command, args);

      return {
        ...baseMessage,
        result
      };
    } catch (error) {
      return {
        ...baseMessage,
        result: {
          status: 'error',
          errorMessage: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  private mapToolCallToShellCommand(toolCall: ToolCall): {
    command: ApprovedShellCommand;
    args: string[];
  } {
    const command = toolCall.name as ApprovedShellCommand;
    const args: string[] = [];

    // Map tool-specific arguments to command-line arguments
    switch (command) {
      case 'cat':
        if (Array.isArray(toolCall.arguments.paths)) {
          args.push(...(toolCall.arguments.paths as string[]));
        }
        break;

      case 'ls':
        if (toolCall.arguments.showHidden) {
          args.push('-a');
        }
        if (toolCall.arguments.path) {
          args.push(toolCall.arguments.path as string);
        }
        break;

      case 'grep':
      case 'rg':
        if (toolCall.arguments.ignoreCase) {
          args.push('-i');
        }
        if (toolCall.arguments.pattern) {
          args.push(toolCall.arguments.pattern as string);
        }
        if (Array.isArray(toolCall.arguments.paths)) {
          args.push(...(toolCall.arguments.paths as string[]));
        }
        break;

      case 'head':
      case 'tail':
        if (toolCall.arguments.lines) {
          args.push('-n', String(toolCall.arguments.lines));
        }
        if (toolCall.arguments.path) {
          args.push(toolCall.arguments.path as string);
        }
        break;

      case 'echo':
        if (toolCall.arguments.text) {
          args.push(toolCall.arguments.text as string);
        }
        break;

      case 'wc':
        if (toolCall.arguments.countLines) {
          args.push('-l');
        }
        if (toolCall.arguments.countWords) {
          args.push('-w');
        }
        if (toolCall.arguments.countBytes) {
          args.push('-c');
        }
        if (Array.isArray(toolCall.arguments.paths)) {
          args.push(...(toolCall.arguments.paths as string[]));
        }
        break;

      case 'which':
        if (toolCall.arguments.command) {
          args.push(toolCall.arguments.command as string);
        }
        break;

      case 'pwd':
        // No arguments needed
        break;
    }

    return { command, args };
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
    const messagesWithSystemPrompt = this.prependSystemPrompt(
      session.messages,
      session.tenantId
    );
    const response = await this.openAIService.generateResponse(messagesWithSystemPrompt);
    return this.buildMessage('assistant', response.content || '');
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
