# OpenAI Responses API Integration Plan

## Status: ✅ Phase 1 Complete - ✅ Phase 2.1 Complete - ✅ Phase 2.2 Complete

---

## Phase 1: OpenAI Integration ✅ COMPLETE

### Overview
Integrated OpenAI's Responses API with `gpt-5` model to replace canned responses.

### Completed Tasks

- [x] **Install OpenAI SDK**
  - Added `openai` package to server dependencies
  - File: `apps/server/package.json`

- [x] **Environment Configuration**
  - Updated config schema with OpenAI variables
  - Added: `OPENAI_API_KEY` (required), `OPENAI_MODEL`, `OPENAI_MAX_OUTPUT_TOKENS`, `OPENAI_TEMPERATURE`
  - Files: `apps/server/src/config.ts`, `apps/server/.env.example`

- [x] **OpenAI Service Implementation**
  - Created `OpenAIService` with streaming and non-streaming support
  - Implemented error handling with `OpenAIError` class
  - Converts internal message format to OpenAI's Responses API format
  - File: `apps/server/src/services/OpenAIService.ts`

- [x] **Update ConversationService**
  - Integrated OpenAIService into ConversationService
  - Made `handleUserMessage()` async
  - Updated `handleUserMessageStreaming()` to async generator
  - Maintains conversation history across turns
  - File: `apps/server/src/services/ConversationService.ts`

- [x] **Update Routes**
  - Made chat route async to handle OpenAI responses
  - Updated streaming route for real-time SSE streaming
  - Files: `apps/server/src/routes/chat.ts`, `apps/server/src/routes/streamChat.ts`

- [x] **Wire Dependencies**
  - Instantiated OpenAIService in server
  - Injected into ConversationService
  - File: `apps/server/src/server.ts`

- [x] **Comprehensive Testing**
  - Created unit tests for OpenAIService
  - Updated ConversationService tests with mocks
  - Updated route tests with OpenAI SDK mocks
  - **Result: 70/70 tests passing** ✅
  - Files: `apps/server/src/services/*.test.ts`, `apps/server/src/routes/*.test.ts`

---

## Phase 2: Production Readiness 🎯 NEXT STEPS

### 2.1 Session Persistence with SQLite ✅ COMPLETE

**Why:** Currently using `InMemorySessionStore` - all conversation history is lost on server restart.

**Tech Stack:** SQLite + Drizzle ORM

**Completed Tasks:**
- [x] Install dependencies: `drizzle-orm`, `better-sqlite3`, `drizzle-kit`, `@types/better-sqlite3`
- [x] Create Drizzle schema for sessions and messages
  - Tables: `sessions`, `messages`
  - File: `apps/server/src/db/schema.ts`
- [x] Implement `SqliteSessionStore` class
  - Methods: `createSession()`, `getSession()`, `appendMessage()`
  - File: `apps/server/src/repositories/SqliteSessionStore.ts`
- [x] Add SQLite database path to config
  - Added `DATABASE_PATH` to config schema (default: `./data/sessions.db`)
  - Files: `apps/server/src/config.ts`, `apps/server/.env.example`
- [x] Create migration scripts with Drizzle Kit
  - Scripts: `db:generate`, `db:migrate`, `db:studio`
  - File: `apps/server/package.json`
  - Generated migration: `drizzle/0000_amusing_rafael_vega.sql`
- [x] Create database connection utility
  - File: `apps/server/src/db/index.ts`
  - Auto-creates tables for in-memory databases (tests)
  - Supports migration-based setup for production
- [x] Update server to use `SqliteSessionStore` instead of `InMemorySessionStore`
  - File: `apps/server/src/server.ts`
  - Added graceful shutdown hook
- [x] Write comprehensive tests for `SqliteSessionStore`
  - File: `apps/server/src/repositories/SqliteSessionStore.test.ts`
  - 15 tests covering all functionality
- [x] All tests passing: **85/85 tests** ✅

