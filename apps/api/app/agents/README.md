# SpecDesk agents

How SpecDesk turns a founder's idea into a plan. Built with **LangGraph** (flow, pauses, saved state),
**LangChain** chat models (any provider), and later **Mem0** (memory). Design doc: [docs/AGENTS.md](../../../../docs/AGENTS.md).

## The idea in one paragraph

Every planning session is one LangGraph **thread** (`thread_id = chat.id`). The graph asks the founder
questions in rounds, pauses with `interrupt()` while they answer, then resumes exactly where it stopped —
even after a server restart, because state is saved by the Postgres checkpointer. Each step that needs
AI asks a model for a **Pydantic object**, never free text, so the rest of the code works with typed data.

## Folders

| Folder | Job | Knows about SpecDesk agents? |
|---|---|---|
| `llm/` | Pick a model, find its API key, call it, return a typed result, count tokens and cost | No — reusable |
| `prompts/` | Prompt text as Markdown, one file per agent | Yes |
| `runtime/` | Checkpointer, and turning graph output into Server-Sent Events | No |
| `interviewer/` | The interview loop: ask a round → wait for answers → repeat until ready | Yes |

## Rules we follow

1. **Nodes never call a model directly.** They receive an `AskModel` through the graph's runtime context.
   Production passes the real gateway; tests pass a fake. No API key is needed to run the test suite.
2. **AI call and pause live in different nodes.** On resume LangGraph re-runs the paused node from the
   top, so the node that calls `interrupt()` must do nothing expensive or non-idempotent before it.
3. **State is plain JSON.** Pydantic models are dumped to dicts before they go into state or `interrupt()`.
4. **Money is computed in code**, never by a model (see `app/services/pricing.py`).
5. **Admins choose models.** The catalog (providers, models, default, per-agent override, fallback chain)
   lives in `app_config`; code only ships sensible defaults.
6. **Errors reach the founder humanized** (`AppError` → `{error: {code, title, message, action}}`).

## Adding a new agent

1. Add `prompts/<agent>.md`.
2. Add the output schema (Pydantic) and a node that calls `runtime.context.ask(...)`.
3. Wire it into the graph and add a test with a fake `AskModel`.
