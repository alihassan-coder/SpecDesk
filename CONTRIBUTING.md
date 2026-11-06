# Contributing to SpecDesk

Thanks for helping. This guide keeps changes easy to review.

## Before you start
- Read [docs/PLAN.md](docs/PLAN.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- For anything bigger than a small fix, open an issue first so we can agree on the approach.

## Setup
See [Getting started](README.md#getting-started). Frontend uses **pnpm**, backend uses **uv**.

## Workflow
1. Fork and create a branch: `feat/plan-diff`, `fix/otp-timeout`, `docs/api`.
2. Keep pull requests small and focused on one thing.
3. Use [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
4. Run checks before pushing:
   ```bash
   pnpm lint:web && pnpm --filter web exec tsc --noEmit
   cd apps/api && uv run ruff check . && uv run pytest
   ```
5. Open a PR using the template and link the issue.

## Standards
- TypeScript strict, no `any`; Python fully typed.
- Use existing libraries (shadcn/ui, AI Elements, Better Auth, LiteLLM, Mem0) before writing your own.
- UI uses theme tokens only — no hard-coded colours.
- Errors shown to users must say what happened and what to do next.
- Schema changes go through Alembic ([docs/MIGRATIONS.md](docs/MIGRATIONS.md)).
- Never commit secrets. `.env.example` holds placeholders only.
- New product or tech decisions get a row in [docs/DECISIONS.md](docs/DECISIONS.md).
