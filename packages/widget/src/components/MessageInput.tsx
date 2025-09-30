import { useState } from 'preact/hooks';

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        gap: '8px',
        padding: '16px',
        borderTop: '1px solid #e2e8f0'
      }}
    >
      <input
        type="text"
        placeholder={disabled ? 'Sending...' : 'Type your message...'}
        value={input}
        onInput={(e) => setInput((e.target as HTMLInputElement).value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        style={{
          flex: 1,
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid #cbd5e1',
          outline: 'none',
          fontSize: '14px',
          fontFamily: 'system-ui'
        }}
      />
      <button
        type="submit"
        disabled={disabled || !input.trim()}
        style={{
          padding: '8px 16px',
          borderRadius: '8px',
          border: 'none',
          background: disabled || !input.trim() ? '#cbd5e1' : '#2563eb',
          color: '#ffffff',
          cursor: disabled || !input.trim() ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: 500
        }}
      >
        Send
      </button>
    </form>
  );
}