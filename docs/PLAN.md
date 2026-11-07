# SpecDesk — Product & Delivery Plan

> A founder types an app idea → SpecDesk's AI agents interview them with sharp, software-focused
> questions → in ~2 minutes they get a complete plan (features, screens, stack, timeline, price
> range) plus downloadable files (PDF, Markdown, ZIP, backlog CSV, build prompt) — and a one-click
> way to book a call with the agency to build it.

SpecDesk is the **agency's lead-generation tool**. There are no paid SaaS plans.

---

## 1. Goals

| Goal | Measure |
|---|---|
| Founders get a real, defensible plan quickly | Idea → full plan in ≤ 2–3 min |
| Feel premium and different from ChatGPT/Claude | Plan-specific UI (sliders, wireframes, diff, score), not just chat text |
| Turn founders into agency clients | Calendly booking from chat/sidebar; lead emails + admin leads view |
| Secure by default | Email OTP login; every chat/plan scoped to its owner |

## 2. Users & roles

| Role | How | Can do |
|---|---|---|
| **Guest** | "Try demo" — no login | Explore the full UI with dummy data (read-only demo chat & plan) |
| **Founder** | Email + 6-digit OTP | Create chats/plans, download files, share read-only links, book meetings, settings, memories |
| **Admin** | Verified email in `ADMIN_EMAILS` (`alihassan.coder@gmail.com`) | Everything + `/admin`: leads, all plans, bookings, **provider API keys**, model per agent, pricing config, usage/cost |
| **Viewer** | Anyone with a share link | Read-only plan view |

## 3. Core flow

1. Founder writes an idea (landing or new chat).
2. **Scope guard** — non-software ideas get a friendly redirect toward the software angle.
3. **Interviewer agent** asks questions in **rounds** (design-tree "grilling" style): numbered
   questions, each with a recommended answer and clickable option chips + free text + skip.
4. When the frontier is empty (or the founder clicks "Generate now"), the **pipeline** runs:
   Analyst → Product → UX → Architect → Estimator → Critic (risks/readiness) → Researcher (competitors).
5. Each agent's status, live notes and reasoning summary stream to the UI over **SSE**.
6. Plan renders as sections + **file cards**; clicking a file opens the **artifact side panel**
   (preview + download), ChatGPT/Claude-style.
7. Founder tweaks scope with **sliders/toggles** → price & timeline recompute instantly.
8. **Booking card** offered (on request, after plan, or high budget) → Calendly → lead emailed.

## 4. Plan contents (the deliverable)

- Summary, target users, problem, value proposition
- Features grouped **MoSCoW** (MVP vs v2), each with complexity S/M/L/XL
- Screens list + **low-fi wireframes** + user flow (Mermaid)
- Tech stack with **plain-English rationale + alternative considered**
- Timeline (phases / weeks), team composition
- **Price range** (rule-based: complexity → hours × rate × buffer, from `pricing.yaml`)
- Risks & assumptions + **Idea readiness score /100**
- Competitor scan (Tavily)
- Plan **versions with diff** ("v2 removed chat, −$3k")
- "Talk to the architect" follow-up chat that edits single sections

## 5. Exported files

| File | Format |
|---|---|
| Plan document | PDF (branded, WeasyPrint) |
| Spec / PRD | `spec.md` |
| Backlog | `backlog.csv` + `backlog.json` (Jira/Linear/Trello import) |
| Build prompt | `build-prompt.md` (for Cursor / Claude Code) |
| User flow | `flow.mmd` (Mermaid) |
| Everything | `specdesk-<slug>.zip` |

## 6. Differentiators vs general chatbots

Live scope sliders · wireframes per screen · readiness score · risk register · plan versions & diff ·
stack rationale · competitor scan · architect chat · artifact panel · agency booking built in ·
software-only expertise.

## 7. Milestones (SDLC)

Every milestone ends with a **review gate**: the user checks it, then we move on.

