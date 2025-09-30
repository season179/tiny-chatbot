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
      // Create a placeholder for the assistant's streaming message
      const assistantMessageId = `assistant-${Date.now()}`;
      let accumulatedContent = '';

      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString()
      };

      // Add placeholder message
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage]
      }));

      try {
        // Stream the response
        const streamStart = Date.now();
        let chunkCount = 0;
        console.log(`[useChat ${new Date().toISOString()}] Starting to consume stream...`);

        for await (const event of client.streamMessage({
          sessionId: state.sessionId,
          message: content
        })) {
          if (event.type === 'chunk') {
            chunkCount++;
            const elapsed = Date.now() - streamStart;
            console.log(`[useChat +${elapsed}ms] Processing chunk #${chunkCount}, length: ${event.data?.length}`);

            accumulatedContent += event.data;

            const updateStart = Date.now();
            // Update the assistant message with accumulated content
            setState(prev => ({
              ...prev,
              messages: prev.messages.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, content: accumulatedContent }
                  : msg
              )
            }));
            const updateDuration = Date.now() - updateStart;
            console.log(`[useChat +${Date.now() - streamStart}ms] setState completed in ${updateDuration}ms`);
          } else if (event.type === 'completed') {
            console.log(`[useChat +${Date.now() - streamStart}ms] Stream completed, received ${chunkCount} chunks`);
            // Replace placeholder with final message from server
            setState(prev => ({
              ...prev,
              messages: prev.messages.map(msg =>
                msg.id === assistantMessageId ? event.message : msg
              ),
              sending: false
            }));
            return; // Successfully completed
          } else if (event.type === 'error') {
            throw new Error(event.error);
          }
        }

        // If we exit the loop without getting a 'completed' event, mark as done anyway
        setState(prev => ({
          ...prev,
          sending: false
        }));
      } catch (streamError) {
        // Remove placeholder message on error
        setState(prev => ({
          ...prev,
          messages: prev.messages.filter(msg => msg.id !== assistantMessageId),
          sending: false
        }));
        throw streamError;
      }
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