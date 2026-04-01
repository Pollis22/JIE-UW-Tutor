# CLAUDE.md — JIE-UW-Tutor

## Project Overview
JIE-UW-Tutor is the University of Wisconsin–Madison white-label deployment of JIE Mastery. College/Adult learners only — no K-12 grade bands. Same voice pipeline as JIE Mastery: AssemblyAI STT → Claude LLM → ElevenLabs TTS. Includes Student Relationship Management (SRM) system with syllabus parsing, academic calendar, study tasks, and engagement scoring.

## Branch & Deployment Rules (CRITICAL)

### Branch Strategy
- **NO dev branch** — all changes push directly to `main`
- This is different from JIE-Mastery-Tutor-V2 which uses dev → main promotion
- Simply: edit → commit → push to main

### Hosting & Database
- Railway (single environment)
- PostgreSQL via Railway, managed via Beekeeper Studio
- This is a SEPARATE database from JIE Mastery — changes are independent

## Tech Stack
- **Frontend**: React 18, TypeScript, TanStack Query, shadcn/ui, Wouter routing, Vite
- **Backend**: Express.js, TypeScript, PostgreSQL via Drizzle ORM
- **Voice**: AssemblyAI STT, Claude LLM, ElevenLabs TTS, Silero VAD (self-hosted WASM in `client/public/onnx/`)
- **Auth**: Access-code-only (no Stripe payments — UW provides access codes)
- **Email**: Resend

## Key File Structure
```
server/routes.ts           — Main route registration (dynamic imports)
server/routes/
  custom-voice-ws.ts       — WebSocket voice pipeline (CAREFUL — do not touch voice settings)
  academic.ts              — SRM routes (syllabus parser, courses, calendar, tasks, reminders, engagement)
  documents.ts             — User document management
  context.ts               — Tutor context/RAG
  students.ts              — Student management

server/services/
  ai-service.ts            — Claude API integration + retry logic

client/src/pages/
  admin-page-enhanced.tsx  — ★ ACTIVE admin dashboard (tabbed layout)
  auth-page.tsx            — UW-branded landing page with SRM showcase
  dashboard.tsx            — Student dashboard
  tutor-page.tsx           — Voice tutoring (LOCKED to College/Adult only)
  academic-dashboard.tsx   — SRM student view
  srm-page.tsx             — Dedicated /srm info page

shared/schema.ts           — ALL Drizzle ORM table definitions
```

### Route Registration Pattern
```typescript
const { default: routeName } = await import('./routes/filename');
app.use("/api/path", routeName);
app.use("/api/admin/path", requireAdmin, routeName);
```

## Critical Rules

### Voice Pipeline — DO NOT TOUCH without explicit instruction
- Files: `custom-voice-ws.ts`, `ai-service.ts`, `use-custom-voice.ts`, `tts-service.ts`, `realtime-voice-host.tsx`
- Any voice stack changes MUST be applied to both JIE-UW-Tutor AND JIE-Mastery-Tutor-V2 simultaneously
- AssemblyAI formatted duplicates must NOT cancel continuation timers

### UW-Specific Rules
- **ALL branding must say "UW AI Tutor"** — never "JIE Mastery" in user-facing content
- **Grade level is LOCKED to College/Adult** — no K-12 grade bands, no grade selector dropdown
- `tutor-page.tsx` forces `setLevel('college')` regardless of student profile
- `StudentProfilePanel.tsx` Grade Level input is disabled, shows "College/Adult" only

### Database Best Practices
- Admin endpoints must use batch PostgreSQL queries for 1,000+ students
- NEVER per-row N+1 queries
- SRM tables: student_courses, student_calendar_events, student_tasks, student_reminders, student_engagement_scores, student_parent_shares

### SRM Architecture
- Syllabus upload: POST /api/academic/courses/:id/syllabus — uses Claude to parse dates
- Study task generation: 7/5/3/1 day rules before exams
- Engagement scoring: 0-100 scale (On Track/Needs Attention/At Risk/Critical)
- Admin tracker with intervention alerts
- Parent email sharing via Resend
- Reference implementation in `server/routes/academic.ts`:
  - Lines 253-395: Claude syllabus parser
  - Lines 34-100: generateStudyTasks
  - generateReminders helper

### React Patterns
- Ref sync: direct render-body assignment, not useEffect wrappers
- Stale closure: use refs to avoid re-registration of event listeners

## Active Features
- **SRM**: 6 tables, syllabus upload + AI date extraction, academic calendar, auto-generated study tasks, engagement scoring, admin tracker, parent email sharing
- **SRM showcase**: Landing page section + dedicated /srm info page + comparison table
- **Session inactivity logout**: 8hr server maxAge, 30-min idle warning, voice excluded
- **Content moderation**: content_violations table (ALTER TABLE still needed on this DB)

## Test Accounts
- `uwtester1@jiemastery.ai` through `uwtester5@jiemastery.ai` (password: UWTester2026!)
- `admin@jiemastery.ai` (password: UWAdmin2026!)

## Pending Items
- ALTER TABLE content_violations on this database
- Voice upgrades (sync with JIE Mastery): Cartesia Sonic TTS, AssemblyAI Universal-3 Pro