**Usage:**
```bash
# The server will automatically create the database on startup
# Database is created at ./data/sessions.db (configurable via DATABASE_PATH env var)

# To use a different database path:
DATABASE_PATH=./my-custom-path/sessions.db pnpm dev

# For production, you can optionally run migrations manually:
pnpm db:generate  # Generate new migrations after schema changes
pnpm db:migrate   # Apply migrations to database
pnpm db:studio    # Open Drizzle Studio to inspect database
```

**Effort:** Medium (4-6 hours) - Completed!

---

### 2.2 System Instructions & Prompts ✅ COMPLETE

**Why:** Enable tenant-specific personalities and conversation context.

**Approach:** Store system prompts in config file (`prompts.json`)

**Completed Tasks:**
- [x] Create `apps/server/config/prompts.json` file
  - Structure: `{ "_default": "...", "tenant-id": "..." }`
  - Added default prompt and example tenant-specific prompts
  - File: `apps/server/config/prompts.json`
- [x] Create `PromptService` to load and manage prompts
  - Methods: `getPromptForTenant()`, `getDefaultPrompt()`, `hasTenantPrompt()`, `getTenantIds()`
  - Singleton pattern for easy access
  - Graceful error handling for missing config
  - File: `apps/server/src/services/PromptService.ts`
- [x] Update ConversationService to prepend system messages
  - Added `prependSystemPrompt()` method
  - System prompts are not persisted (only added for API calls)
  - Optional PromptService parameter for backward compatibility
  - File: `apps/server/src/services/ConversationService.ts`
- [x] Add system role support to OpenAIService message conversion
  - Updated `convertMessagesToOpenAIFormat()` to handle 'system' role
  - File: `apps/server/src/services/OpenAIService.ts`
- [x] Wire PromptService into server
  - Added to `buildServer()` with graceful fallback
  - Logs initialization status
  - File: `apps/server/src/server.ts`
- [x] Comprehensive testing
  - Created 19 tests for PromptService
  - All existing tests continue to pass
  - **Result: 104/104 tests passing** ✅
  - File: `apps/server/src/services/PromptService.test.ts`

**Usage:**
```bash
# System prompts are automatically loaded from config/prompts.json
# Each tenant can have a custom prompt, or use the default

# The prompts.json structure:
{
  "_default": "Default system prompt for all tenants",
  "tenant-id": "Custom prompt for specific tenant"
}

# Prompts are prepended to conversation history before sending to OpenAI
# They are NOT persisted in the database
```

**Example Prompts:**
- `_default`: Helpful, friendly AI assistant
- `demo-tenant`: Enthusiastic demo application assistant
- `support-tenant`: Patient technical support specialist
- `sales-tenant`: Professional sales consultant

**Effort:** Small (2-3 hours) - Completed!

---

### 2.3 Error Handling & Resilience (Production Critical)

**Why:** Handle API failures, rate limits, and network issues gracefully.

**Tasks:**
- [ ] Add retry logic for transient failures in OpenAIService
  - Implement exponential backoff
  - Add max retries configuration (default: 3)
  - Retry on network errors and 5xx responses
- [ ] Handle OpenAI rate limits (429 responses)
  - Parse retry-after header
  - Return user-friendly error messages
  - Log rate limit events
- [ ] Add request/response logging to OpenAIService
  - Log token usage per request (from response metadata)
  - Track response times
  - Log errors with full context
- [ ] Add health checks for OpenAI connectivity (optional)
- [ ] Create error recovery strategies
  - Graceful degradation for API failures
  - User-friendly error messages in responses

**Effort:** Medium (4-5 hours)

---

### 2.4 Context Management (Optimization)

**Why:** Handle long conversations efficiently within token limits.

**Tasks:**
- [ ] Implement conversation truncation strategy
  - Keep recent N messages (configurable, default: 20)
  - Always keep system prompt if present
  - Smart truncation: keep user-assistant pairs intact
- [ ] Add token counting utility (use tiktoken or estimate)
- [ ] Handle context window exceeded errors from OpenAI
  - Automatically truncate and retry
  - Log truncation events
