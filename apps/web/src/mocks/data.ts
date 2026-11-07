// Mock data for the guest demo only (/chat/demo, /plan/demo, /share/…). Signed-in users never see it.
import type {
  AgentId,
  Agent,
  ChatSummary,
  Plan,
  QuestionRound,
  StreamEvent,
} from "./types";

export const DEMO_IDEA =
  "An app for independent physiotherapists: patients book sessions, get a home exercise plan with videos, and the physio can see whether they actually did the exercises.";

export const AGENTS: Agent[] = [
  { id: "interviewer", name: "Interviewer", job: "Asks the questions that shape the plan" },
  { id: "analyst", name: "Analyst", job: "Pins down users, problem and goals" },
  { id: "product", name: "Product", job: "Turns goals into features, MVP vs later" },
  { id: "ux", name: "UX", job: "Maps screens, flows and wireframes" },
  { id: "architect", name: "Architect", job: "Chooses the stack and explains why" },
  { id: "estimator", name: "Estimator", job: "Scores complexity, builds timeline and price" },
  { id: "critic", name: "Critic", job: "Finds risks and scores readiness" },
  { id: "backlog", name: "Backlog", job: "Writes build-ready tickets in order" },
  { id: "researcher", name: "Researcher", job: "Scans competitors on the web" },
];

/** The demo plays these agents; live chats use LIVE_AGENT_IDS (no web researcher yet). */
export const DEMO_AGENT_IDS: AgentId[] = ["analyst", "product", "ux", "architect", "estimator", "critic", "researcher"];
export const LIVE_AGENT_IDS: AgentId[] = ["analyst", "product", "architect", "ux", "estimator", "backlog", "critic"];

export const ROUND_1: QuestionRound = {
  round: 1,
  questions: [
    {
      id: "platform",
      title: "Where will patients use it?",
      body: "Patients do exercises at home, usually on their phone. Physios manage their week on a laptop.",
      options: [
        { id: "mobile-web", label: "Mobile app for patients, web for physios" },
        { id: "web-only", label: "Web app for both", hint: "Cheapest, no app stores" },
        { id: "mobile-only", label: "Mobile apps for both" },
      ],
      recommended: "mobile-web",
    },
    {
      id: "clinics",
      title: "One physio or whole clinics?",
      body: "Supporting clinics with several physios adds teams, roles and shared calendars.",
      options: [
        { id: "solo", label: "Solo physios first" },
        { id: "clinics", label: "Clinics with several physios" },
      ],
      recommended: "solo",
    },
    {
      id: "payments",
      title: "Do patients pay inside the app?",
      body: "Taking payment at booking cuts no-shows but adds payouts, refunds and receipts.",
      options: [
        { id: "card", label: "Yes, pay when booking" },
        { id: "later", label: "Not in the MVP" },
      ],
      recommended: "card",
    },
    {
      id: "videos",
      title: "Who makes the exercise videos?",
      body: "A built-in library is faster to launch; physio uploads feel more personal.",
      options: [
        { id: "library", label: "A built-in library" },
        { id: "upload", label: "Physios upload their own" },
        { id: "both", label: "Both" },
      ],
      recommended: "both",
    },
  ],
};

export const ROUND_2: QuestionRound = {
  round: 2,
  questions: [
    {
      id: "tracking",
      title: "How do you know a patient did the exercise?",
      body: "Self check-off is simple. Pain and effort ratings give the physio something to act on.",
      options: [
        { id: "checkoff", label: "Patient ticks it off" },
        { id: "rating", label: "Tick off + pain/effort rating" },
        { id: "camera", label: "Camera form-check (AI)", hint: "Adds 6–10 weeks" },
      ],
      recommended: "rating",
    },
    {
      id: "reminders",
      title: "Should patients get reminders?",
      body: "Push reminders are the main lever for adherence.",
      options: [
        { id: "push", label: "Push notifications" },
        { id: "push-sms", label: "Push + SMS" },
        { id: "none", label: "No reminders" },
      ],
      recommended: "push",
    },
  ],
};

