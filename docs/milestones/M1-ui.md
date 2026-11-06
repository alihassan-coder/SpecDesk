# M1 — UI with mock data (checklist)

Goal: every screen clickable with mock data from `apps/web/src/mocks/`. No backend.

## Setup
- [x] shadcn init (Tailwind v4, CSS variables, `radix-nova` style)
- [x] Add shadcn components (button, input, textarea, card, badge, sidebar, sheet, dialog, tabs, slider, switch, select, tooltip, dropdown-menu, avatar, separator, scroll-area, skeleton, sonner, input-otp, progress, collapsible, table, radio-group, toggle-group)
- [ ] Add AI Elements — chat currently uses shadcn primitives; swap in AI Elements Conversation / Reasoning / Artifact / PromptInput before M4 (conversation, message, prompt-input, reasoning, task, artifact, code-block, suggestion, loader)
- [x] Fonts: Archivo + JetBrains Mono via `next/font`
- [x] Theme tokens (docs/UI.md) + dark default + appearance provider

## Screens
- [x] `/` landing (hero idea box, live spec sheet, how it works, sample files, CTA to demo)
- [x] `/login` email → OTP
- [x] App shell: sidebar (new plan, chats, calendar/booking, settings, admin if admin) + role switcher (M1 only)
- [x] `/chat` new plan empty state with idea suggestions
- [x] `/chat/[id]` — question rounds (chips + recommended + other + skip), agent timeline, notes, reasoning, file cards, artifact panel, booking card, humanized error demo
- [x] `/plan/[id]` — overview, readiness, features with scope toggles → live price/weeks, screens + wireframes, stack, timeline, risks, competitors, versions & diff, downloads
- [x] `/share/[token]` read-only plan
- [x] `/settings` — appearance (theme, accent, radius, font, density, chat width, motion), memories, account
- [x] `/admin` — leads, plans, bookings, models per agent, pricing
- [x] `not-found`, `error` (humanized)

## Review gate
- [ ] Owner walks through guest → founder → admin and approves.

> Status 2026-11-06: all screens built; `tsc`, `eslint` and `next build` pass. Waiting on owner review.
