# @tiny-chatbot/shared

Shared TypeScript types, Zod schemas, and API client for the tiny-chatbot monorepo.

## Purpose

This package provides type-safe contracts between the widget (frontend) and server (backend), ensuring consistency and catching type errors at compile time.

## Structure

```
src/
├── api/
│   ├── common.ts      # Shared types (ChatMessage, ChatRole, ChatSession)
│   ├── session.ts     # Session creation request/response
│   ├── chat.ts        # Chat & streaming request/response
│   ├── feedback.ts    # Feedback submission
│   └── errors.ts      # Error response types
├── client/
│   └── api-client.ts  # Ready-to-use API client for widget
└── index.ts           # Main exports
```

## Usage

### In the Server

```typescript
import { createSessionRequestSchema, ChatMessage } from '@tiny-chatbot/shared';

// Use schemas for validation
const result = createSessionRequestSchema.safeParse(request.body);
```

### In the Widget

```typescript
import { ApiClient } from '@tiny-chatbot/shared';

// Create client
const client = new ApiClient({
  baseUrl: 'http://localhost:4000'
});

// Create session
const session = await client.createSession({
  tenantId: 'my-tenant',
  userId: 'user-123'
});

// Send message (non-streaming)
const response = await client.sendMessage({
  sessionId: session.sessionId,
  message: 'Hello!'
});

// Send message with streaming
for await (const event of client.streamMessage({
  sessionId: session.sessionId,
  message: 'Hello!'
})) {
  if (event.type === 'chunk') {
    console.log(event.data);
  } else if (event.type === 'completed') {
    console.log('Done:', event.message);
  }
}

// Submit feedback
await client.submitFeedback({
  sessionId: session.sessionId,
  messageId: 'msg-id',
  score: 'up',
  comments: 'Great response!'
});
```

## API Contracts

### Session Management

- **POST /api/session** - Create a new chat session
  - Request: `CreateSessionRequest`
  - Response: `CreateSessionResponse`

### Chat

- **POST /api/chat** - Send a message (non-streaming)
  - Request: `ChatRequest`
  - Response: `ChatResponse`

- **POST /api/chat/stream** - Send a message with streaming response
  - Request: `StreamChatRequest`
  - Response: Server-Sent Events (`StreamEvent`)

### Feedback

- **POST /api/feedback** - Submit feedback on a message
  - Request: `FeedbackRequest`
  - Response: `FeedbackResponse`

## Type Safety

All request/response types have corresponding Zod schemas for runtime validation:

- Types are inferred from schemas using `z.infer<typeof schema>`
- Schemas are exported for use in validation
- Server validates all incoming requests using these schemas
- Widget gets full TypeScript autocomplete and type checking

## Error Handling

The `ApiClientError` class wraps HTTP errors with structured error information:

```typescript
try {
  await client.sendMessage({ ... });
} catch (error) {
  if (error instanceof ApiClientError) {
    console.error(`HTTP ${error.status}: ${error.apiError.error}`);
  }
}
```