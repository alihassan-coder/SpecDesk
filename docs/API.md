# API (FastAPI) — draft

Base: `/api/v1`. Auth: `Authorization: Bearer <Better Auth JWT>`, verified against the web app's JWKS.
Errors always return the humanized shape:

```json
{ "error": { "code": "rate_limited", "title": "Slow down a little", "message": "You've started 5 plans in a minute.", "action": "Try again in 30 seconds." } }
```

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/health` | public | Liveness |
| GET | `/chats` | owner | List my chats |
| POST | `/chats` | owner | Start from an idea → runs scope guard, returns chat + first round |
| GET | `/chats/{id}` | owner | Chat with messages |
| DELETE | `/chats/{id}` | owner | Delete chat |
| POST | `/chats/{id}/answers` | owner | Submit a round's answers → next round or "ready to generate" |
| GET | `/chats/{id}/stream` | owner | **SSE**: question rounds, agent events, files (see ARCHITECTURE.md) |
| POST | `/chats/{id}/generate` | owner | Skip remaining questions, generate now |
| POST | `/chats/{id}/architect` | owner | Follow-up "talk to the architect" message (SSE) |
| GET | `/plans/{id}` | owner | Current plan version |
| POST | `/plans/{id}/versions` | owner | Save scope changes as a new version |
| GET | `/plans/{id}/diff?from=&to=` | owner | Version diff |
| POST | `/plans/{id}/share` | owner | Create/revoke share token |
| GET | `/share/{token}` | public | Read-only plan |
| GET | `/files/{id}` | owner / share | Download a file |
| POST | `/pricing/estimate` | owner | Recompute price/time for a feature selection |
| GET/DELETE | `/memories`, `/memories/{id}` | owner | View/delete Mem0 memories |
| GET/PUT | `/settings` | owner | Appearance settings |
| POST | `/webhooks/calendly` | Calendly (signed) | Booking created/cancelled |
| GET | `/admin/leads`, `/admin/plans`, `/admin/bookings`, `/admin/usage` | admin | Admin views |
| GET/PUT | `/admin/config` | admin | Model per agent, fallback model, pricing overrides |
| GET | `/admin/keys` | admin | Providers with masked key + source (`db`/`env`/`missing`) |
| PUT/DELETE | `/admin/keys/{provider}` | admin | Save (encrypted) or remove a key |
| POST | `/admin/keys/{provider}/test` | admin | Test the key with a tiny request |
