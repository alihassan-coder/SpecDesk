# SpecDesk — UI Spec (M1, mock data)

## Design direction: "the drafting desk"

SpecDesk turns a loose idea into a measured spec — like an architect's drafting table.
The visual language borrows from technical drawings: a faint drafting grid, **dimension lines**
that annotate numbers (price, weeks), and one warm highlighter colour for the thing you should do next.

### Tokens (dark default)

| Token | Hex | Use |
|---|---|---|
| Ink | `#0C1220` | App background (deep blueprint navy, not black) |
| Desk | `#131B2E` | Panels, sidebar |
| Rule | `#24314D` | Borders, grid lines |
| Paper | `#E8ECF4` | Primary text |
| Graphite | `#8D99B3` | Secondary text |
| Highlighter | `#F5B544` | Primary action, focus, the "next step" |
| Signal | `#6CC6E8` | Agent activity (working / streaming) |

Light mode flips to paper `#F6F7FA` background with ink text; same highlighter.
All colours are shadcn CSS variables so Settings → Appearance can change accent, radius, font and density.

### Type
- **Archivo** (variable, width axis): display text set *expanded* (`font-stretch: 125%`), body at normal width. One family, two voices.
- **JetBrains Mono** only for code blocks and file contents.

### Layout
- App: ChatGPT-like. Left sidebar (projects, new plan, calendar/booking, settings) · centre conversation (max ~760px) · right **artifact panel** slides in when a file or plan section is opened.
- Landing: left-aligned hero with the idea box; right side is a live "spec sheet" being drafted, annotated with dimension lines.

### Principles
1. The one bold thing is the spec sheet with dimension lines. Everything else is quiet.
2. Agent activity is visible but calm — Signal colour, timeline, short notes, expandable reasoning.
3. Every number has a reason you can open (price → breakdown, weeks → phases).
4. Errors say what happened and what to do next.

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
