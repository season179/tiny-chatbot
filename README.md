# Tiny Chatbot

A lightweight, embeddable chatbot with a Fastify backend and Preact widget. Features full type safety, comprehensive testing, and a clean API design ready for LLM integration.

## Product Overview
- **Embeddable Widget**: Floating chat bubble that expands into a messenger-style panel
- **Standalone Backend**: Fastify API server with session management and conversation handling
- **Agentic Shell Tools**: AI can autonomously execute sandboxed shell commands to inspect files and directories
- **Type-Safe Contracts**: Shared TypeScript types and Zod schemas across frontend and backend
- **Production Ready**: Full test coverage (153 tests), configuration validation, and structured architecture

## Repository Layout
- `apps/server` – Fastify backend with REST API, session management, and conversation service
- `packages/widget` – Preact-based embed built with Vite, exposes `window.TinyChatbotSDK`
- `packages/shared` – Shared TypeScript types, Zod schemas, and API client library
- Root configuration – Turborepo + pnpm workspace, Biome for lint/format, strict TypeScript settings

## Agentic Capabilities

The chatbot features autonomous shell tool execution, allowing the AI to inspect files and directories to provide more accurate, context-aware responses.

### Available Tools
The AI assistant can use the following sandboxed shell commands:
- **`cat`** – Read file contents
- **`ls`** – List directory contents with optional hidden files
- **`grep`** – Search for patterns in files
- **`rg`** (ripgrep) – Faster pattern searching across directories
- **`head`** / **`tail`** – Display first/last N lines of files
- **`pwd`** – Show current working directory
- **`echo`** – Display text or variable values
- **`wc`** – Count lines, words, and bytes in files
- **`which`** – Locate command paths

### How It Works
1. **User sends a message** that requires file inspection (e.g., "What's in my config file?")
2. **AI decides** which tools to use and makes tool calls
3. **Backend executes** approved commands in the sandbox
4. **AI receives** command output and continues reasoning
5. **Process repeats** up to `MAX_TOOL_ROUNDS` times (default: 10)
6. **Final response** is returned to the user with synthesized information

### Security & Sandboxing
All tool execution is protected by multiple security layers:

- ✅ **Command Allowlist**: Only pre-approved commands can execute
- ✅ **Path Restrictions**: All file operations are confined to `SHELL_SANDBOX_WORKING_DIR`
- ✅ **Output Limits**: Command output is capped at `SHELL_SANDBOX_MAX_OUTPUT_BYTES` (default: 16KB)
- ✅ **Execution Timeouts**: Commands are killed after `SHELL_SANDBOX_TIMEOUT_MS` (default: 5s)
- ✅ **Secret Redaction**: Environment variables and sensitive patterns are filtered from output
- ✅ **Round Limits**: Maximum tool rounds prevents infinite loops

**Configuration** (see `.env.example` for full details):
```bash
# Enable/disable tool execution
SHELL_SANDBOX_ENABLED=false

# Comma-separated command allowlist
SHELL_SANDBOX_ALLOWED_COMMANDS=cat,ls,rg,head,tail

# Restrict file access to this directory
SHELL_SANDBOX_WORKING_DIR=./

# Output size limit in bytes (16KB default)
SHELL_SANDBOX_MAX_OUTPUT_BYTES=16384

# Command timeout in milliseconds (5s default)
SHELL_SANDBOX_TIMEOUT_MS=5000

# Maximum autonomous tool rounds (10 default)
MAX_TOOL_ROUNDS=10
```

### Example Conversation
```
User: "Can you check what files are in my src directory?"

AI: [Uses ls tool to list src/]
    [Uses cat to read interesting files]
    "Your src directory contains 12 TypeScript files including
    index.ts (entry point), config.ts (configuration), and
    server.ts (main server). The entry point imports Fastify
    and starts the server on port 4000."
```

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
# Run all server tests (153 tests with Vitest)
pnpm --filter @tiny-chatbot/server test

# Run tests in watch mode
pnpm --filter @tiny-chatbot/server test:watch

# Run with coverage
pnpm --filter @tiny-chatbot/server test:coverage

# Test suites include:
# - Unit tests (core services, tools, validation)
# - Integration tests (end-to-end agentic loops)
# - Performance tests (tool execution benchmarks)
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
- ✅ Session management with SQLite persistence
- ✅ OpenAI integration with GPT-5 support
- ✅ Agentic tool execution (10 sandboxed shell commands)
- ✅ Autonomous multi-turn reasoning (up to 10 tool rounds)
- ✅ Streaming chat support (Server-Sent Events)
- ✅ Request validation with Zod schemas
- ✅ Environment configuration with validation
- ✅ Comprehensive test coverage (153 tests: unit, integration, performance)

**API Endpoints**:
- `GET /healthz` - Health check
- `POST /api/session` - Create chat session
- `POST /api/chat` - Send message (non-streaming)
- `POST /api/chat/stream` - Send message (streaming)
- `POST /api/feedback` - Submit message feedback

**Configuration** (`.env` - see `.env.example` for all options):
```bash
# Server
NODE_ENV=development
PORT=4000
HOST=0.0.0.0
CORS_ORIGIN=*
CORS_CREDENTIALS=false
LOG_LEVEL=info

# OpenAI
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-5
MAX_TOOL_ROUNDS=10

# Database
DATABASE_PATH=./data/sessions.db

# Agentic Tools (optional)
SHELL_SANDBOX_ENABLED=false
SHELL_SANDBOX_ALLOWED_COMMANDS=cat,ls,rg,head,tail
SHELL_SANDBOX_WORKING_DIR=./
SHELL_SANDBOX_MAX_OUTPUT_BYTES=16384
SHELL_SANDBOX_TIMEOUT_MS=5000
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
- [x] OpenAI GPT-5 integration with streaming support
- [x] SQLite session persistence with migrations
- [x] Agentic shell tool execution (10 commands)
- [x] Autonomous multi-turn reasoning loops
- [x] Sandboxed tool environment (path restrictions, output limits, timeouts)
- [x] Request validation with Zod schemas
- [x] Environment configuration with validation
- [x] Comprehensive test coverage (153 tests: unit, integration, performance)
- [x] Shared type contracts and API client
- [x] Widget integration with streaming backend
- [x] Message display and input components
- [x] Error handling and loading states

### Architecture Ready For 🚀
- Authentication/authorization (JWT, API keys)
- Rate limiting (per-tenant, per-tool)
- Multi-tenancy enhancements (tenant-specific tool configs)
- Analytics and monitoring (tool usage tracking)
- Production deployment (Docker, K8s)
- Additional tool providers (MCP servers, custom integrations)

## Future Enhancements
1. **Feature Flags**: Add `ENABLE_AGENTIC_TOOLS` toggle for gradual rollout
2. **Tool Usage Limits**: Per-session rate limiting and cooldown periods
3. **Enhanced Tools**: Add write operations (with stricter controls) and network tools
4. **Tool Analytics**: Track usage patterns, success rates, and latency metrics
5. **Multi-tenancy**: Tenant-specific tool allowlists and sandbox configurations
6. **Authentication**: Add API key or JWT validation for secure access
7. **Advanced Sandboxing**: Container-based isolation for enhanced security
8. **Observability**: Structured logging, metrics, and distributed tracing
