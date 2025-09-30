import { useState, useEffect, useCallback } from 'preact/hooks';
import { ApiClient, type ChatMessage } from '@tiny-chatbot/shared';
import { getConfig } from '../config';

interface ChatState {
  sessionId: string | null;
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  sending: boolean;
}

export function useChat() {
  const [state, setState] = useState<ChatState>({
    sessionId: null,
    messages: [],
    loading: true,
    error: null,
    sending: false
  });

  const config = getConfig();
  const client = new ApiClient({ baseUrl: config.apiBaseUrl });

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const response = await client.createSession({
          tenantId: config.tenantId,
          userId: config.userId,
          traits: config.traits
        });

        setState(prev => ({
          ...prev,
          sessionId: response.sessionId,
          loading: false
        }));
      } catch (error) {
        console.error('Failed to create session:', error);
        setState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to initialize chat session'
        }));
      }
    };

    initSession();
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!state.sessionId || state.sending) return;

    // Add user message optimistically
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString()
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      sending: true,
      error: null
    }));

    try {
      const response = await client.sendMessage({
        sessionId: state.sessionId,
        message: content
      });

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, response.message],
        sending: false
      }));
    } catch (error) {
      console.error('Failed to send message:', error);
      setState(prev => ({
        ...prev,
        sending: false,
        error: error instanceof Error ? error.message : 'Failed to send message'
      }));
    }
  }, [state.sessionId, state.sending]);

  return {
    messages: state.messages,
    loading: state.loading,
    error: state.error,
    sending: state.sending,
    sendMessage
  };
}