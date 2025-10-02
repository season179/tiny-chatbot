import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/preact';
import { useChat } from './useChat';
import { ApiClient } from '@tiny-chatbot/shared';
import type { ChatMessage } from '@tiny-chatbot/shared';

// Mock modules
vi.mock('@tiny-chatbot/shared', async () => {
  const actual = await vi.importActual('@tiny-chatbot/shared');
  return {
    ...actual,
    ApiClient: vi.fn()
  };
});

vi.mock('../config', () => ({
  getConfig: vi.fn(() => ({
    apiBaseUrl: 'http://test-api.local',
    tenantId: 'test-tenant',
    userId: 'test-user',
    traits: { role: 'tester' }
  }))
}));

describe('useChat', () => {
  let mockApiClient: {
    createSession: ReturnType<typeof vi.fn>;
    streamMessage: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock API client
    mockApiClient = {
      createSession: vi.fn(),
      streamMessage: vi.fn()
    };

    (ApiClient as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => mockApiClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Session Initialization', () => {
    it('should successfully initialize session on mount', async () => {
      mockApiClient.createSession.mockResolvedValue({
        sessionId: 'session-123',
        tenantId: 'test-tenant'
      });

      const { result } = renderHook(() => useChat());

      // Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.sessionId).toBeUndefined();

      // Wait for session initialization
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockApiClient.createSession).toHaveBeenCalledWith({
        tenantId: 'test-tenant',
        userId: 'test-user',
        traits: { role: 'tester' }
      });
      expect(result.current.error).toBe(null);
      expect(result.current.messages).toEqual([]);
    });

    it('should set loading state correctly during initialization', async () => {
      let resolveSession: (value: any) => void;
      const sessionPromise = new Promise((resolve) => {
        resolveSession = resolve;
      });
      mockApiClient.createSession.mockReturnValue(sessionPromise);

      const { result } = renderHook(() => useChat());

      // Should be loading initially
      expect(result.current.loading).toBe(true);

      // Resolve session
      act(() => {
        resolveSession!({ sessionId: 'session-123', tenantId: 'test-tenant' });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should handle session creation failure with error message', async () => {
      const errorMessage = 'Network connection failed';
      mockApiClient.createSession.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useChat());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(errorMessage);
      expect(result.current.messages).toEqual([]);
    });

    it('should handle non-Error rejection with generic message', async () => {
      mockApiClient.createSession.mockRejectedValue('String error');

      const { result } = renderHook(() => useChat());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to initialize chat session');
    });

    it('should not re-initialize session on re-renders', async () => {
      mockApiClient.createSession.mockResolvedValue({
        sessionId: 'session-123',
        tenantId: 'test-tenant'
      });

      const { result, rerender } = renderHook(() => useChat());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const firstCallCount = mockApiClient.createSession.mock.calls.length;

      // Force re-render
      rerender();
      rerender();

      // Should not call createSession again
      expect(mockApiClient.createSession).toHaveBeenCalledTimes(firstCallCount);
    });
  });

  describe('Message Sending - Happy Path', () => {
    beforeEach(async () => {
      mockApiClient.createSession.mockResolvedValue({
        sessionId: 'session-123',
        tenantId: 'test-tenant'
      });
    });

    it('should add user message optimistically with correct structure', async () => {
      const { result } = renderHook(() => useChat());

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Mock streaming response
      mockApiClient.streamMessage.mockReturnValue((async function* () {
        yield { type: 'chunk', data: 'Hello' };
        yield { 
          type: 'completed', 
          message: { 
            id: 'msg-1', 
            role: 'assistant', 
            content: 'Hello there!', 
            createdAt: new Date().toISOString() 
          } 
        };
      })());

      await act(async () => {
        await result.current.sendMessage('Test message');
      });

      await waitFor(() => expect(result.current.sending).toBe(false));

      // Check user message structure
      const userMessage = result.current.messages[0];
      expect(userMessage.role).toBe('user');
      expect(userMessage.content).toBe('Test message');
      expect(userMessage.id).toMatch(/^temp-\d+$/);
      expect(userMessage.createdAt).toBeDefined();
      expect(new Date(userMessage.createdAt).getTime()).toBeGreaterThan(0);
    });

    it('should create placeholder assistant message', async () => {
      const { result } = renderHook(() => useChat());

      await waitFor(() => expect(result.current.loading).toBe(false));

      mockApiClient.streamMessage.mockReturnValue((async function* () {
        yield { type: 'chunk', data: 'Response' };
      })());

      await act(async () => {
        result.current.sendMessage('Hello');
      });

      // Should have user message and placeholder assistant message
      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
      });

      const assistantMessage = result.current.messages[1];
      expect(assistantMessage.role).toBe('assistant');
      expect(assistantMessage.id).toMatch(/^assistant-\d+$/);
      expect(assistantMessage.content).toBeDefined();
    });

    it('should accumulate streaming chunks and update content', async () => {
      const { result } = renderHook(() => useChat());

      await waitFor(() => expect(result.current.loading).toBe(false));

      mockApiClient.streamMessage.mockReturnValue((async function* () {
        yield { type: 'chunk', data: 'Hello' };
        yield { type: 'chunk', data: ' ' };
        yield { type: 'chunk', data: 'world' };
        yield { 
          type: 'completed', 
          message: { 
            id: 'msg-1', 
            role: 'assistant', 
            content: 'Hello world!', 
            createdAt: new Date().toISOString() 
          } 
        };
      })());

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      await waitFor(() => expect(result.current.sending).toBe(false));

      // Should have accumulated "Hello world"
      const finalMessage = result.current.messages[1];
      expect(finalMessage.content).toBe('Hello world!');
    });

    it('should update only the correct message during streaming', async () => {
      const { result } = renderHook(() => useChat());

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Send first message
      mockApiClient.streamMessage.mockReturnValueOnce((async function* () {
        yield { 
          type: 'completed', 
          message: { 
            id: 'msg-1', 
            role: 'assistant', 
            content: 'First response', 
            createdAt: new Date().toISOString() 
          } 
        };
      })());

      await act(async () => {
        await result.current.sendMessage('First');
      });

      await waitFor(() => expect(result.current.sending).toBe(false));

      const firstMessageCount = result.current.messages.length;

      // Send second message
      mockApiClient.streamMessage.mockReturnValueOnce((async function* () {
        yield { type: 'chunk', data: 'Second' };
        yield { 
          type: 'completed', 
          message: { 
            id: 'msg-2', 
            role: 'assistant', 
            content: 'Second response', 
            createdAt: new Date().toISOString() 
          } 
        };
      })());

      await act(async () => {
        await result.current.sendMessage('Second');
      });

      await waitFor(() => expect(result.current.sending).toBe(false));

      // First message should remain unchanged
      expect(result.current.messages[0].content).toBe('First');
      expect(result.current.messages[1].content).toBe('First response');
      expect(result.current.messages.length).toBeGreaterThan(firstMessageCount);
    });
  });

  describe('Message Sending - Completion', () => {
    beforeEach(async () => {
      mockApiClient.createSession.mockResolvedValue({
        sessionId: 'session-123',
        tenantId: 'test-tenant'
      });
    });

    it('should replace placeholder with final message on completion', async () => {
      const { result } = renderHook(() => useChat());

      await waitFor(() => expect(result.current.loading).toBe(false));

      const finalMessage: ChatMessage = {
        id: 'server-msg-1',
        role: 'assistant',
        content: 'Complete response from server',
        createdAt: new Date().toISOString()
      };

      mockApiClient.streamMessage.mockReturnValue((async function* () {
        yield { type: 'chunk', data: 'Partial' };
        yield { type: 'completed', message: finalMessage };
      })());

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      await waitFor(() => expect(result.current.sending).toBe(false));

      const assistantMessage = result.current.messages[1];
      expect(assistantMessage.id).toBe('server-msg-1');
      expect(assistantMessage.content).toBe('Complete response from server');
    });

    it('should set sending state to false after completion', async () => {
      const { result } = renderHook(() => useChat());

      await waitFor(() => expect(result.current.loading).toBe(false));

      mockApiClient.streamMessage.mockReturnValue((async function* () {
        yield { 
          type: 'completed', 
          message: { 
            id: 'msg-1', 
            role: 'assistant', 
            content: 'Done', 
            createdAt: new Date().toISOString() 
          } 
        };
      })());

      expect(result.current.sending).toBe(false);

      await act(async () => {
        result.current.sendMessage('Test');
      });

      await waitFor(() => {
        expect(result.current.sending).toBe(false);
      });
    });

    it('should preserve message order after completion', async () => {
      const { result } = renderHook(() => useChat());

      await waitFor(() => expect(result.current.loading).toBe(false));

      mockApiClient.streamMessage.mockReturnValue((async function* () {
        yield { 
          type: 'completed', 
          message: { 
            id: 'msg-1', 
            role: 'assistant', 
            content: 'Response', 
            createdAt: new Date().toISOString() 
          } 
        };
      })());

      await act(async () => {
        await result.current.sendMessage('First message');
      });

      await waitFor(() => expect(result.current.sending).toBe(false));

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].role).toBe('user');
      expect(result.current.messages[0].content).toBe('First message');
      expect(result.current.messages[1].role).toBe('assistant');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      mockApiClient.createSession.mockResolvedValue({
        sessionId: 'session-123',
        tenantId: 'test-tenant'
      });
    });

    it('should remove placeholder message on stream error', async () => {
      const { result } = renderHook(() => useChat());

      await waitFor(() => expect(result.current.loading).toBe(false));

      mockApiClient.streamMessage.mockReturnValue((async function* () {
        yield { type: 'chunk', data: 'Starting' };
        throw new Error('Stream failed');
      })());

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      await waitFor(() => {
        expect(result.current.sending).toBe(false);
      });

      // Should only have user message, assistant placeholder removed
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].role).toBe('user');
    });

    it('should set error state when streaming fails', async () => {
      const { result } = renderHook(() => useChat());

      await waitFor(() => expect(result.current.loading).toBe(false));

      const errorMessage = 'Connection timeout';
      mockApiClient.streamMessage.mockReturnValue((async function* () {
        throw new Error(errorMessage);
      })());

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage);
      });
    });

    it('should prevent sending when already sending', async () => {
      const { result } = renderHook(() => useChat());

      await waitFor(() => expect(result.current.loading).toBe(false));

      let resolveStream: () => void;
      const streamPromise = new Promise<void>((resolve) => {
        resolveStream = resolve;
      });

      mockApiClient.streamMessage.mockReturnValue((async function* () {
        await streamPromise;
        yield { 
          type: 'completed', 
          message: { 
            id: 'msg-1', 
            role: 'assistant', 
            content: 'Done', 
            createdAt: new Date().toISOString() 
          } 
        };
      })());

      // Start first message
      act(() => {
        result.current.sendMessage('First');
      });

      await waitFor(() => expect(result.current.sending).toBe(true));

      const messageCountDuringSend = result.current.messages.length;

      // Try to send second message while first is in progress
      act(() => {
        result.current.sendMessage('Second');
      });

      // Should not add new messages
      expect(result.current.messages.length).toBe(messageCountDuringSend);

      // Resolve stream
      act(() => {
        resolveStream!();
      });

      await waitFor(() => expect(result.current.sending).toBe(false));
    });

    it('should prevent sending without valid sessionId', async () => {
      mockApiClient.createSession.mockRejectedValue(new Error('Session failed'));

      const { result } = renderHook(() => useChat());

      await waitFor(() => expect(result.current.loading).toBe(false));

      const initialMessageCount = result.current.messages.length;

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      // Should not send or add messages
      expect(result.current.messages.length).toBe(initialMessageCount);
      expect(mockApiClient.streamMessage).not.toHaveBeenCalled();
    });

    it('should clear previous errors when sending new message', async () => {
      const { result } = renderHook(() => useChat());

      await waitFor(() => expect(result.current.loading).toBe(false));

      // First message fails
      mockApiClient.streamMessage.mockReturnValueOnce((async function* () {
        throw new Error('First error');
      })());

      await act(async () => {
        await result.current.sendMessage('First');
      });

      await waitFor(() => {
        expect(result.current.error).toBe('First error');
      });

      // Second message succeeds
      mockApiClient.streamMessage.mockReturnValueOnce((async function* () {
        yield { 
          type: 'completed', 
          message: { 
            id: 'msg-1', 
            role: 'assistant', 
            content: 'Success', 
            createdAt: new Date().toISOString() 
          } 
        };
      })());

      await act(async () => {
        await result.current.sendMessage('Second');
      });

      await waitFor(() => {
        expect(result.current.sending).toBe(false);
      });

      // Error should be cleared
      expect(result.current.error).toBe(null);
    });

    it('should handle error event from stream', async () => {
      const { result } = renderHook(() => useChat());

      await waitFor(() => expect(result.current.loading).toBe(false));

      mockApiClient.streamMessage.mockReturnValue((async function* () {
        yield { type: 'chunk', data: 'Starting' };
        yield { type: 'error', error: 'Server error occurred' };
      })());

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      await waitFor(() => {
        expect(result.current.error).toContain('Server error occurred');
      });

      // Placeholder should be removed
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].role).toBe('user');
    });

    it('should handle non-Error exception with generic message', async () => {
      const { result } = renderHook(() => useChat());

      await waitFor(() => expect(result.current.loading).toBe(false));

      mockApiClient.streamMessage.mockReturnValue((async function* () {
        throw 'String error';
      })());

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to send message');
      });
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      mockApiClient.createSession.mockResolvedValue({
        sessionId: 'session-123',
        tenantId: 'test-tenant'
      });
    });

    it('should handle stream exit without completion event', async () => {
      const { result } = renderHook(() => useChat());

      await waitFor(() => expect(result.current.loading).toBe(false));

      mockApiClient.streamMessage.mockReturnValue((async function* () {
        yield { type: 'chunk', data: 'Incomplete' };
        // Generator exits without 'completed' event
      })());

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      await waitFor(() => {
        expect(result.current.sending).toBe(false);
      });

      // Should mark sending as false even without completion
      expect(result.current.sending).toBe(false);
    });

    it('should properly generate unique message IDs', async () => {
      const { result } = renderHook(() => useChat());

      await waitFor(() => expect(result.current.loading).toBe(false));

      mockApiClient.streamMessage.mockReturnValue((async function* () {
        yield { 
          type: 'completed', 
          message: { 
            id: 'msg-1', 
            role: 'assistant', 
            content: 'Response', 
            createdAt: new Date().toISOString() 
          } 
        };
      })());

      await act(async () => {
        await result.current.sendMessage('First');
      });

      await waitFor(() => expect(result.current.sending).toBe(false));

      const firstUserMsgId = result.current.messages[0].id;

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 5));

      mockApiClient.streamMessage.mockReturnValue((async function* () {
        yield { 
          type: 'completed', 
          message: { 
            id: 'msg-2', 
            role: 'assistant', 
            content: 'Response 2', 
            createdAt: new Date().toISOString() 
          } 
        };
      })());

      await act(async () => {
        await result.current.sendMessage('Second');
      });

      await waitFor(() => expect(result.current.sending).toBe(false));

      const secondUserMsgId = result.current.messages[2].id;

      // IDs should be unique
      expect(firstUserMsgId).not.toBe(secondUserMsgId);
      expect(firstUserMsgId).toMatch(/^temp-\d+$/);
      expect(secondUserMsgId).toMatch(/^temp-\d+$/);
    });

    it('should handle empty content in streaming chunks', async () => {
      const { result } = renderHook(() => useChat());

      await waitFor(() => expect(result.current.loading).toBe(false));

      mockApiClient.streamMessage.mockReturnValue((async function* () {
        yield { type: 'chunk', data: '' };
        yield { type: 'chunk', data: 'Content' };
        yield { type: 'chunk', data: '' };
        yield { 
          type: 'completed', 
          message: { 
            id: 'msg-1', 
            role: 'assistant', 
            content: 'Content', 
            createdAt: new Date().toISOString() 
          } 
        };
      })());

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      await waitFor(() => expect(result.current.sending).toBe(false));

      expect(result.current.messages[1].content).toBe('Content');
    });

    it('should maintain state consistency after multiple errors', async () => {
      const { result } = renderHook(() => useChat());

      await waitFor(() => expect(result.current.loading).toBe(false));

      // First error
      mockApiClient.streamMessage.mockReturnValueOnce((async function* () {
        throw new Error('Error 1');
      })());

      await act(async () => {
        await result.current.sendMessage('Message 1');
      });

      await waitFor(() => expect(result.current.error).toBe('Error 1'));

      const messagesAfterFirstError = result.current.messages.length;

      // Second error
      mockApiClient.streamMessage.mockReturnValueOnce((async function* () {
        throw new Error('Error 2');
      })());

      await act(async () => {
        await result.current.sendMessage('Message 2');
      });

      await waitFor(() => expect(result.current.error).toBe('Error 2'));

      // Should have only user messages (placeholders removed)
      expect(result.current.messages.length).toBe(messagesAfterFirstError + 1);
      expect(result.current.messages.every(m => m.role === 'user')).toBe(true);
      expect(result.current.sending).toBe(false);
    });

    it('should handle stream with only error event (no chunks)', async () => {
      const { result } = renderHook(() => useChat());

      await waitFor(() => expect(result.current.loading).toBe(false));

      mockApiClient.streamMessage.mockReturnValue((async function* () {
        yield { type: 'error', error: 'Immediate error' };
      })());

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      await waitFor(() => {
        expect(result.current.error).toContain('Immediate error');
      });

      // Should have removed placeholder
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].role).toBe('user');
      expect(result.current.sending).toBe(false);
    });

    it('should handle rapid completion events', async () => {
      const { result } = renderHook(() => useChat());

      await waitFor(() => expect(result.current.loading).toBe(false));

      mockApiClient.streamMessage.mockReturnValue((async function* () {
        yield { 
          type: 'completed', 
          message: { 
            id: 'msg-1', 
            role: 'assistant', 
            content: 'Fast response', 
            createdAt: new Date().toISOString() 
          } 
        };
        // Extra completion event (shouldn't happen but test robustness)
        yield { 
          type: 'completed', 
          message: { 
            id: 'msg-2', 
            role: 'assistant', 
            content: 'Second completion', 
            createdAt: new Date().toISOString() 
          } 
        };
      })());

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      await waitFor(() => expect(result.current.sending).toBe(false));

      // Should only have 2 messages (user + first completion)
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1].content).toBe('Fast response');
    });
  });
});

