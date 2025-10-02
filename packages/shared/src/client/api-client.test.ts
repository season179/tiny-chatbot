import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiClient, ApiClientError } from './api-client.js';
import type { CreateSessionResponse } from '../api/session.js';
import type { ChatResponse, StreamEvent } from '../api/chat.js';
import type { FeedbackResponse } from '../api/feedback.js';

describe('ApiClient', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  const baseUrl = 'http://localhost:4000';

  beforeEach(() => {
    // Mock global fetch
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Constructor & Configuration', () => {
    it('should remove trailing slash from baseUrl', () => {
      const client = new ApiClient({ baseUrl: 'http://localhost:4000/' });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' })
      });

      client.healthCheck();
      
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4000/healthz');
    });

    it('should store custom headers correctly', async () => {
      const client = new ApiClient({
        baseUrl,
        headers: { 'X-Custom-Header': 'test-value' }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' })
      });

      await client.healthCheck();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
      );
    });

    it('should work with no headers provided', async () => {
      const client = new ApiClient({ baseUrl });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'test', tenantId: 'tenant1', createdAt: '2024-01-01' })
      });

      await client.createSession({ tenantId: 'tenant1' });

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/api/session`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );
    });
  });

  describe('createSession()', () => {
    let client: ApiClient;

    beforeEach(() => {
      client = new ApiClient({ baseUrl });
    });

    it('should send POST to /api/session with correct body', async () => {
      const request = { tenantId: 'tenant1', userId: 'user123' };
      const response: CreateSessionResponse = {
        sessionId: 'session123',
        tenantId: 'tenant1',
        userId: 'user123',
        createdAt: '2024-01-01T00:00:00Z'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => response
      });

      const result = await client.createSession(request);

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/api/session`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request)
        }
      );
      expect(result).toEqual(response);
    });

    it('should include custom headers in request', async () => {
      const clientWithHeaders = new ApiClient({
        baseUrl,
        headers: { 'Authorization': 'Bearer token123' }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'test', tenantId: 'tenant1', createdAt: '2024-01-01' })
      });

      await clientWithHeaders.createSession({ tenantId: 'tenant1' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token123'
          }
        })
      );
    });

    it('should return CreateSessionResponse on 200 OK', async () => {
      const response: CreateSessionResponse = {
        sessionId: 'session-abc',
        tenantId: 'tenant1',
        createdAt: '2024-01-01T00:00:00Z'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => response
      });

      const result = await client.createSession({ tenantId: 'tenant1' });

      expect(result).toEqual(response);
    });

    it('should throw ApiClientError on 400 error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid tenant ID' })
      });

      await expect(
        client.createSession({ tenantId: '' })
      ).rejects.toThrow(ApiClientError);
    });

    it('should include error details in ApiClientError', async () => {
      const errorResponse = { error: 'Tenant not found', details: { code: 'TENANT_NOT_FOUND' } };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => errorResponse
      });

      try {
        await client.createSession({ tenantId: 'invalid' });
        expect.fail('Should have thrown ApiClientError');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiClientError);
        const apiError = error as ApiClientError;
        expect(apiError.status).toBe(404);
        expect(apiError.apiError).toEqual(errorResponse);
        expect(apiError.message).toContain('404');
        expect(apiError.message).toContain('Tenant not found');
      }
    });
  });

  describe('sendMessage()', () => {
    let client: ApiClient;

    beforeEach(() => {
      client = new ApiClient({ baseUrl });
    });

    it('should send POST to /api/chat with correct body', async () => {
      const request = { sessionId: 'session123', message: 'Hello' };
      const response: ChatResponse = {
        sessionId: 'session123',
        message: {
          id: 'msg1',
          role: 'assistant',
          content: 'Hi there!',
          timestamp: '2024-01-01T00:00:00Z'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => response
      });

      const result = await client.sendMessage(request);

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/api/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request)
        }
      );
      expect(result).toEqual(response);
    });

    it('should include custom headers in request', async () => {
      const clientWithHeaders = new ApiClient({
        baseUrl,
        headers: { 'X-Request-ID': 'req123' }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'session123',
          message: { id: 'msg1', role: 'assistant', content: 'Hi', timestamp: '2024-01-01' }
        })
      });

      await clientWithHeaders.sendMessage({ sessionId: 'session123', message: 'Hello' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': 'req123'
          }
        })
      );
    });

    it('should return ChatResponse on success', async () => {
      const response: ChatResponse = {
        sessionId: 'session123',
        message: {
          id: 'msg1',
          role: 'assistant',
          content: 'Hello!',
          timestamp: '2024-01-01T00:00:00Z'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => response
      });

      const result = await client.sendMessage({ sessionId: 'session123', message: 'Hi' });

      expect(result).toEqual(response);
    });

    it('should throw ApiClientError on 404 error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Session not found' })
      });

      await expect(
        client.sendMessage({ sessionId: 'invalid', message: 'Hello' })
      ).rejects.toThrow(ApiClientError);
    });

    it('should handle network errors (fetch rejection)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        client.sendMessage({ sessionId: 'session123', message: 'Hello' })
      ).rejects.toThrow('Network error');
    });
  });

  describe('streamMessage()', () => {
    let client: ApiClient;

    beforeEach(() => {
      client = new ApiClient({ baseUrl });
      // Suppress console logs during tests
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    /**
     * Helper to create a mock ReadableStream that yields SSE chunks
     */
    function createMockStream(chunks: string[]): ReadableStream<Uint8Array> {
      let index = 0;
      return new ReadableStream({
        pull(controller) {
          if (index < chunks.length) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(chunks[index++]));
          } else {
            controller.close();
          }
        }
      });
    }

    it('should yield StreamChunkEvent for each SSE data line', async () => {
      const chunks = [
        'data: {"type":"chunk","data":"Hello"}\n',
        'data: {"type":"chunk","data":" world"}\n',
        'data: {"type":"completed","message":{"id":"msg1","role":"assistant","content":"Hello world","timestamp":"2024-01-01"}}\n'
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(chunks)
      });

      const events: StreamEvent[] = [];
      for await (const event of client.streamMessage({ sessionId: 'session123', message: 'Hi' })) {
        events.push(event);
      }

      expect(events).toHaveLength(3);
      expect(events[0]).toEqual({ type: 'chunk', data: 'Hello' });
      expect(events[1]).toEqual({ type: 'chunk', data: ' world' });
      expect(events[2].type).toBe('completed');
    });

    it('should correctly parse SSE data: prefix', async () => {
      const chunks = ['data: {"type":"chunk","data":"test"}\n'];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(chunks)
      });

      const events: StreamEvent[] = [];
      for await (const event of client.streamMessage({ sessionId: 'session123', message: 'Hi' })) {
        events.push(event);
      }

      expect(events[0]).toEqual({ type: 'chunk', data: 'test' });
    });

    it('should handle multiple SSE events in single chunk', async () => {
      const chunks = [
        'data: {"type":"chunk","data":"Hello"}\ndata: {"type":"chunk","data":" world"}\n'
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(chunks)
      });

      const events: StreamEvent[] = [];
      for await (const event of client.streamMessage({ sessionId: 'session123', message: 'Hi' })) {
        events.push(event);
      }

      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({ type: 'chunk', data: 'Hello' });
      expect(events[1]).toEqual({ type: 'chunk', data: ' world' });
    });

    it('should buffer incomplete lines across reads', async () => {
      // Split a JSON payload across multiple chunks
      const chunks = [
        'data: {"type":"chu',
        'nk","data":"test"}\n'
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(chunks)
      });

      const events: StreamEvent[] = [];
      for await (const event of client.streamMessage({ sessionId: 'session123', message: 'Hi' })) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: 'chunk', data: 'test' });
    });

    it('should stop iteration on completed event', async () => {
      const chunks = [
        'data: {"type":"chunk","data":"Hello"}\n',
        'data: {"type":"completed","message":{"id":"msg1","role":"assistant","content":"Hello","timestamp":"2024-01-01"}}\n',
        'data: {"type":"chunk","data":"Should not be yielded"}\n'
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(chunks)
      });

      const events: StreamEvent[] = [];
      for await (const event of client.streamMessage({ sessionId: 'session123', message: 'Hi' })) {
        events.push(event);
      }

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('chunk');
      expect(events[1].type).toBe('completed');
    });

    it('should stop iteration on error event', async () => {
      const chunks = [
        'data: {"type":"chunk","data":"Hello"}\n',
        'data: {"type":"error","error":"Something went wrong"}\n',
        'data: {"type":"chunk","data":"Should not be yielded"}\n'
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(chunks)
      });

      const events: StreamEvent[] = [];
      for await (const event of client.streamMessage({ sessionId: 'session123', message: 'Hi' })) {
        events.push(event);
      }

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('chunk');
      expect(events[1]).toEqual({ type: 'error', error: 'Something went wrong' });
    });

    it('should throw ApiClientError for non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      const generator = client.streamMessage({ sessionId: 'session123', message: 'Hi' });

      await expect(generator.next()).rejects.toThrow(ApiClientError);
    });

    it('should throw error when response body is null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: null
      });

      const generator = client.streamMessage({ sessionId: 'session123', message: 'Hi' });

      await expect(generator.next()).rejects.toThrow('Response body is null');
    });

    it('should release reader lock even on error (finally block)', async () => {
      // Create a mock reader to track releaseLock calls
      const mockReader = {
        read: vi.fn().mockRejectedValueOnce(new Error('Read error')),
        releaseLock: vi.fn()
      };

      const mockBody = {
        getReader: vi.fn().mockReturnValueOnce(mockReader)
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockBody
      });

      const generator = client.streamMessage({ sessionId: 'session123', message: 'Hi' });

      try {
        await generator.next();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(mockReader.releaseLock).toHaveBeenCalled();
      }
    });
  });

  describe('submitFeedback()', () => {
    let client: ApiClient;

    beforeEach(() => {
      client = new ApiClient({ baseUrl });
    });

    it('should send POST to /api/feedback with correct body', async () => {
      const request = {
        sessionId: 'session123',
        messageId: 'msg1',
        rating: 'positive' as const
      };
      const response: FeedbackResponse = {
        success: true,
        feedbackId: 'feedback123'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => response
      });

      const result = await client.submitFeedback(request);

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/api/feedback`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request)
        }
      );
      expect(result).toEqual(response);
    });

    it('should return FeedbackResponse on success', async () => {
      const response: FeedbackResponse = {
        success: true,
        feedbackId: 'feedback-abc'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => response
      });

      const result = await client.submitFeedback({
        sessionId: 'session123',
        messageId: 'msg1',
        rating: 'negative'
      });

      expect(result).toEqual(response);
    });

    it('should throw ApiClientError on error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' })
      });

      await expect(
        client.submitFeedback({
          sessionId: 'session123',
          messageId: 'msg1',
          rating: 'positive'
        })
      ).rejects.toThrow(ApiClientError);
    });

    it('should include custom headers in request', async () => {
      const clientWithHeaders = new ApiClient({
        baseUrl,
        headers: { 'X-Feedback-Source': 'widget' }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, feedbackId: 'feedback123' })
      });

      await clientWithHeaders.submitFeedback({
        sessionId: 'session123',
        messageId: 'msg1',
        rating: 'positive'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'X-Feedback-Source': 'widget'
          }
        })
      );
    });
  });

  describe('healthCheck()', () => {
    let client: ApiClient;

    beforeEach(() => {
      client = new ApiClient({ baseUrl });
    });

    it('should send GET to /healthz', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' })
      });

      await client.healthCheck();

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/healthz`);
    });

    it('should return status object on success', async () => {
      const response = { status: 'healthy' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => response
      });

      const result = await client.healthCheck();

      expect(result).toEqual(response);
    });

    it('should throw error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Service Unavailable'
      });

      await expect(client.healthCheck()).rejects.toThrow('Health check failed: Service Unavailable');
    });
  });

  describe('ApiClientError', () => {
    it('should store status and apiError', () => {
      const apiError = { error: 'Test error', details: { code: 'TEST' } };
      const error = new ApiClientError(400, apiError);

      expect(error.status).toBe(400);
      expect(error.apiError).toEqual(apiError);
      expect(error.name).toBe('ApiClientError');
    });

    it('should create descriptive error message', () => {
      const apiError = { error: 'Invalid request' };
      const error = new ApiClientError(400, apiError);

      expect(error.message).toBe('API Error 400: Invalid request');
    });

    it('should be instance of Error', () => {
      const error = new ApiClientError(500, { error: 'Server error' });

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiClientError);
    });
  });
});

