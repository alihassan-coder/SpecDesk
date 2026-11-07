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
| 25 | 2026-11-07 | Prompt "beam" effect ported from the reference (two stacked beams, CSS @property + masks, no JS), only on the first prompt (landing, New plan); light theme uses an off-white page with white cards and stronger beam saturation | Owner wanted the exact reference animation and light mode as good as dark |
| 26 | 2026-11-07 | API: Python 3.12 (Vercel-supported), **sync** SQLAlchemy 2 + psycopg 3, FastAPI `Depends` for engine/session/pricing; pyright strict as type checker | No async gain yet for CRUD; one consistent style; easy to test via dependency overrides |
| 27 | 2026-11-07 | App tables use DB-generated UUID PKs (`gen_random_uuid()`), `owner_id varchar(255)` indexed with **no FK** to Better Auth `user`; `plan.current_version_id` has no FK (avoids plan↔version cycle) | Better Auth owns its tables; integrity enforced in the service layer |
| 28 | 2026-11-07 | Pricing engine rounds half-up like JS `Math.round`; `min_weeks` and `price_round_to` moved into `pricing.yaml`; request may override `hourlyRate`/`buffer` per plan; `platform_multiplier` stays unused until the web engine uses it | Python and web estimates must match to the dollar (466 h, $13,900–$18,800, 11 wk demo) |
| 29 | 2026-11-07 | `CREATE EXTENSION vector` deferred to the M4 Mem0 migration | M2 tables don't need pgvector; keep the first migration minimal |
| 30 | 2026-11-07 | API-only error codes: `internal`, `invalid_input`, `method_not_allowed`, `unauthorized`, `database_unavailable`; routing 404s reuse `not_found` with neutral wording | Same humanized shape as the web app; codes stay few and stable |
| 31 | 2026-11-07 | Logo = prism cube (three shaded faces) on a glossy gradient tile derived from --primary; replaces the converging-dots mark (#24) | Owner chose concept F: clearer and more powerful at all sizes |
| 32 | 2026-11-07 | Agent system = LangGraph (orchestration, interrupt for question rounds, Postgres checkpointer on Neon) + LangChain chat models (`init_chat_model`) + Mem0 memory. Supersedes #6 (plain pipeline) and #8 (LiteLLM) | Owner choice; durable, resumable, parallel graph with human-in-the-loop |
| 33 | 2026-11-07 | Admin has full control of providers and models: add/enable providers and models, default model, per-agent override, fallback chain; default `anthropic:claude-opus-5-5` | Owner wants admin to decide models and use every API they add |
| 34 | 2026-11-07 | Interviewer follows the grilling method; Spec agent follows to-spec; Backlog agent follows to-tickets — re-written in our own words/format; caps are admin-configurable, not hard rules | Owner wants the same questioning/spec quality as the skills used to build SpecDesk |
| 35 | 2026-11-07 | Competitor research uses Claude's built-in web search tool instead of Tavily | Built-in first; one less service and key |
| 36 | 2026-11-07 | LangChain docs via MCP: hosted `docs-langchain` (https://docs.langchain.com/mcp) + `langgraph-docs` (mcpdoc llms.txt), project scope in `.mcp.json`; official LangChain Python/LangGraph skills vendored into `.claude/skills/` after review (no installer run, no scripts) | Build agents from current official docs, not memory |
| 37 | 2026-11-07 | Structured output via LangChain `method="json_schema"` (native, no forced tool calls — Opus 5.5 rejects those); Claude `effort` per agent (adaptive thinking, summarized) | Correct on current Claude models; one code path for every provider |
| 38 | 2026-11-07 | Interviewer split into `interviewer` (model call) and `ask_founder` (`interrupt()` only); resume payload always wrapped as `{"answers": ...}` | LangGraph re-runs the paused node on resume, and reads a bare dict as an interrupt-id map |
| 39 | 2026-11-07 | LangGraph checkpoint tables created by a deploy command and ignored by Alembic; pool disables prepared statements and checks connections (Neon PgBouncer, idle disconnects) | Same rule as migrations; serverless-safe |
| 40 | 2026-11-07 | Until M3, `current_owner` returns a fixed dev owner in development/test and refuses elsewhere; routes already depend on it | Lets the agent work ship before auth without opening production |
| 41 | 2026-11-07 | Groq is the default provider for now: `groq:openai/gpt-oss-120b`, falling back to `gpt-oss-20b` (both support `json_schema`). Claude stays in the catalog, switched off. Effort maps to `reasoning_effort` | Cheap and fast while building; one admin switch moves back to Claude |
| 42 | 2026-11-07 | Better Auth tables are created with the official `auth` CLI (`pnpm dlx auth@<better-auth version> migrate`); `@better-auth/cli` is deprecated | Official tooling; Alembic still ignores these tables |
| 43 | 2026-11-07 | Admin role from Better Auth `customSession` (`user.isAdmin` from `ADMIN_EMAILS`, server-side); FastAPI recomputes it from the JWT `email` claim | Never trust the client; one env var drives both |
| 44 | 2026-11-07 | JWT: EdDSA/Ed25519, iss = aud = `BETTER_AUTH_URL`, 15-min expiry, `{sub, email, name}`; FastAPI verifies with a cached PyJWT `PyJWKClient`, asymmetric algorithms only | Short-lived, verifiable without a shared secret |
| 45 | 2026-11-07 | The browser never calls FastAPI directly: the Next `/api/v1/*` proxy swaps the session cookie for a JWT and streams responses through unbuffered | Tokens stay server-side; same-origin; SSE works |
| 46 | 2026-11-07 | Sign-in codes go through Brevo's transactional email REST API (no SDK; chosen by the owner instead of Resend); without `BREVO_API_KEY` in development the code is printed in the Next terminal | Works offline in dev; one less dependency |
| 47 | 2026-11-07 | Route protection in `src/proxy.ts` (Next 16) with a full session check; the admin page checks again on the server | Defence in depth |
| 48 | 2026-11-07 | Planning graph: analyst → product ∥ architect → ux ∥ estimator ∥ backlog → critic → assemble, each agent with its own prompt file and Pydantic output; checkpointed under `plan:<chat id>` so a failed run resumes at the failed agent | Parallel where possible; retries never repeat paid calls |
| 49 | 2026-11-07 | Price and weeks are computed by the pricing engine in `assemble` and on every scope change (`POST /plans/{id}/versions`); the browser's numbers are previews only | Money is never decided by a model or the client |
| 50 | 2026-11-07 | Plan files (spec.md, backlog.csv/json, flow.mmd, build-prompt.md, ZIP) are generated from the stored version on request, not stored; PDF waits for a renderer | Deterministic, no storage to secure; ZIP timestamps fixed |
| 51 | 2026-11-07 | Competitor links are search links, not guessed homepages; no web researcher yet (Groq default has no web search) | A link that never breaks beats a hallucinated URL |
