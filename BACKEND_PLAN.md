# Backend Build Plan

## Context
- Retire the unused Next.js dashboard so the monorepo only hosts the widget and new API server.
- Introduce a lightweight Fastify backend that currently returns hardcoded chatbot responses but can evolve into a full conversation pipeline later.

## Milestones

- [x] Remove `apps/dashboard` and clean up Turbo/pnpm scripts so only the widget and backend run.
- [x] Scaffold `apps/server` with Fastify, TS config, and development/build scripts.
- [x] Implement core routes: `GET /healthz`, `POST /api/session`, `POST /api/chat`, `POST /api/chat/stream`, `POST /api/feedback`.
- [x] Provide an in-memory session store and a conversation service that returns deterministic canned replies.
- [x] Wire up configuration handling with `dotenv` and validation for runtime settings.
- [x] Add Vitest coverage for route validation and the canned-response flow.
- [ ] (Optional) Update the widget to call the new API endpoints once the backend is ready.

## Notes
- ✅ `packages/shared` now exposes all request/response contracts with Zod schemas and a ready-to-use API client.
- ✅ Server routes use shared types for validation, ensuring type safety between frontend and backend.
- Keep the code structured so swapping the canned responses for a real LLM call only requires touching the conversation service layer.
