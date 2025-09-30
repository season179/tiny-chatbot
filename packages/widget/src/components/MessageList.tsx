import { useEffect, useRef } from 'preact/hooks';
import type { ChatMessage } from '@tiny-chatbot/shared';

interface MessageListProps {
  messages: ChatMessage[];
  loading?: boolean;
}

export function MessageList({ messages, loading }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (loading) {
    return (
      <div
        style={{
          padding: '16px',
          flex: 1,
          overflowY: 'auto',
          fontFamily: 'system-ui',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6b7280'
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      style={{
        padding: '16px',
        flex: 1,
        overflowY: 'auto',
        fontFamily: 'system-ui',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      {messages.length === 0 ? (
        <div style={{ color: '#9ca3af', textAlign: 'center', marginTop: '2rem' }}>
          <p style={{ margin: 0 }}>👋 Welcome! How can I help you today?</p>
        </div>
      ) : (
        messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: 'flex',
              justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            <div
              style={{
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: '12px',
                background: message.role === 'user' ? '#2563eb' : '#f3f4f6',
                color: message.role === 'user' ? '#ffffff' : '#1f2937',
                wordBreak: 'break-word',
                fontSize: '14px',
                lineHeight: '1.5'
              }}
            >
              {message.content}
            </div>
          </div>
        ))
      )}
    </div>
  );
}