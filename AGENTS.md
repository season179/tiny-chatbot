# Repository Guidelines

## Project Structure & Module Organization
Turborepo + pnpm manage the monorepo. The dashboard lives in `apps/dashboard` (Next.js App Router) with routes under `app/` and shared UI styles in `app/globals.css`; static assets belong in `public/`. Embeddable widget work stays in `packages/widget` (Vite + Preact) with entry points `src/index.tsx` and `WidgetRoot.tsx`, emitting bundles to `dist/`. Type-only contracts that both surfaces consume are defined in `packages/shared`. Review materials in `knowledge-base/` before modifying conversational flows or APIs.

## Build, Test & Development Commands
Install dependencies once via `pnpm install`. Use `pnpm dev` for the default parallel dev loop. Filter when needed: `pnpm --filter dashboard dev` for the Next.js app, `pnpm --filter @tiny-chatbot/widget dev` for the Vite preview. Build all deployable artifacts with `pnpm build`. Run linting and formatting with `pnpm lint`. `pnpm test` triggers package-level `test` scripts—keep them updated as suites mature.

## Coding Style & Naming Conventions
Biome enforces 2-space indentation, 100-character lines, and import organization; wire it into your editor or run it before a push. Write TypeScript (`.ts`/`.tsx`) by default. Follow PascalCase for components, camelCase for utilities, and SCREAMING_SNAKE_CASE only for exported constants in `packages/shared`. Keep widget styles alongside components; prefer module CSS in the dashboard `app/` tree.

## Testing Guidelines
Widget code should use Vitest with Testing Library; the dashboard can layer Playwright or Next.js testing tools. Name specs `*.test.ts` or `*.test.tsx` near the code they verify. Ensure coverage exists for new behavior before updating bundles, and keep `pnpm test` exercising your additions. Call out unavoidable coverage gaps in the PR description.

## Commit & Pull Request Guidelines
Write commits in imperative mood with narrow scopes (e.g., `Add widget theme toggle`). Rebase or squash fixup noise prior to review. PRs should summarize user-facing impact, note schema or config changes, and include screenshots or short clips for UI work. Mention new environment variables and link related tracking tickets to preserve traceability.

## Security & Configuration Tips
Keep secrets in `.env.local` and never commit transcripts or tenant data. When adjusting embed behavior, confirm README CSP instructions still apply and document required host changes in the PR. Validate shared contracts for backward compatibility before publishing widget artifacts.
