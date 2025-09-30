# OpenAI Responses API Integration Plan

## Status: ✅ Phase 1 Complete - Phase 2 Ready

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

### 2.1 Session Persistence (High Priority)

**Why:** Currently using `InMemorySessionStore` - all conversation history is lost on server restart.

**Tasks:**
- [ ] Choose persistence layer (Redis, PostgreSQL, MongoDB)
- [ ] Implement persistent `SessionStore` interface
  - Reference: `apps/server/src/repositories/SessionStore.ts`
  - Methods: `createSession()`, `getSession()`, `appendMessage()`
- [ ] Add connection configuration to config
- [ ] Update server to use persistent store
- [ ] Add migration/initialization scripts
- [ ] Test with real persistence layer

**Effort:** Medium (4-6 hours)

---

### 2.2 System Instructions & Prompts (Recommended)

**Why:** Enable tenant-specific personalities and conversation context.

**Tasks:**
- [ ] Design system prompt configuration
  - Option A: Store in config file per tenant
  - Option B: Store in database with tenant metadata
  - Option C: Pass as part of session creation
- [ ] Update ConversationService to prepend system messages
- [ ] Add system role support to OpenAIService
- [ ] Create example prompts in `knowledge-base/`
- [ ] Test different prompt configurations

**Effort:** Small (2-3 hours)

---

### 2.3 Error Handling & Resilience (Production Critical)

**Why:** Handle API failures, rate limits, and network issues gracefully.

**Tasks:**
- [ ] Add retry logic for transient failures
  - Implement exponential backoff
  - Max retries configuration
- [ ] Handle OpenAI rate limits (429 responses)
  - Queue requests if needed
  - Return user-friendly error messages
- [ ] Add request/response logging
  - Log token usage per request
  - Track response times
  - Log errors with context
- [ ] Implement circuit breaker pattern (optional)
- [ ] Add health checks for OpenAI connectivity
- [ ] Create error recovery strategies

**Effort:** Medium (4-5 hours)

---

### 2.4 Monitoring & Observability (Production Critical)

**Why:** Track usage, costs, performance, and issues in production.

**Tasks:**
- [ ] Token usage tracking
  - Log tokens per request
  - Daily/monthly aggregations
  - Cost estimation
- [ ] Performance metrics
  - Response time percentiles (p50, p95, p99)
  - Streaming chunk latency
  - Request throughput
- [ ] Error tracking
  - Error rates by type
  - Failed request logging
  - Alert thresholds
- [ ] Add structured logging
- [ ] Integrate with monitoring service (optional: Datadog, New Relic, etc.)

**Effort:** Medium (3-4 hours)

---

### 2.5 Context Management (Optimization)

**Why:** Handle long conversations efficiently within token limits.

**Tasks:**
- [ ] Implement conversation truncation strategy
  - Keep recent N messages
  - Smart truncation (keep system + recent)
  - Summarization for old context (advanced)
- [ ] Add token counting before API calls
- [ ] Handle context window exceeded errors
- [ ] Add conversation pruning options
- [ ] Test with long conversations

**Effort:** Medium (3-4 hours)

---

### 2.6 Advanced Features (Nice to Have)

**Optional enhancements for better UX:**

- [ ] **Function Calling Support**
  - Define available functions
  - Handle function call requests
  - Execute functions and return results
  - Effort: Medium (4-6 hours)

- [ ] **Streaming Improvements**
  - Add typing indicators
  - Show partial responses as they arrive
  - Handle streaming errors gracefully
  - Effort: Small (2-3 hours)

- [ ] **Conversation Management**
  - List user's conversations
  - Delete conversations
  - Export conversation history
  - Effort: Medium (3-4 hours)

- [ ] **Multi-Model Support**
  - Allow model selection per tenant
  - A/B testing different models
  - Fallback to cheaper models
  - Effort: Small (2-3 hours)

- [ ] **Rate Limiting**
  - Limit requests per user/tenant
  - Prevent abuse
  - Fair usage policies
  - Effort: Small (2-3 hours)

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

### 1. Test with Real OpenAI API

```bash
# Create .env.local in apps/server/
cd tiny-chatbot/apps/server
cp .env.example .env.local

# Edit .env.local and add your API key:
OPENAI_API_KEY=sk-your-actual-openai-key

# Start the server
cd ../..
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
**Status:** Phase 1 Complete ✅ | Phase 2 Ready 🎯