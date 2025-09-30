import type {
  CreateSessionRequest,
  CreateSessionResponse
} from '../api/session.js';
import type { ChatRequest, ChatResponse, StreamEvent } from '../api/chat.js';
import type { FeedbackRequest, FeedbackResponse } from '../api/feedback.js';
import type { ApiError } from '../api/errors.js';

export interface ApiClientConfig {
  baseUrl: string;
  headers?: Record<string, string>;
}

export class ApiClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.headers = config.headers || {};
  }

  /**
   * Create a new chat session
   */
  async createSession(
    request: CreateSessionRequest
  ): Promise<CreateSessionResponse> {
    const response = await fetch(`${this.baseUrl}/api/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new ApiClientError(response.status, error);
    }

    return response.json();
  }

  /**
   * Send a chat message (non-streaming)
   */
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new ApiClientError(response.status, error);
    }

    return response.json();
  }

  /**
   * Send a chat message with streaming response
   * Returns an async generator that yields SSE events
   */
  async *streamMessage(request: ChatRequest): AsyncGenerator<StreamEvent> {
    console.log('[ApiClient] Starting stream request to:', `${this.baseUrl}/api/chat/stream`);
    console.log('[ApiClient] Request payload:', request);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers
        },
        body: JSON.stringify(request)
      });
      console.log('[ApiClient] Response received:', response.status, response.statusText);
    } catch (fetchError) {
      console.error('[ApiClient] Fetch failed:', fetchError);
      throw fetchError;
    }

    if (!response.ok) {
      console.error('[ApiClient] Response not OK:', response.status);
      throw new ApiClientError(response.status, {
        error: `HTTP ${response.status}: ${response.statusText}`
      });
    }

    if (!response.body) {
      console.error('[ApiClient] Response body is null');
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      console.log('[ApiClient] Starting to read stream...');
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('[ApiClient] Stream ended');
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // Remove 'data: ' prefix
            if (data.trim()) {
              const event: StreamEvent = JSON.parse(data);
              console.log('[ApiClient] Received event:', event.type);
              yield event;

              // Stop on error or completion
              if (event.type === 'error' || event.type === 'completed') {
                console.log('[ApiClient] Stream completed with:', event.type);
                return;
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
      console.log('[ApiClient] Reader released');
    }
  }

  /**
   * Submit feedback for a message
   */
  async submitFeedback(request: FeedbackRequest): Promise<FeedbackResponse> {
    const response = await fetch(`${this.baseUrl}/api/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new ApiClientError(response.status, error);
    }

    return response.json();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string }> {
    const response = await fetch(`${this.baseUrl}/healthz`);

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }

    return response.json();
  }
}

/**
 * Custom error class for API client errors
 */
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly apiError: ApiError
  ) {
    super(`API Error ${status}: ${apiError.error}`);
    this.name = 'ApiClientError';
  }
}