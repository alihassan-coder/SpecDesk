# Decision Log

Short records of product/tech decisions. Newest last.

| # | Date | Decision | Why |
|---|---|---|---|
| 1 | 2026-11-06 | Monorepo: Next.js (`apps/web`) + FastAPI (`apps/api`) + Neon | One repo, one deploy target |
| 2 | 2026-11-06 | Agency lead-gen tool, **no SaaS plans / payments** | Owner decision |
| 3 | 2026-11-06 | Email OTP login (Better Auth) + ownership checks | Email-only login must not expose other users' chats |
| 4 | 2026-11-06 | Interviewer asks in "grilling" rounds (numbered Qs + recommended answer + chips) | Proven questioning style |
| 5 | 2026-11-06 | Software-engineering ideas only, friendly redirect otherwise | Focus & quality |
| 6 | 2026-11-06 | Agent pipeline (not an autonomous agent framework), SSE streaming with detailed status/reasoning | Predictable, debuggable, feels agentic |
| 7 | 2026-11-06 | Price = rule-based engine from AI complexity scores + `pricing.yaml` | Consistent, defensible numbers |
| 8 | 2026-11-06 | LiteLLM multi-provider, keys from env, model per agent set by admin | Flexibility, fallback |
| 9 | 2026-11-06 | Mem0 OSS for memory, pgvector on Neon; user can view/delete memories | No extra DB; trust |
| 10 | 2026-11-06 | All differentiators in v1 (sliders, wireframes, score, diff, competitors, architect chat) | Stand out from ChatGPT/Claude |
| 11 | 2026-11-06 | Exports: PDF, MD, CSV/JSON, build prompt, Mermaid, ZIP; ChatGPT/Claude-style artifact panel | Owner wants rich files |
| 12 | 2026-11-06 | Calendly for meetings (chat card + sidebar) | Owner uses Calendly |
| 13 | 2026-11-06 | Admin = `alihassan.coder@gmail.com` via `ADMIN_EMAILS` env | Leads + model selection |
| 14 | 2026-11-06 | Deploy everything on Vercel | Simplicity |
| 15 | 2026-11-06 | Build UI first with mock data + guest demo mode, review before backend | See it before building it |
| 16 | 2026-11-06 | Prefer built-in libraries (shadcn, AI Elements, Better Auth, LiteLLM, Mem0) over custom code | Speed, quality |
| 17 | 2026-11-06 | Premium dark-first design on shadcn | Signals a serious engineering agency |
| 18 | 2026-11-06 | Admin panel manages provider API keys + model per agent; keys encrypted at rest (Fernet, `SECRETS_ENCRYPTION_KEY`), shown masked, env vars are fallback | Owner wants keys/models editable without redeploy |
| 19 | 2026-11-06 | Alembic owns app tables (psycopg 3, direct Neon URL for migrations, run as deploy step, Neon branch per PR); Better Auth and Mem0 tables excluded | Safe, reviewable migrations — see MIGRATIONS.md |
