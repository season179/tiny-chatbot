# Tiny Chatbot Agentic Tooling Plan

Implementation plan for giving the tiny-chatbot backend limited agentic capabilities with shell-based file tools.

## 1. Foundations ✅
- **Shared types**: Extend `ChatMessage` schema to support tool role and structured payloads (tool name, arguments, result metadata). _Done — implemented discriminated union in shared package and propagated new types._
- **Session store**: Update `SqliteSessionStore` and in-memory store to persist new message shape; add migrations/tests. _Done — schema columns added, migration created, persistence tests cover tool messages._
- **Config**: Add sandbox settings (allowed commands, working dir root, max output size, timeout) to `config.ts`, `.env`, `.env.example`. _Done — config schema updated with defaults and `.env` docs refreshed._

## 2. Shell Tool Service ✅
- Create `ShellToolService` that wraps execution of the approved command set (`cat`, `ls`, `rg`, etc.).
- Responsibilities: normalize paths, prevent directory escape, limit output bytes, redact secrets, capture stdout/stderr, return structured result.
- Add command-specific helpers (e.g., limit `rg` results, default paging for `head`/`tail`).
- Instrument logging for audit trails.
- _Done — implemented in `ShellToolService.ts` with comprehensive test coverage (62 tests), path security, output limits, and secret redaction._

## 3. OpenAI Service Enhancements ✅
- Update request construction to supply tool definitions to the Responses API (JSON schema for each command).
- Extend response parsing to detect tool calls (`tool_call`, arguments) and emit structured events.
- Surface token usage per turn for telemetry.
- Add unit tests covering tool-call parsing edge cases (missing args, unexpected types).
- _Done — tool definitions wired in `generateResponse`, tool-call parsing implemented in `extractResponseResult`, `function_call`/`function_call_output` format conversion complete._

## 4. Conversation Loop ✅
- Refactor `ConversationService` to run a turn-based loop:
  1. Send conversation+system prompt to OpenAI.
  2. If assistant returns tool calls, invoke `ShellToolService`, append `tool` messages, and continue.
  3. Stop when assistant returns a normal reply or max tool turns reached.
- Mirror the logic for streaming: buffer tool work, then stream final assistant text; emit structured SSE events for tool activity (optional minimal format).
- Handle errors (command failure, timeout) gracefully—return assistant-visible explanation plus log details.
- _Done — both `handleUserMessage` and `handleUserMessageStreaming` implement the agentic loop with max 10 tool rounds, tool execution via `ShellToolService`, and graceful error handling._

## 5. API & Widget Updates ✅
- Ensure `/api/chat` and `/api/chat/stream` propagate new message roles and optional tool telemetry.
- Update widget rendering (if enabled) to ignore or display tool messages appropriately; preserve backwards compatibility when tool role absent.
- _Done — Widget now uses streaming API (`useChat.ts` updated to use `client.streamMessage()`), MessageList filters out tool messages and `__FUNCTION_CALLS__` markers, all 141 server tests passing._

## 6. Security & Compliance ⚠️
- ✅ Sandbox enforced via config (path allowlist, output caps, timeouts in `toolsConfig.ts`)
- ✅ Operational documentation created (`ENV_CONFIGURATION.md`)
- ❌ Rate limiting not implemented (future enhancement)
- ❌ Command spam prevention not implemented (future enhancement)

## 7. Testing & QA ✅
- ✅ Unit tests: ShellToolService (62 tests), OpenAI tool parsing, Conversation loop, config validation
- ✅ Integration tests: End-to-end agentic loop with real tool execution (`ConversationService.integration.test.ts` - 7 tests)
  - Single tool calls (cat, ls, grep)
  - Multiple sequential tool rounds
  - Multiple parallel tool calls
  - Error handling (non-existent files)
  - Max rounds exceeded protection
- ✅ Performance tests: Load/latency benchmarks (`ShellToolService.perf.test.ts` - 12 tests)
  - Command latency measurements (ls, cat, grep, rg, head, tail)
  - Large output handling
  - Concurrent execution benchmarks
  - Ripgrep performance validation
- ✅ All 15 test files passing (153 total tests)

## 8. Rollout Checklist ✅
- ✅ Environment configuration documented (`.env.example`)
- ✅ Security best practices documented
- ✅ Main README updated with comprehensive agentic capabilities section
- ✅ Migration guidance not needed (schema is backwards compatible)
- ⚠️ Feature flag not implemented (agentic behavior controlled via `SHELL_SANDBOX_ENABLED` - sufficient for MVP)
