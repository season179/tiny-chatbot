# Tiny Chatbot Embed Vision

This document captures the concept for a standalone chatbot that can be embedded as a floating chat bubble inside any host web application while keeping the chatbot backend isolated.

## Product Goal
- Deliver a reusable chat widget that appears as a small bubble anchored to the bottom-right of a host app and expands into a messenger-style panel when clicked.
- Allow the widget to connect to a proprietary knowledge base and conversational backend that lives entirely within our infrastructure.
- Let partner applications "park" the chat experience inside their UI without gaining direct access to proprietary data or code.

## Integration Overview
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

## Next Steps
1. Finalize the bootstrap script API surface and default UI behavior.
2. Outline backend components (ingress API, context enrichment, retrieval-augmented generation, safety filters).
3. Define tenant onboarding flow (dashboard, key management, documentation, sample code snippets).
