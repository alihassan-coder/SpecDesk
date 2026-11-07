# SpecDesk — UI Spec (M1, mock data)

## Design direction: default shadcn/ui

SpecDesk uses the **stock shadcn/ui look** (style `radix-nova`, base colour neutral) with a **blue primary**,
**light theme by default** and a dark-mode toggle (next-themes). Reference: the owner's *timedesk* app.

- **Tokens:** stock shadcn neutral CSS variables in `src/app/globals.css`; primary = blue-600 (light) / blue-500 (dark).
  Settings → Appearance may override the accent at runtime. Never hard-code colours.
- **Type:** Geist Sans (default), Geist Mono for code and file names. Optional Inter / system font in Settings.
- **Components first:** Card (sections), Field (settings rows: title + description + control), Item (lists),
  Sidebar (`collapsible="icon"`, grouped nav, NavUser footer), Tabs, Badge, Empty, Spinner, Table, Dialog, Sheet.
  Don't hand-style what a shadcn component already does.
- **Layout:** ChatGPT-like app shell — sidebar · centred conversation (`--chat-width`) · artifact panel on the right.
- **Logo:** prism cube (three shaded faces) on a glossy gradient tile that follows `--primary`. `src/components/brand/logo.tsx`, favicon `src/app/icon.svg`.
- **Glass (macOS-style):** `.glass` utility in globals.css (frosted, blur + saturate, inner highlight; light + dark). Needs colour behind it — `GlassBackdrop` (soft theme-colour blobs). Used on the landing page: header, idea box, workflow windows.
- **Landing:** headline + one line + Tempo-style prompt box with chips, a divider, then the static pipeline SVG. No duplicate CTAs, no decorative blobs (one faint top glow), no "AI" sparkle icons.
- **Distinctiveness lives in the product** (question rounds, agent timeline, scope switches, versions), not in custom styling.

## Screens

| Route | Screen |
|---|---|
| `/` | Landing + idea box + "Try the demo" (guest) |
| `/login` | Email → 6-digit code |
| `/chat` | New plan (empty state) |
| `/chat/[id]` | Conversation: question rounds w/ chips, agent timeline, reasoning, file cards, artifact panel, booking card |
| `/plan/[id]` | Full plan: features (MoSCoW + scope toggles → live price/time), screens + wireframes, stack, timeline, price, risks, readiness, competitors, versions & diff |
| `/share/[token]` | Read-only plan |
| `/settings` | Appearance (theme, accent, radius, font, density, chat width, motion), memories, account |
| `/admin` | Leads, plans, bookings, models per agent, pricing |

## Guest mode
"Try the demo" → `/chat/demo` with a scripted session (mock SSE events played on timers). A role
switcher (guest / founder / admin) is available in M1 so every view can be reviewed.