export const DEMO_PLAN: Plan = {
  id: "demo",
  title: "Rehabit",
  oneLiner: "Booking and home-exercise tracking for independent physiotherapists.",
  problem:
    "Patients forget or skip their home exercises, and physios only find out at the next session. Booking happens over WhatsApp and no-shows cost money.",
  audience: ["Independent physiotherapists", "Their patients (25–70, mostly on phones)"],
  readiness: 78,
  readinessNotes: [
    "Clear user and problem",
    "MVP scope is realistic",
    "Pricing model for physios not decided yet",
    "No plan yet for health-data compliance",
  ],
  features: [
    { id: "f1", name: "Email & phone sign-in", description: "Patients and physios sign in with a code, no passwords.", complexity: "S", moscow: "must", hours: 24, included: true },
    { id: "f2", name: "Booking calendar", description: "Physio sets availability; patients book open slots.", complexity: "L", moscow: "must", hours: 80, included: true },
    { id: "f3", name: "Card payment at booking", description: "Stripe checkout, refunds on cancellation.", complexity: "M", moscow: "must", hours: 48, included: true },
    { id: "f4", name: "Exercise plans", description: "Physio builds a plan from the library or own videos.", complexity: "L", moscow: "must", hours: 72, included: true },
    { id: "f5", name: "Exercise check-off with pain rating", description: "Patients tick off each exercise and rate pain 0–10.", complexity: "M", moscow: "must", hours: 40, included: true },
    { id: "f6", name: "Adherence dashboard", description: "Physio sees who is on track and who needs a nudge.", complexity: "M", moscow: "should", hours: 44, included: true },
    { id: "f7", name: "Push reminders", description: "Daily reminders at the patient's chosen time.", complexity: "S", moscow: "should", hours: 20, included: true },
    { id: "f8", name: "Video upload", description: "Physios record and upload their own exercise videos.", complexity: "M", moscow: "could", hours: 36, included: false },
    { id: "f9", name: "In-app chat", description: "Secure messages between patient and physio.", complexity: "L", moscow: "could", hours: 64, included: false },
    { id: "f10", name: "AI form check", description: "Camera checks exercise form in real time.", complexity: "XL", moscow: "wont", hours: 220, included: false },
  ],
  screens: [
    {
      id: "s1",
      name: "Patient home",
      purpose: "Today's exercises and next booking",
      wireframe: [
        { kind: "header", span: 4, label: "Good morning, Sara" },
        { kind: "card", span: 4, label: "Next session · Thu 10:00" },
        { kind: "list", span: 4, label: "Today's exercises (3)" },
        { kind: "button", span: 4, label: "Start exercises" },
        { kind: "nav", span: 4 },
      ],
    },
    {
      id: "s2",
      name: "Exercise player",
      purpose: "Video, reps and the check-off",
      wireframe: [
        { kind: "image", span: 4, label: "Video" },
        { kind: "text", span: 4, label: "Bridge · 3 × 12" },
        { kind: "input", span: 4, label: "Pain 0–10" },
        { kind: "button", span: 4, label: "Mark done" },
      ],
    },
    {
      id: "s3",
      name: "Physio dashboard",
      purpose: "Week calendar and adherence at a glance",
      wireframe: [
        { kind: "nav", span: 1 },
        { kind: "header", span: 3, label: "This week" },
        { kind: "chart", span: 2, label: "Adherence" },
        { kind: "list", span: 2, label: "Needs a nudge" },
        { kind: "card", span: 4, label: "Calendar" },
      ],
    },
    {
      id: "s4",
      name: "Plan builder",
      purpose: "Build a patient's exercise plan",
      wireframe: [
        { kind: "nav", span: 1 },
        { kind: "tabs", span: 3, label: "Library · My videos" },
        { kind: "list", span: 2, label: "Exercises" },
        { kind: "card", span: 2, label: "Patient plan" },
        { kind: "button", span: 4, label: "Send to patient" },
      ],
    },
    {
      id: "s5",
      name: "Booking",
      purpose: "Pick a slot and pay",
      wireframe: [
        { kind: "header", span: 4, label: "Book with Dr. Malik" },
        { kind: "card", span: 4, label: "Calendar" },
        { kind: "list", span: 4, label: "Open slots" },
        { kind: "button", span: 4, label: "Pay & book" },
      ],
    },
  ],
  stack: [
    { layer: "Patient app", choice: "React Native (Expo)", why: "One codebase for iOS and Android, fast push notifications and video playback.", alternative: "Flutter — equally capable, but your web dashboard would then share no code." },
    { layer: "Physio dashboard", choice: "Next.js + shadcn/ui", why: "Shares TypeScript types and logic with the mobile app.", alternative: "Plain React SPA — fine, but loses server rendering for the public booking pages." },
    { layer: "API", choice: "FastAPI (Python)", why: "Quick to build, typed, and ready for the AI form-check later.", alternative: "Node/NestJS — keeps one language, weaker ML ecosystem." },
    { layer: "Database", choice: "Postgres (Neon)", why: "Relational data — bookings, plans, check-ins — with branching for safe testing.", alternative: "Firebase — faster start, harder reporting later." },
    { layer: "Video", choice: "Mux", why: "Adaptive streaming so videos play on slow mobile data.", alternative: "S3 + CloudFront — cheaper, more work." },
    { layer: "Payments", choice: "Stripe", why: "Checkout, refunds and payouts to physios.", alternative: "Lemon Squeezy — simpler tax, no marketplace payouts." },
  ],
  phases: [
    { name: "Discovery & design", weeks: 2, deliverables: ["Clickable prototype", "Design system"] },
    { name: "Core build", weeks: 5, deliverables: ["Sign-in", "Booking", "Payments", "Exercise plans"] },
    { name: "Adherence & reminders", weeks: 2, deliverables: ["Check-off", "Dashboard", "Push"] },
    { name: "QA & launch", weeks: 2, deliverables: ["Beta with 5 physios", "App store release"] },
  ],
  team: ["1 product designer", "2 full-stack engineers", "1 mobile engineer", "Part-time QA"],
  hourlyRate: 35,
  buffer: 0.2,
  risks: [
    { title: "Health data compliance", impact: "high", mitigation: "Store only what's needed, encrypt at rest, check local rules (GDPR / HIPAA) before launch." },
    { title: "Patients stop opening the app", impact: "medium", mitigation: "Reminders, streaks, and physio nudges from the dashboard." },
    { title: "App store review delays", impact: "low", mitigation: "Submit a beta build in week 8." },
  ],
  assumptions: [
    "Physios already have a Stripe-supported bank account",
    "A starter library of ~60 exercise videos can be licensed",
    "English only at launch",
  ],
  competitors: [
    { name: "Physitrack", url: "https://www.physitrack.com", note: "Strong exercise library; clinic-focused and priced for teams." },
    { name: "Jane App", url: "https://jane.app", note: "Excellent booking and billing; light on home exercise tracking." },
    { name: "MedBridge", url: "https://www.medbridge.com", note: "Enterprise HEP; heavy for solo practitioners." },
  ],
  versions: [
    { id: "v1", label: "v1 · First draft", createdAt: "2026-11-06T10:02:00Z", priceMin: 17400, priceMax: 23600, weeks: 14, change: "Initial plan with in-app chat and video upload." },
    { id: "v2", label: "v2 · Lean MVP", createdAt: "2026-11-06T10:09:00Z", priceMin: 13900, priceMax: 18800, weeks: 11, change: "Moved chat and video upload to later. −$4,800, −3 weeks." },
  ],
  files: [
    { id: "pdf", name: "Rehabit-plan.pdf", kind: "pdf", size: "412 KB" },
    { id: "md", name: "spec.md", kind: "md", size: "18 KB", preview: "# Rehabit — Product Spec\n\n## Problem\nPatients forget or skip their home exercises...\n\n## MVP features\n- Email & phone sign-in (S)\n- Booking calendar (L)\n- Card payment at booking (M)\n- Exercise plans (L)\n- Check-off with pain rating (M)\n" },
    { id: "csv", name: "backlog.csv", kind: "csv", size: "6 KB", preview: "id,title,type,estimate,priority\nF1,Email & phone sign-in,story,24h,must\nF2,Booking calendar,epic,80h,must\nF3,Card payment at booking,story,48h,must\n" },
    { id: "prompt", name: "build-prompt.md", kind: "md", size: "9 KB", preview: "You are building Rehabit, a booking and home-exercise app for physiotherapists.\n\nStack: Expo, Next.js, FastAPI, Postgres (Neon), Stripe, Mux.\n\nStart with milestone 1: sign-in and booking..." },
    { id: "flow", name: "flow.mmd", kind: "mmd", size: "2 KB", preview: "flowchart LR\n  A[Patient opens app] --> B{Booked?}\n  B -- no --> C[Book slot] --> D[Pay]\n  B -- yes --> E[Today's exercises] --> F[Check off + pain]" },
    { id: "zip", name: "rehabit-specdesk.zip", kind: "zip", size: "448 KB" },
  ],
};

