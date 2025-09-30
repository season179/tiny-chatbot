import { useState } from 'preact/hooks';
import { useChat } from './hooks/useChat';
import { MessageList } from './components/MessageList';
import { MessageInput } from './components/MessageInput';

export function WidgetRoot() {
  const [open, setOpen] = useState(false);
  const { messages, loading, error, sending, sendMessage } = useChat();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '9999px',
          border: 'none',
          background: '#2563eb',
          color: '#fff',
          boxShadow: '0 10px 25px rgba(37, 99, 235, 0.35)',
          cursor: 'pointer',
          fontSize: '24px'
        }}
      >
        💬
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '360px',
        maxWidth: 'calc(100% - 48px)',
        height: '480px',
        maxHeight: 'calc(100% - 96px)',
        borderRadius: '16px',
        background: '#ffffff',
        boxShadow: '0 18px 40px rgba(15, 23, 42, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <header
        style={{
          padding: '16px',
          background: '#1f2937',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span style={{ fontWeight: 600 }}>Tiny Chatbot</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            appearance: 'none',
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          ✕
        </button>
      </header>

      {error ? (
        <div
          style={{
            padding: '16px',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#dc2626',
            textAlign: 'center',
            fontFamily: 'system-ui'
          }}
        >
          <div>
            <p style={{ margin: 0, marginBottom: '8px', fontWeight: 500 }}>⚠️ Error</p>
            <p style={{ margin: 0, fontSize: '14px' }}>{error}</p>
          </div>
        </div>
      ) : (
        <>
          <MessageList messages={messages} loading={loading} />
          <MessageInput onSend={sendMessage} disabled={sending} />
        </>
      )}
    </div>
  );
}
