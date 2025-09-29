import { useState } from 'preact/hooks';

export function WidgetRoot() {
  const [open, setOpen] = useState(false);

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
          cursor: 'pointer'
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
      <div style={{ padding: '16px', flex: 1, overflowY: 'auto', fontFamily: 'system-ui' }}>
        <p style={{ marginTop: 0 }}>
          Chat UI placeholder. Wire this up to backend messaging APIs and context bridge.
        </p>
      </div>
      <form
        style={{
          display: 'flex',
          gap: '8px',
          padding: '16px',
          borderTop: '1px solid #e2e8f0'
        }}
      >
        <input
          type="text"
          placeholder="Type your message..."
          style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5f5' }}
          disabled
        />
        <button type="submit" disabled style={{ padding: '8px 16px', borderRadius: '8px' }}>
          Send
        </button>
      </form>
    </div>
  );
}
