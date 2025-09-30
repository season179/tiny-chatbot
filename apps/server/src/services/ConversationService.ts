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

      // Store the assistant's function call decision
      // We store a special marker message that will be converted back to function_call items
      const functionCallMessage = this.buildMessage(
        'assistant',
        '__FUNCTION_CALLS__', // Special marker
        { toolCalls: response.toolCalls }
      );
      currentSession = this.sessionStore.appendMessage(session.id, functionCallMessage);

      // Execute tool calls and store results
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
    let currentSession = this.sessionStore.appendMessage(session.id, userMessage);

    // Agentic loop: handle tool calls until we get a final response
    let roundCount = 0;
    while (roundCount < this.maxToolRounds) {
      const messagesWithSystemPrompt = this.prependSystemPrompt(
        currentSession.messages,
        currentSession.tenantId
      );

      // Use non-streaming for tool calls to get complete response metadata
      const response = await this.openAIService.generateResponse(
        messagesWithSystemPrompt,
        {
          tools: this.availableTools
        }
      );

      // If no tool calls, stream the final response
      if (response.finishReason !== 'tool_calls' || !response.toolCalls) {
        // We already have the content, but stream it for consistency
        const content = response.content || '';

        // Stream the response character by character (or in chunks)
        const chunkSize = 50; // Characters per chunk
        for (let i = 0; i < content.length; i += chunkSize) {
          const delta = content.slice(i, i + chunkSize);
          yield { delta };
        }

        const assistantMessage = this.buildMessage('assistant', content);
        this.sessionStore.appendMessage(session.id, assistantMessage);

        yield { type: 'completed', assistantMessage };
        return;
      }

      // Store the assistant's function call decision
      const functionCallMessage = this.buildMessage(
        'assistant',
        '__FUNCTION_CALLS__',
        { toolCalls: response.toolCalls }
      );
      currentSession = this.sessionStore.appendMessage(session.id, functionCallMessage);

      // Execute tool calls and store results
      for (const toolCall of response.toolCalls) {
        const toolMessage = await this.executeToolCall(toolCall);
        currentSession = this.sessionStore.appendMessage(session.id, toolMessage);
      }

      roundCount++;
    }

    // If we exceed max rounds, return an error message
    const errorContent = 'I apologize, but I exceeded the maximum number of tool execution rounds. Please try simplifying your request.';

    // Stream the error message
    const chunkSize = 50;
    for (let i = 0; i < errorContent.length; i += chunkSize) {
      const delta = errorContent.slice(i, i + chunkSize);
      yield { delta };
    }

    const errorMessage = this.buildMessage('assistant', errorContent);
    this.sessionStore.appendMessage(session.id, errorMessage);

    yield { type: 'completed', assistantMessage: errorMessage };
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

  private buildMessage(
    role: ChatMessage['role'],
    content: string,
    metadata?: Record<string, unknown>
  ): ChatMessage {
    const baseMsg = {
      id: nanoid(),
      role,
      content,
      createdAt: new Date().toISOString()
    };

    if (metadata) {
      return { ...baseMsg, metadata } as ChatMessage;
    }

    return baseMsg as ChatMessage;
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