### M0 — Foundation ✅ in progress
- Monorepo (`apps/web`, `apps/api`), pnpm workspace, Next.js 16 + Tailwind v4 + shadcn/ui
- `docs/`, `CLAUDE.md`, decision log
- **Done when:** `pnpm dev:web` runs, shadcn initialised.

### M1 — UI with mock data + Guest mode  ← current
- Every screen built with **mock data** (`apps/web/src/mocks/`), no backend.
- Landing, login (OTP UI), chat (ChatGPT-like + sidebar + calendar), question rounds w/ chips,
  agent timeline + reasoning, streaming simulation, file cards + artifact panel, plan view
  (sliders, wireframes, score, diff), share view, settings (full customization + memories), admin,
  humanized error states, 404.
- **Guest mode**: "Try demo" opens a fully clickable demo project.
- **Done when:** user walks through every screen and approves the look & flow.

### M2 — Backend foundation
- FastAPI (`uv`), SQLAlchemy 2 + Alembic on Neon, health checks, settings via env.
- Domain schema: users(ref), chats, messages, plans, plan_versions, files, bookings, leads, memories(ref).
- Typed client generated from OpenAPI into `apps/web`.
- **Done when:** API deployed to Vercel preview, migrations run on Neon branch.
- **Status (2026-11-07):** done — FastAPI app (config, humanized errors, health + DB health, pricing engine + `POST /pricing/estimate`), SQLAlchemy models for all app tables, first Alembic migration applied to Neon main with `alembic check` clean. Open — typed OpenAPI client in `apps/web`, Vercel preview deploy, Neon branch per PR in CI.

### M3 — Auth & security
- Better Auth (Email OTP via Brevo + JWT plugin), sessions in Neon.
- FastAPI verifies JWT via JWKS; ownership checks on every resource; admin role from `ADMIN_EMAILS`.
- Rate limiting on OTP + generation.
- **Done when:** user A cannot read user B's chat (tested).
- **Status (2026-11-07):** done except rate limiting — Better Auth email OTP (Brevo, or code in the terminal in dev), JWT + JWKS in FastAPI, proxy, route protection, admin from `ADMIN_EMAILS`; cross-user test passes.

### M4 — AI pipeline
- LiteLLM multi-provider (keys from env, model per agent, fallback).
- Interviewer rounds, scope guard, agent pipeline with structured JSON outputs.
- SSE events: `agent.status`, `agent.note`, `agent.reasoning`, `token`, `question.round`, `file.ready`, `error`.
- Mem0 (OSS) short + long-term memory, pgvector on Neon.
- **Done when:** real idea → real plan end-to-end in < 3 min.
- **Status (2026-11-07):** interviewer + 7 planning agents live on Groq via LangChain/LangGraph (not LiteLLM — decisions 36-41); ≈ 2 min end to end. Open: scope guard, `agent.reasoning`, Mem0.

### M5 — Files, plan tools & sharing
- PDF/MD/CSV/JSON/Mermaid/ZIP generation, artifact panel wired to real files.
- Pricing engine (`pricing.yaml`), live sliders, versions & diff, share links, competitor scan, architect chat.
- **Done when:** all downloads open correctly; slider changes persist as a new version.
- **Status (2026-11-07):** MD/CSV/JSON/Mermaid/ZIP downloads and saved versions work. Open: PDF, share links, version diff view, competitor web scan, architect chat.

### M6 — Booking, leads & admin
- Calendly embed (chat card + sidebar), webhook → bookings + leads, Brevo email to agency.
- Admin: leads, plans, bookings, **API keys (encrypted, masked, test button)**, model selection per agent, pricing, usage/cost.
- **Done when:** a test booking appears in admin and arrives by email.

### M7 — Hardening & launch
- Humanized errors everywhere, empty/loading states, accessibility pass, SEO.
- Tests: pytest, Vitest, Playwright E2E (idea → questions → plan → PDF). GitHub Actions CI.
- Production deploy on Vercel, Neon prod branch, monitoring.
- **Done when:** CI green, E2E passes on production URL.

## 8. Later (not now)
Multi-language · Slack/Discord notifications · team workspaces · payments.
