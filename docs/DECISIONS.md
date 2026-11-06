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
| 17 | 2026-11-06 | ~~Premium dark-first custom design~~ — superseded by #20 | — |
| 18 | 2026-11-06 | Admin panel manages provider API keys + model per agent; keys encrypted at rest (Fernet, `SECRETS_ENCRYPTION_KEY`), shown masked, env vars are fallback | Owner wants keys/models editable without redeploy |
| 19 | 2026-11-06 | Alembic owns app tables (psycopg 3, direct Neon URL for migrations, run as deploy step, Neon branch per PR); Better Auth and Mem0 tables excluded | Safe, reviewable migrations — see MIGRATIONS.md |
| 20 | 2026-11-06 | Default shadcn/ui look (radix-nova, neutral, blue primary, Geist), light default + dark toggle via next-themes; distinctiveness in product features and logo | Owner rejected the custom "drafting desk" style; reference app: timedesk |
| 21 | 2026-11-06 | Calendly inline embed (https://calendly.com/alihassan-plotap/free-call) with name/email/plan/date prefill; `calendly.event_scheduled` postMessage → confirmation; webhook in M6 | Owner's booking page; official embed URL, no extra dependency |
| 22 | 2026-11-06 | Short landing page: one 3-step glass diagram (Idea → AI → Plan) instead of long sections; macOS-style `.glass` utility for light + dark | Owner wanted simple, one-glance, not AI-template-looking, with glass effect |
| 23 | 2026-11-06 | Booking = instant popup (shadcn Calendar + times) that continues on Calendly with day + details prefilled; Calendly iframe only on /book. Sample times until Calendly API in M6 | Iframe was too slow on the owner's connection |
| 24 | 2026-11-06 | New logo: three dots converging into one (many agents → one plan); tactile gradient buttons (no shadows) as the global shadcn Button default/outline style | Owner request; brand ties to the product mechanism |
