# Tiny Chatbot

A lightweight, embeddable chatbot with a Fastify backend and Preact widget. Features full type safety, comprehensive testing, and a clean API design ready for LLM integration.

## Product Overview
- **Embeddable Widget**: Floating chat bubble that expands into a messenger-style panel
- **Standalone Backend**: Fastify API server with session management and conversation handling
- **Type-Safe Contracts**: Shared TypeScript types and Zod schemas across frontend and backend
- **Production Ready**: Full test coverage, configuration validation, and structured architecture

## Repository Layout
- `apps/server` – Fastify backend with REST API, session management, and conversation service
- `packages/widget` – Preact-based embed built with Vite, exposes `window.TinyChatbotSDK`
- `packages/shared` – Shared TypeScript types, Zod schemas, and API client library
- Root configuration – Turborepo + pnpm workspace, Biome for lint/format, strict TypeScript settings

## Getting Started

### Prerequisites
- Node.js 20+ (recommended 22.x)
- pnpm 8+ (`corepack enable pnpm`)

### Installation
```bash
pnpm install
```

### Development
```bash
# Run both server and widget in development mode
pnpm dev

# Or run individually:
pnpm --filter @tiny-chatbot/server dev  # Backend API on http://localhost:4000
pnpm --filter @tiny-chatbot/widget dev  # Widget dev server
```

### Testing
```bash
# Run server tests (62 tests with Vitest)
pnpm --filter @tiny-chatbot/server test

# Run tests in watch mode
pnpm --filter @tiny-chatbot/server test:watch

# Run with coverage
pnpm --filter @tiny-chatbot/server test:coverage
```

### Building
```bash
# Build everything
pnpm build

# Build individually
pnpm --filter @tiny-chatbot/server build
pnpm --filter @tiny-chatbot/widget build
```

### Linting
```bash
pnpm lint  # Biome across entire workspace
```

## Architecture

### Backend (`apps/server`)
**Tech Stack**: Fastify, TypeScript, Zod, Vitest

**Features**:
- ✅ RESTful API with CORS support
- ✅ Session management (in-memory store)
- ✅ Conversation service with canned responses
- ✅ Streaming chat support (Server-Sent Events)
- ✅ Request validation with Zod schemas
- ✅ Environment configuration with validation
- ✅ Comprehensive test coverage (62 tests)

**API Endpoints**:
- `GET /healthz` - Health check
- `POST /api/session` - Create chat session
- `POST /api/chat` - Send message (non-streaming)
- `POST /api/chat/stream` - Send message (streaming)
- `POST /api/feedback` - Submit message feedback

**Configuration** (`.env`):
```bash
NODE_ENV=development
PORT=4000
HOST=0.0.0.0
CORS_ORIGIN=*
CORS_CREDENTIALS=false
LOG_LEVEL=info
```

### Frontend (`packages/widget`)
**Tech Stack**: Preact, TypeScript, Vite

**Features**:
- ✅ Floating chat button (bottom-right)
- ✅ Expandable chat panel
- ✅ Message display with user/assistant styling
- ✅ Real-time message sending
- ✅ Loading and error states
- ✅ Auto-scroll to latest message
- ✅ Type-safe API integration

**Integration**:
```html
<script type="module" src="widget.es.js"></script>
<script type="module">
  window.TinyChatbotSDK.mount({
    apiBaseUrl: 'http://localhost:4000',
    tenantId: 'my-tenant',
    userId: 'user-123'
  });
</script>
```

### Shared Contracts (`packages/shared`)
**Tech Stack**: TypeScript, Zod

**Exports**:
- Type-safe request/response contracts
- Zod schemas for validation
- `ApiClient` class for easy integration
- Error types and utilities

**Usage**:
```typescript
import { ApiClient, type ChatMessage } from '@tiny-chatbot/shared';

const client = new ApiClient({ baseUrl: 'http://localhost:4000' });

// Create session
const session = await client.createSession({
  tenantId: 'demo',
  userId: 'user123'
});

// Send message
const response = await client.sendMessage({
  sessionId: session.sessionId,
  message: 'Hello!'
});

// Stream message
for await (const event of client.streamMessage({
  sessionId: session.sessionId,
  message: 'Hello!'
})) {
  if (event.type === 'chunk') console.log(event.data);
}
```

## Project Status

### Completed ✅
- [x] Fastify backend with REST API
- [x] Session management and conversation service
- [x] Streaming chat support (SSE)
- [x] Request validation with Zod
- [x] Environment configuration with validation
- [x] Comprehensive test coverage (62 tests passing)
- [x] Shared type contracts and API client
- [x] Widget integration with backend
- [x] Message display and input components
- [x] Error handling and loading states

### Architecture Ready For 🚀
- LLM integration (swap canned responses in `ConversationService`)
- Database persistence (implement new `SessionStore`)
- Authentication/authorization
- Rate limiting
- Analytics and monitoring
- Production deployment

## Future Enhancements
1. **LLM Integration**: Replace canned responses with real LLM calls in `ConversationService.ts`
2. **Database**: Add PostgreSQL/Redis for persistent sessions
3. **Streaming UI**: Add typing indicators for streaming responses
4. **Feedback**: Wire up feedback endpoint to analytics
5. **Multi-tenancy**: Add tenant isolation and configuration
6. **Authentication**: Add API key or JWT validation
7. **Rate Limiting**: Add per-tenant rate limits
8. **Analytics**: Track usage metrics and conversation quality
