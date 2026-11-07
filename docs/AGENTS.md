# SpecDesk — AI Agent System (design)

Built together in the main thread. Supporting backend work (DB, services, endpoints, encryption, file generators)
is delegated. Read with [ARCHITECTURE.md](ARCHITECTURE.md) (SSE contract) and [DATA_MODEL.md](DATA_MODEL.md).

## Stack

| Concern | Choice |
|---|---|
| Orchestration | **LangGraph** — one `StateGraph` per planning session |
| Model access | **LangChain** chat models via `init_chat_model("provider:model")` (Anthropic, OpenAI, Google, Groq, OpenRouter, Mistral, Ollama …) |
| Pause for answers | LangGraph **`interrupt()`** in the interviewer node; resumed with `Command(resume=answers)` |
| Durable state | LangGraph **Postgres checkpointer** on Neon, `thread_id = chat_id` (refresh / redeploy safe) |
| Structured output | `model.with_structured_output(PydanticSchema)` per agent |
| Memory | **Mem0** (OSS) with **pgvector on Neon**; read at start, write at end |
| Web search | Claude's built-in `web_search` server tool (Researcher only) |
| Streaming | `graph.astream(stream_mode=["updates", "messages", "custom"])` → mapped to our SSE events |
| Cost & usage | LangChain callback → one `agent_run` row per model call (tokens, cache tokens, cost, ms) |
| Tracing (optional) | LangSmith when `LANGSMITH_API_KEY` is set |

## The graph

```
START → load_memory → scope_guard ─(not software)→ END (humanized redirect)
                          │
                          ▼
                     interviewer ⟲ (interrupt: wait for answers; loop until frontier empty)
                          │ confirmed
                          ▼
                       analyst ──────────────┬──────────────┐
                          │                  │              │
                          ▼                  ▼              ▼
                    product/spec        researcher      (memory facts)
                     │        │          (web search)
                     ▼        ▼
                    ux     architect
                     └───┬────┘
                         ▼
                 estimator (AI sizes features) → pricing (pure code, pricing.yaml)
                         ▼
                      backlog (tickets with blocked_by)
                         ▼
                       critic (risks, readiness) ← researcher joins here
                         ▼
                   assemble_plan → save_version → files (M5) → save_memory → END
```

Nodes on the same level run in parallel (LangGraph fan-out / fan-in). Money and weeks are **always** computed in code.

## Agents and the skills they follow

| Node | Method it follows | Output (Pydantic) |
|---|---|---|
| scope_guard | — | `{is_software, reason, software_angle}` |
| **interviewer** | **grilling**: design tree, ask the whole *frontier* per round, number questions, recommended answer on each, word so "yes" accepts it, never ask for facts the system can find itself, done when nothing is assumed → confirmation | `QuestionRound` (matches `mocks/types.ts`) or `{done: true, summary}` |
| analyst | — | users, problem, goals, constraints |
| **product/spec** | **to-spec**: problem, solution, a long numbered list of user stories, implementation decisions, testing decisions, out of scope | features (MoSCoW + complexity) + `spec.md` sections |
| ux | — | screens + low-fi wireframe blocks |
| architect | — | stack choices with *why* + alternative |
| researcher | web search | competitors (name, url, note) |
| estimator | — | complexity/hours per feature, phases, team (no money) |
| **backlog** | **to-tickets**: tracer-bullet vertical slices, each with blocking edges and acceptance criteria | tickets → `backlog.csv/json` |
| critic | — | risks, assumptions, readiness score + reasons |

Skill methods are re-written in our own words and our JSON format, stored as versioned prompt files in
`apps/api/app/agents/prompts/`. They are not hard rules: admin can set safety caps (max rounds / questions / spend).

## Admin has full control of models

- **Providers**: add any LangChain-supported provider; key from Admin (encrypted) or `.env`; enable/disable.
- **Models**: add model IDs per provider, enable/disable, label, price per 1M tokens, capabilities
  (structured output, thinking, web search).
- **Default model** for every agent, **per-agent override**, **fallback chain**.
- Capability guard: the Researcher needs a web-search-capable model; Admin warns if the chosen one can't.
- Defaults shipped: `anthropic:claude-opus-5-5` with effort tuned per agent.

## Streaming → SSE mapping

| LangGraph | SSE event |
|---|---|
| node start / end (`updates`) | `agent.status` |
| `get_stream_writer()` custom event | `agent.note` |
| reasoning / thinking chunks (`messages`) | `agent.reasoning` |
| interrupt payload | `question.round` |
| file node | `file.ready` |
| graph end | `done` · errors → humanized `error` |

## Status

- ✅ **Step 1–2 done (2026-11-07):** model catalog (default, per-agent override, fallback chain,
  effort), key lookup (encrypted DB → `.env`), `ModelGateway` with cost records, interviewer graph
  (`interviewer` + `ask_founder` with `interrupt()`), Postgres checkpointer on Neon, SSE endpoints.
  58 tests (fake model, no key needed) + 1 opt-in live test. Needs an `ANTHROPIC_API_KEY` to run for real.

## Build order (each step demoable)

1. Model registry + `init_chat_model` factory + usage callback (TDD).
2. Interviewer node with `interrupt()` + checkpointer + SSE → the existing question stepper.
3. Scope guard.
4. Analyst → Product/Spec → UX ∥ Architect → Estimator + pricing → Backlog → Critic.
5. Researcher (web search) in parallel.
6. Mem0 memory (read at start, write at end; Settings → Memory shows it).
7. "Talk to the architect": tool-calling node that edits one section and saves a new version.
8. Eval set of sample ideas + regression runs.
