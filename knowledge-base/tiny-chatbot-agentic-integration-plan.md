# Tiny Chatbot Agentic Tooling Plan

Implementation plan for giving the tiny-chatbot backend limited agentic capabilities with shell-based file tools.

## 1. Foundations ✅
- **Shared types**: Extend `ChatMessage` schema to support tool role and structured payloads (tool name, arguments, result metadata). _Done — implemented discriminated union in shared package and propagated new types._
- **Session store**: Update `SqliteSessionStore` and in-memory store to persist new message shape; add migrations/tests. _Done — schema columns added, migration created, persistence tests cover tool messages._
- **Config**: Add sandbox settings (allowed commands, working dir root, max output size, timeout) to `config.ts`, `.env`, `.env.example`. _Done — config schema updated with defaults and `.env` docs refreshed._

## 2. Shell Tool Service
- Create `ShellToolService` that wraps execution of the approved command set (`cat`, `ls`, `rg`, etc.).
- Responsibilities: normalize paths, prevent directory escape, limit output bytes, redact secrets, capture stdout/stderr, return structured result.
- Add command-specific helpers (e.g., limit `rg` results, default paging for `head`/`tail`).
- Instrument logging for audit trails.

## 3. OpenAI Service Enhancements 🚧
- Update request construction to supply tool definitions to the Responses API (JSON schema for each command).
- Extend response parsing to detect tool calls (`tool_call`, arguments) and emit structured events.
- Surface token usage per turn for telemetry.
- Add unit tests covering tool-call parsing edge cases (missing args, unexpected types).
- _Progress_: Responses input now handles tool-role messages (renders tool outputs for the model) and existing tests cover the new payload format. Tool-call parsing and definition wiring still pending.

## 4. Conversation Loop
- Refactor `ConversationService` to run a turn-based loop:
  1. Send conversation+system prompt to OpenAI.
  2. If assistant returns tool calls, invoke `ShellToolService`, append `tool` messages, and continue.
  3. Stop when assistant returns a normal reply or max tool turns reached.
- Mirror the logic for streaming: buffer tool work, then stream final assistant text; emit structured SSE events for tool activity (optional minimal format).
- Handle errors (command failure, timeout) gracefully—return assistant-visible explanation plus log details.

## 5. API & Widget Updates
- Ensure `/api/chat` and `/api/chat/stream` propagate new message roles and optional tool telemetry.
- Update widget rendering (if enabled) to ignore or display tool messages appropriately; preserve backwards compatibility when tool role absent.

## 6. Security & Compliance
- Enforce sandbox via config (no arbitrary command chaining, capped runtime/output size, path allowlist).
- Add rate limiting or cooldown if needed to prevent command spam.
- Document operational playbook for extending the tool list safely.

## 7. Testing & QA
- Unit tests: ShellToolService, OpenAI tool parsing, Conversation loop logic, config validation.
- Integration tests: end-to-end flow with fake tool responses, ensure final assistant answer includes tool-derived context.
- Load/latency check for repeated search commands on medium corpora.

## 8. Rollout Checklist
- Update docs (`knowledge-base/`, READMEs) with new capabilities and safety notes.
- Provide migration guidance for existing sessions (if schema changes require it).
- Enable feature flag / gradual rollout if desired.
