# M1 — UI with mock data (checklist)

Goal: every screen clickable with mock data from `apps/web/src/mocks/`. No backend.

## Setup
- [ ] shadcn init (Tailwind v4, CSS variables)
- [ ] Add shadcn components (button, input, textarea, card, badge, sidebar, sheet, dialog, tabs, slider, switch, select, tooltip, dropdown-menu, avatar, separator, scroll-area, skeleton, sonner, input-otp, progress, collapsible, table, radio-group, toggle-group)
- [ ] Add AI Elements (conversation, message, prompt-input, reasoning, task, artifact, code-block, suggestion, loader)
- [ ] Fonts: Archivo + JetBrains Mono via `next/font`
- [ ] Theme tokens (docs/UI.md) + dark default + appearance provider

## Screens
- [ ] `/` landing (hero idea box, live spec sheet, how it works, sample files, CTA to demo)
- [ ] `/login` email → OTP
- [ ] App shell: sidebar (new plan, chats, calendar/booking, settings, admin if admin) + role switcher (M1 only)
- [ ] `/chat` new plan empty state with idea suggestions
- [ ] `/chat/[id]` — question rounds (chips + recommended + other + skip), agent timeline, notes, reasoning, file cards, artifact panel, booking card, humanized error demo
- [ ] `/plan/[id]` — overview, readiness, features with scope toggles → live price/weeks, screens + wireframes, stack, timeline, risks, competitors, versions & diff, downloads
- [ ] `/share/[token]` read-only plan
- [ ] `/settings` — appearance (theme, accent, radius, font, density, chat width, motion), memories, account
- [ ] `/admin` — leads, plans, bookings, models per agent, pricing
- [ ] `not-found`, `error` (humanized)

## Review gate
- [ ] Owner walks through guest → founder → admin and approves.
