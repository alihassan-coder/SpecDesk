# Data Model (Neon Postgres)

Auth tables (`user`, `session`, `account`, `verification`, `jwks`) are created and owned by **Better Auth**.
App tables below are owned by **FastAPI** (SQLAlchemy 2 + Alembic). Every app row that belongs to a
person carries `owner_id → user.id`, and every query filters by the JWT subject.

```
user (Better Auth) 1───* chat 1───* message
                          │
                          1───1 plan 1───* plan_version 1───* plan_file
                          │
user 1───* booking *───1 plan (nullable)
user 1───1 lead
user 1───1 user_settings
mem0 tables (managed by Mem0 + pgvector)
```

| Table | Key columns |
|---|---|
| `chat` | `id uuid`, `owner_id`, `title`, `idea`, `status` (`interviewing`/`generating`/`ready`/`failed`), `created_at`, `updated_at` |
| `message` | `id`, `chat_id`, `role` (`user`/`assistant`/`system`), `kind` (`text`/`question_round`/`answers`/`agent_event`/`file`/`booking`), `content jsonb`, `created_at` |
| `plan` | `id`, `chat_id unique`, `owner_id`, `current_version_id`, `share_token unique nullable`, `created_at` |
| `plan_version` | `id`, `plan_id`, `number`, `label`, `data jsonb` (full Plan shape), `price_min`, `price_max`, `weeks`, `change_summary`, `created_at` |
| `plan_file` | `id`, `version_id`, `name`, `kind`, `size_bytes`, `storage_url`, `created_at` |
| `agent_run` | `id`, `chat_id`, `agent`, `model`, `status`, `input_tokens`, `output_tokens`, `cost_usd`, `duration_ms`, `error`, `created_at` |
| `booking` | `id`, `owner_id`, `plan_id nullable`, `calendly_event_uri`, `starts_at`, `status`, `created_at` |
| `lead` | `id`, `owner_id unique`, `name`, `company`, `budget_range`, `status` (`new`/`booked`/`contacted`/`won`/`lost`), `notes`, `created_at` |
| `user_settings` | `owner_id pk`, `appearance jsonb`, `updated_at` |
| `provider_key` | `provider pk` (`anthropic`/`openai`/`gemini`/`groq`/`openrouter`/`tavily`…), `ciphertext`, `last4`, `updated_by`, `updated_at`, `last_test_ok bool` |
| `app_config` | `key pk`, `value jsonb` — admin-editable model-per-agent and pricing overrides |

Indexes: `(owner_id, updated_at desc)` on `chat`; `(chat_id, created_at)` on `message`; `share_token`.
