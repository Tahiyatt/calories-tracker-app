# Fullstack Calorie/Fitness Tracker — Project Roadmap

**Goal:** Portfolio project for high-level internships / entry-level fullstack roles.
**Stack:** MERN (MongoDB, Express, React, Node) → React Native later.

---

## Phase 0: Setup & Planning (few days)
- [ ] Finalize feature scope (this doc)
- [ ] Design initial schema: User, FoodEntry, Meal, Goal, WeightLog
- [ ] Set up repo structure (client/server separation, monorepo or two repos — your call)
- [ ] Set up MongoDB Atlas, basic Express server, basic React app (Vite recommended)
- [ ] Push initial commit, set up GitHub Actions skeleton (lint on push)

**Deliverable:** Empty-but-running fullstack skeleton, deployed (even if barebones).

---

## Phase 1: Core CRUD + Auth (MVP backbone)
- [ ] User registration/login (JWT + refresh tokens, bcrypt password hashing) — build it yourself, don't outsource to a third-party auth provider
- [ ] Protected routes (middleware for auth)
- [ ] CRUD for daily food log entries (add/edit/delete)
- [ ] CRUD for user goals (calorie/macro targets)
- [ ] Basic weight log CRUD
- [ ] Frontend: auth pages, protected routing, daily log view/form
- [ ] Zustand for frequently-changing state (log entries, daily totals); Context for slow-changing state (auth/user)
- [ ] Form validation: React Hook Form + Zod (reuse Zod schemas server-side too if feasible)

**Deliverable:** You can register, log in, and manually log food/weight entries against goals. Ugly UI is fine here — function over form.

---

## Phase 2: External API Integration
- [ ] Integrate Open Food Facts or USDA FoodData Central for food search
- [ ] Normalize/cache external data into your own schema (don't just pass through raw API responses)
- [ ] Handle rate limiting, API failures, stale data gracefully
- [ ] Frontend: food search/autocomplete when logging entries

**Deliverable:** Users search real foods instead of typing calorie counts manually. This is your first real "backend judgment" talking point.

---

## Phase 3: Analytics Dashboard (frontend showcase)
- [ ] MongoDB aggregation pipelines: weekly/monthly calorie trends, macro breakdown, goal adherence
- [ ] Charting library (Recharts or Chart.js) for visualizations
- [ ] Dashboard UI: trends over time, goal vs. actual, streaks
- [ ] Polish overall UI/UX — this is the visual centerpiece for demos

**Deliverable:** A genuinely demo-able app. This is your "show recruiters" milestone — good stopping point for a v1 release.

---

## Phase 4: Deployment & DevOps Polish
- [ ] Deploy backend (Render/Railway/Fly.io) and frontend (Vercel/Netlify)
- [ ] MongoDB Atlas production setup
- [ ] GitHub Actions: lint + test on push (expand from Phase 0 skeleton)
- [ ] Integration tests for core endpoints (Jest + Supertest)
- [ ] README with setup instructions, screenshots, architecture overview

**Deliverable:** A polished, publicly deployed v1 with a resume-ready README. **This is your "done" milestone — don't skip celebrating/using this checkpoint.**

---

## Phase 5 (Stretch): Caching Layer
- [ ] Identify a real bottleneck (likely repeated food searches) — measure it first
- [ ] Add Redis caching for frequent food lookups
- [ ] Measure and document the improvement (this becomes your interview story: "found the bottleneck, fixed it, here's the number")
- [ ] Optional: background jobs (node-cron or BullMQ) for daily summary emails/reminders

**Deliverable:** A backend-depth story to tell in interviews, built on top of an already-working app.

---

## Phase 6 (Stretch): React Native Mobile Version
- [ ] Confirm backend/API is fully client-agnostic (no web-specific assumptions in controllers)
- [ ] Reuse Zod schemas / API contracts as the source of truth for RN app
- [ ] Build core screens: log entry, dashboard, food search
- [ ] Handle mobile-specific concerns (offline logging + sync, camera for barcode scanning if you want to go further)

**Deliverable:** Mobile app demonstrating code/architecture reuse across platforms — a strong "system design" talking point.

---

## Suggested Order of Priority
1. Phases 0–3 are your MVP — don't move to deployment polish until the dashboard works.
2. Phase 4 (deployment) should happen **before** stretch goals — a deployed "good enough" app beats an undeployed "impressive" one.
3. Phases 5 and 6 are both optional add-ons, pick based on time and which story you want to tell (backend depth vs. cross-platform reuse). Doing both eventually is ideal, but neither is required to have a strong project.

## Notes / Decisions Log
*(Use this section to track key decisions as you make them — useful for interview prep later.)*
- Schema decisions:
- Why Zustand over Redux:
- Why [chosen external API] over alternatives:
- Any tradeoffs made under time constraints:
