# Goose Context Engineering Notes

These notes summarize how the Goose reference agent handles context management so we can reuse the concepts when implementing Phase 2.4 (Context Management) in `tiny-chatbot`.

## High-Level Flow
- The desktop client triggers `/context/manage` on the Goose server when it detects context pressure or when a user requests compaction.
- The server delegates to the active agent, which either truncates or summarizes the conversation and returns a curated message list plus per-message token counts.
- The client replaces its local history with the server-provided messages and, for auto-compaction, automatically submits the continuation prompt supplied by the backend.

## Estimating Safe Context Limits
- Goose does not trust the raw model context window. It multiplies the provider’s limit by 0.7 and subtracts fixed overhead for system prompts and tool definitions (`goose/crates/goose/src/context_mgmt/common.rs:11`).
- Token counting leans on asynchronous helpers to keep UI responsive, and only counts messages marked `agent_visible` so user-only markers do not inflate totals.

## Truncation Strategy
- `Agent::truncate_context` computes per-message token counts, then hands messages to `truncate_messages` with the `OldestFirstTruncation` strategy (`goose/crates/goose/src/agents/context.rs:15`).
- Oversized individual turns are trimmed in place (safe ellipsis) before wholesale removal; tool call/response pairs are dropped together, and conversations are coerced to start/end on plain user text to preserve coherent context (`goose/crates/goose/src/context_mgmt/truncate.rs:120`).
- After truncation it tries to add an assistant notice—“I truncated some of the oldest messages…”—only if the extra tokens still fit.

## Summarization Workflow
- `summarize_context` builds a one-shot prompt (`summarize_oneshot.md` template) and asks the provider for a summary, ensuring token accounting is recorded (`goose/crates/goose/src/context_mgmt/summarize.rs:17`).
- Returned messages are rewritten with nuanced visibility metadata:
  - Original turns stay user-visible but become agent-invisible.
  - A `summarizationRequested` marker (user-visible only) lets the UI show a compaction banner.
  - The summary and continuation instructions are agent-only so the model sees them but users don’t (`goose/crates/goose/src/agents/context.rs:84`).

## Auto-Compaction Decisioning
- `check_compaction_needed` compares current usage against a configurable threshold (default 80%) using real session token totals when available, otherwise estimations (`goose/crates/goose/src/context_mgmt/auto_compact.rs:54`).
- `check_and_compact_messages` preserves the most recent user turn, runs summarization, then reattaches that turn so the conversation can resume naturally.

## Client Responsibilities
- The React `ContextManagerProvider` wraps manual/automatic compaction, swaps in the backend’s curated history, and auto-sends the continuation prompt after an overflow (`goose/ui/desktop/src/components/context_management/ContextManager.tsx:31`).
- Token-usage alerts invite users to summarize proactively, and `ProgressiveMessageList` renders `summarizationRequested` markers to explain where compaction happened (`goose/ui/desktop/src/components/ChatInput.tsx:558`, `goose/ui/desktop/src/components/ProgressiveMessageList.tsx:188`).
- Message conversion keeps special content types like `contextLengthExceeded` so the UI can react appropriately (`goose/ui/desktop/src/components/context_management/index.ts:52`).

## Takeaways for `tiny-chatbot`
- Derive a conservative target window (model limit × factor – overhead) before trimming.
- Count tokens per turn and preserve user/assistant pairs—never split them mid-conversation.
- Offer both truncation and summarization paths; summarization should mark originals as user-only and inject hidden agent guidance.
- Surface compaction state in the UI via explicit markers and user-facing alerts.
- Keep the backend authoritative: let it return the new message list and token counts so clients only render what the agent expects.