- [ ] Add conversation pruning options to config
- [ ] Test with long conversations (50+ messages)

**Effort:** Medium (3-4 hours)

---

### 2.5 Advanced Features (Nice to Have)

**Optional enhancements for better UX - implement as needed:**

- [ ] **Function Calling Support**
  - Define available functions in config
  - Handle function call requests from OpenAI
  - Execute functions and return results
  - Effort: Medium (4-6 hours)

- [ ] **Streaming Improvements**
  - Add typing indicators in widget
  - Show partial responses as they arrive
  - Handle streaming errors gracefully
  - Effort: Small (2-3 hours)

- [ ] **Conversation Management**
  - List user's conversations (GET /api/sessions)
  - Delete conversations (DELETE /api/session/:id)
  - Export conversation history (GET /api/session/:id/export)
  - Effort: Medium (3-4 hours)

- [ ] **Multi-Model Support**
  - Allow model selection per tenant in config
  - Support A/B testing different models
  - Fallback to cheaper models on errors
  - Effort: Small (2-3 hours)

- [ ] **Rate Limiting**
  - Limit requests per user/tenant
  - Prevent abuse with token bucket algorithm
  - Fair usage policies
  - Effort: Small (2-3 hours)

---

## Monitoring & Observability

**Note:** Monitoring and observability will be handled using **LangSmith** (external service).

This includes:
- Token usage tracking and cost estimation
- Performance metrics (latency, throughput)
- Error tracking and alerting
- Request/response tracing
- Model performance analytics

No implementation needed in this phase - LangSmith integration can be added later.

---

## Phase 3: Widget Integration Testing

**After Phase 2 completion:**

- [ ] Test widget with real OpenAI responses
- [ ] Verify streaming behavior in browser
- [ ] Test error handling in widget
- [ ] Performance testing with concurrent users
- [ ] Load testing

**Effort:** Small (2-3 hours)

---

## Getting Started Right Now

### 1. Setup and Start Server ✅ DONE

The server is already configured and running with your OpenAI API key!

**Note:** Using `.env` file (both `.env` and `.env.local` work the same way - `.env.local` is typically used to keep secrets out of version control since `.env.local` is usually in `.gitignore`)

```bash
# Server is already running at:
# http://localhost:4000

# If you need to restart:
cd tiny-chatbot
pnpm --filter @tiny-chatbot/server dev
```

### 2. Test the Endpoints

**Non-streaming chat:**
```bash
# Create session
SESSION_ID=$(curl -X POST http://localhost:4000/api/session \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "test-tenant"}' | jq -r '.sessionId')

# Send message
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"message\": \"Hello!\"}"
```

**Streaming chat:**
```bash
curl -X POST http://localhost:4000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"message\": \"Tell me a story\"}"
```

---

## Technical Notes

### Current Architecture

```
User Request
    ↓
Route (chat.ts / streamChat.ts)
    ↓
ConversationService
    ↓
OpenAIService → OpenAI Responses API (gpt-5)
    ↓
SessionStore (InMemorySessionStore)
```

### Key Files

- `apps/server/src/services/OpenAIService.ts` - OpenAI integration
- `apps/server/src/services/ConversationService.ts` - Conversation management
- `apps/server/src/config.ts` - Configuration schema
- `apps/server/src/repositories/SessionStore.ts` - Storage interface
- `apps/server/src/routes/chat.ts` - Non-streaming endpoint
- `apps/server/src/routes/streamChat.ts` - Streaming endpoint

### API Documentation

OpenAI Responses API docs: `tiny-chatbot/knowledge-base/Responses-API-Documentation/create-a-model-response.md`

---

## Questions or Issues?

- Review test files for usage examples
- Check `knowledge-base/` for reference documentation
- All 70 tests passing - use as integration examples
- Server logs show detailed request/response info

---

**Last Updated:** 2025-09-30
**Status:** Phase 1 Complete ✅ | Phase 2.1 Complete ✅ | Phase 2.2 Complete ✅ | Phase 2.3+ Ready 🎯