# SpecDesk — Architecture

## Overview

```
                ┌──────────────────────── Vercel ────────────────────────┐
 Browser ──────▶│ apps/web  (Next.js 16, App Router, shadcn/ui, AI SDK)  │
   ▲  SSE       │   • Better Auth (Email OTP + JWT)  → Neon (auth tables)│
   │            │   • UI, artifact panel, Calendly embed                 │
   │            └───────────────┬────────────────────────────────────────┘
   │                 JWT bearer │ REST + SSE
   │            ┌───────────────▼────────────────────────────────────────┐
   └────────────│ apps/api  (FastAPI, Python functions on Vercel)        │
                │   • Agent pipeline (LiteLLM → Anthropic/OpenAI/Gemini…)│
                │   • Mem0 memory (pgvector on Neon)                     │
                │   • Pricing engine (pricing.yaml)                      │
                │   • Files: WeasyPrint PDF, MD, CSV, ZIP                │
                │   • Webhooks: Calendly · Email: Resend · Search: Tavily│
                └───────────────┬────────────────────────────────────────┘
                                ▼
                         Neon Postgres (+ pgvector)
```

## Repo layout

```
SpecDesk/
├─ apps/
│  ├─ web/            Next.js frontend (pnpm)
│  └─ api/            FastAPI backend (uv)         — M2
├─ docs/              Plan, architecture, decisions, UI spec
├─ CLAUDE.md          Guidance for AI coding agents
├─ package.json       Root scripts
└─ pnpm-workspace.yaml
```

## Key choices (use built-in / off-the-shelf first)

| Concern | Choice |
|---|---|
| UI kit | shadcn/ui + **AI Elements** (chat, reasoning, tool/task steps, artifact) |
| Streaming | SSE from FastAPI, consumed with Vercel AI SDK (`useChat`) / EventSource |
| Auth | **Better Auth** — Email OTP plugin (Resend) + JWT plugin; FastAPI verifies via JWKS |
| LLMs | **LiteLLM** — provider keys from env, model per agent, fallbacks |
| Memory | **Mem0** OSS Python SDK; short-term = recent messages + summary; long-term = Mem0 facts |
| DB | Neon Postgres; Better Auth owns auth tables; SQLAlchemy 2 + Alembic own app tables |
| PDF | WeasyPrint (HTML template) — fallback `@react-pdf/renderer` |
| Search | Tavily |
| Booking | Calendly embed + webhook |
| Tests | pytest, Vitest, Playwright; GitHub Actions |

## SSE event contract (draft)

| Event | Payload |
|---|---|
| `question.round` | `{ round, questions: [{ id, title, body, options[], recommended }] }` |
| `agent.status` | `{ agent, status: "queued"\|"working"\|"done"\|"error" }` |
| `agent.note` | `{ agent, text }` — short human-readable progress note |
| `agent.reasoning` | `{ agent, text }` — reasoning summary (when provider supports it) |
| `token` | `{ section, text }` — streamed plan text |
| `file.ready` | `{ fileId, name, kind, size }` |
| `booking.suggest` | `{ reason }` |
| `error` | `{ code, title, message, action }` — already humanized |
| `done` | `{ planId, versionId }` |

## Security rules
- Every chat, plan, file, booking row has `owner_id`; API filters by the JWT `sub` on every query.
- Share links use an unguessable token and are read-only.
- Admin = verified email in `ADMIN_EMAILS` env (never hard-coded).
- Secrets only in env (`.env.local` / Vercel env), never committed.
