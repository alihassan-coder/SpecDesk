# SpecDesk

AI app-planning tool for an agency: founder idea → AI interview rounds → full plan + files → book a call.

Read before working: [docs/PLAN.md](docs/PLAN.md) (scope & milestones), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
[docs/DECISIONS.md](docs/DECISIONS.md). Add a row to DECISIONS.md for any new product/tech decision.

## Layout
- `apps/web` — Next.js 16 (App Router, `src/`), Tailwind v4, shadcn/ui, AI Elements. Package manager: **pnpm**.
- `apps/api` — FastAPI (managed with **uv**). Not started until M2.
- `docs/` — all project docs live here. DB changes: follow [docs/MIGRATIONS.md](docs/MIGRATIONS.md) (Alembic only, never hand-edit tables).
- Env: `apps/api/.env` and `apps/web/.env.local` hold real secrets (gitignored). `.env.example` holds placeholders only — never real values.

## Commands
- `pnpm dev:web` — run frontend (from repo root)
- `pnpm lint:web` / `pnpm build:web`
- Add shadcn components: `cd apps/web && pnpm dlx shadcn@latest add <component>`

## Rules
- **Use built-in / official tooling first** (shadcn components, AI Elements, Better Auth plugins, LiteLLM, Mem0). Don't hand-roll what a library already does.
- Use **official CLI commands** to add/scaffold things (`pnpm dlx shadcn@latest add …`, `pnpm add …`). The owner's network is slow — install only what the current milestone needs.
- Current milestone is **M1: UI with mock data**. All data comes from `apps/web/src/mocks/`; no backend calls yet. Keep mock shapes close to the planned API (see SSE contract in ARCHITECTURE.md).
- Every user-facing error must be humanized: title, plain explanation, next action. Never show raw stack traces.
- Software-engineering ideas only.
- Security: every resource is owned by a user; never trust client-sent user ids. Admin comes from `ADMIN_EMAILS` env.
- Secrets only in env files; never commit `.env*` (except `.env.example`).
- Design: premium, dark-first, shadcn tokens (CSS variables) only — no hard-coded colors, so the settings theme customizer works. See [docs/UI.md](docs/UI.md).

## Engineering standards
- TypeScript strict; no `any`. Python fully typed (pyright/mypy), formatted with ruff.
- Server Components by default; add `"use client"` only where state/effects/events are needed.
- Small, focused components in `src/components/<area>/`; route files stay thin.
- Accessibility: keyboard reachable, visible focus, labels on inputs, `prefers-reduced-motion` respected.
- Responsive down to 360px wide.
- Conventional commits (`feat:`, `fix:`, `docs:` …); one milestone task per PR.
- Every milestone ends with a review gate (owner checks UI/flow) before the next starts.

## Skills to use
- Planning / new decisions → `grilling` (rounds of numbered questions with recommendations).
- UI work → `frontend-design`.
- Backend & logic (M2+) → `tdd` (red-green-refactor).
- Bugs → `diagnosing-bugs`. End of milestone → `code-review`, `simplify`, `security-review`.
- Domain terms → `domain-modeling` (GLOSSARY.md, ADRs in docs/).