/** Scripted demo session played after round answers. */
export const PIPELINE_SCRIPT: { delay: number; event: StreamEvent }[] = [
  { delay: 300, event: { type: "agent.status", agent: "analyst", status: "working" } },
  { delay: 900, event: { type: "agent.note", agent: "analyst", text: "Two user types: solo physios (pay) and patients (use daily)." } },
  { delay: 700, event: { type: "agent.reasoning", agent: "analyst", text: "The physio is the buyer, but patient adherence is the outcome they pay for. So the patient app must be dead simple, and the physio needs proof of adherence. That makes check-off with ratings the core loop, not booking." } },
  { delay: 600, event: { type: "agent.status", agent: "analyst", status: "done" } },
  { delay: 200, event: { type: "agent.status", agent: "product", status: "working" } },
  { delay: 900, event: { type: "agent.note", agent: "product", text: "10 features found. 5 are must-haves for the MVP." } },
  { delay: 700, event: { type: "agent.reasoning", agent: "product", text: "AI form check is impressive but adds ~220 hours and needs training data. Parking it as 'won't (yet)'. In-app chat duplicates WhatsApp, which physios already use — moving it to 'could'." } },
  { delay: 500, event: { type: "agent.status", agent: "product", status: "done" } },
  { delay: 200, event: { type: "agent.status", agent: "ux", status: "working" } },
  { delay: 900, event: { type: "agent.note", agent: "ux", text: "Mapped 5 core screens and the patient's daily flow." } },
  { delay: 500, event: { type: "agent.status", agent: "ux", status: "done" } },
  { delay: 200, event: { type: "agent.status", agent: "architect", status: "working" } },
  { delay: 900, event: { type: "agent.note", agent: "architect", text: "You need payments → adding Stripe with webhooks for refunds." } },
  { delay: 700, event: { type: "agent.reasoning", agent: "architect", text: "Video on patients' mobile data needs adaptive streaming. Mux over raw S3: more expensive per minute, but saves ~3 weeks of encoding work." } },
  { delay: 500, event: { type: "agent.status", agent: "architect", status: "done" } },
  { delay: 200, event: { type: "agent.status", agent: "estimator", status: "working" } },
  { delay: 900, event: { type: "agent.note", agent: "estimator", text: "388 hours incl. setup, +20% buffer → 466 hours, about 11 weeks." } },
  { delay: 500, event: { type: "agent.status", agent: "estimator", status: "done" } },
  { delay: 200, event: { type: "agent.status", agent: "critic", status: "working" } },
  { delay: 200, event: { type: "agent.status", agent: "researcher", status: "working" } },
  { delay: 900, event: { type: "agent.note", agent: "critic", text: "Biggest risk: health data compliance. Readiness 78/100." } },
  { delay: 600, event: { type: "agent.note", agent: "researcher", text: "Found 3 competitors. None focus on solo physios." } },
  { delay: 400, event: { type: "agent.status", agent: "critic", status: "done" } },
  { delay: 300, event: { type: "agent.status", agent: "researcher", status: "done" } },
  ...DEMO_PLAN.files.map((file, i) => ({ delay: i === 0 ? 500 : 250, event: { type: "file.ready", file } as StreamEvent })),
  { delay: 400, event: { type: "done", planId: "demo" } },
  { delay: 800, event: { type: "booking.suggest", reason: "Want us to build it?" } },
];

export const CHATS: ChatSummary[] = [
  { id: "demo", title: "Rehabit — physio exercise app", updatedAt: "2026-11-06T10:09:00Z", status: "ready" },
  { id: "c2", title: "Marketplace for used camera gear", updatedAt: "2026-11-05T16:40:00Z", status: "ready" },
  { id: "c3", title: "AI meeting notes for lawyers", updatedAt: "2026-11-03T09:12:00Z", status: "interviewing" },
  { id: "c4", title: "School bus tracking app", updatedAt: "2026-10-28T14:20:00Z", status: "ready" },
];
