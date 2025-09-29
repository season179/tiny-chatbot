# Tiny Chatbot Embed Vision

This repository hosts the groundwork for a standalone chatbot that can be embedded as a floating chat bubble inside any host web application while keeping the conversational backend isolated and secure.

## Product Goal
- Deliver a reusable chat widget that appears as a small bubble anchored to the bottom-right of a host app and expands into a messenger-style panel when clicked.
- Allow the widget to connect to a proprietary knowledge base and conversational backend that lives entirely within our infrastructure.
- Let partner applications "park" the chat experience inside their UI without gaining direct access to proprietary data or code.

## Repository Layout
- `apps/dashboard` – Next.js App Router dashboard for tenant onboarding, knowledge-base management, analytics, and internal APIs.
- `packages/widget` – Preact-based embed built with Vite that renders the floating bubble and exposes `window.TinyChatbotSDK`.
- `packages/shared` – Shared TypeScript contracts (tenant metadata, widget events, context payloads) consumed by both surfaces.
- Root configuration – Turborepo + pnpm workspace, Biome 2.x for lint/format, shared `tsconfig.base.json` for strict TypeScript settings.

## Getting Started
- **Prerequisites**: Node.js 20+ (recommended 22.x), pnpm 8 (`corepack enable pnpm`), optional: Turborepo remote cache if your CI supports it.
- **Install dependencies**:
  - `pnpm install`
- **Run everything in dev** (parallel tasks via Turborepo):
  - `pnpm dev`
- **Dev dashboard only**:
  - `pnpm --filter dashboard dev`
- **Dev widget playground** (opens Vite dev server):
  - `pnpm --filter @tiny-chatbot/widget dev`
- **Lint / format check** (Biome across workspace):
  - `pnpm lint`
- **Build artifacts** (Next.js production build + widget bundles):
  - `pnpm build`

## Integration Concept
1. **Embed Script**: Provide each host with a single `<script>` tag. The script injects the floating button, chat window, and styling, versioned and served from our CDN.
2. **UI Container**: Render the chat experience inside an iframe or shadow DOM to avoid CSS/JS collisions and keep widget updates centralized.
3. **Host Hooks**: Offer a lightweight SDK (`window.ChatBotSDK`) so hosts can configure theme, position, default open state, and set user/page context.
4. **Messaging Transport**: The widget communicates with our servers over HTTPS (REST or WebSocket). No conversation logic runs in the host environment.

## Data & Security Model
- Proprietary knowledge base, retrieval logic, and LLM orchestration are hosted on our backend. Hosts see only formatted chat responses.
- Require signed tokens (API key or JWT) when loading the script and sending messages. Rotate credentials per tenant and audit usage.
- Validate and whitelist context fields from hosts to prevent prompt injection or unauthorized data leakage.
- Provide rate limiting, request logging, and optional watermarking or hashed transcripts for tamper detection.

## Conversation Lifecycle
- Persist conversations server-side keyed by tenant and external user identifier. Allow hosts to fetch history via API if they need to surface it elsewhere.
- Support lifecycle events (open, close, message sent, escalation) via callbacks or webhooks so hosts can integrate with analytics or ticketing systems.
- Display graceful fallbacks inside the widget when the chatbot service is unavailable or blocked by CSP.

## Operational Notes
- Document required CSP rules (`script-src`, `frame-src`) so hosts can embed the widget without trial-and-error.
- Deliver analytics and configuration management through our own dashboard, keeping host integration minimal.
- Version the embed script and provide sandbox/staging environments for testing before production rollout.

## Implementation Plan

### 1. Architecture & Project Layout
- **Repos/Workspace**: Use a monorepo (Turborepo + pnpm workspaces) with shared TypeScript configs and linting. Top-level `apps/` and `packages/` directories.
- **apps/dashboard**: Next.js (App Router) app for tenant dashboard, admin tools, API routes (REST/WebSocket) and auth flows.
- **packages/widget**: Preact-based embeddable chat widget built as a standalone library with Vite + Rollup, exporting UMD and ESM bundles plus a lightweight SDK wrapper.
- **packages/shared**: Type definitions, constants, telemetry helpers consumed by both the dashboard and widget to keep contracts in sync.

### 2. Build, Deployment & Integration Workflow
- **Widget Pipeline**:
  - Use Vite for dev server and component testing (Storybook or Ladle optional).
  - Production build emits versioned bundles to `dist/` with an asset manifest; publish to CDN (e.g., CloudFront) via CI.
  - Provide npm package for partners that prefer self-hosting the script.
- **Dashboard/API Pipeline**:
  - Next.js deployed to managed hosting (Vercel, AWS, etc.) with environment-specific configs.
  - Expose internal API routes for messaging ingress, conversation history, webhook registration, and tenant admin actions.
  - Integrate background workers (Queues + serverless functions or dedicated service) for retrieval indexing and analytics aggregation.
- **Shared Tooling**:
  - Enforce TypeScript project references, Biome lint/format, and commit hooks via lint-staged (future addition).
  - Centralized `.env` handling with schema validation (zod-based) to keep secrets organized across apps.
- **Integration Contracts**:
  - Document the embed API (`window.ChatBotSDK`) within the dashboard, auto-generated from shared types.
  - Provide sample integration snippets and CSP guidance as part of onboarding materials inside the dashboard.

## Next Steps
1. Finalize the bootstrap script API surface and default UI behavior.
2. Outline backend components (ingress API, context enrichment, retrieval-augmented generation, safety filters).
3. Define tenant onboarding flow (dashboard, key management, documentation, sample code snippets).
