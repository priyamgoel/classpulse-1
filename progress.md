# ClassPulse — Development Progress & Handover State

> **Purpose**: This document tracks the exact implementation progress, completed build steps, architectural decisions, and remaining tasks for ClassPulse. It serves as a single source of truth for seamless continuation of work across AI coding assistants, account switches, or quota resets.

---

## Source Specifications & Governing Rules

This project is built strictly according to the following 3 core specification files located in the repository root:

1. **[`prompt.md`](file:///C:/Users/priya/OneDrive/Documents/priyam-goel/5th-sem/ucs503_SE/classpulse-1/prompt.md)**
   - Defines the 7-part strict sequential build process, working rules, tech stack choices, and definition of done for Iteration 1.
2. **[`technical_specification.md`](file:///C:/Users/priya/OneDrive/Documents/priyam-goel/5th-sem/ucs503_SE/classpulse-1/technical_specification.md)**
   - Source of truth for architecture, database schema, REST API endpoints, Socket.io events, design system guidelines, and future feature hooks.
3. **[`appearance_mode.md`](file:///C:/Users/priya/OneDrive/Documents/priyam-goel/5th-sem/ucs503_SE/classpulse-1/appearance_mode.md)**
   - **STRICT RULE**: The entire website (MUI) and mobile app (Flutter) must be designed to be used in **LIGHT MODE ONLY**. No dark theme, mode toggle, or dark-mode media query handling is allowed (not even stubbed).

---

## Overall Build Status

| Part | Name | Status | Git Commit | Key Artifacts / Features Built |
| --- | --- | --- | --- | --- |
| **Part 1** | Project Scaffold + Core UI Shell | **COMPLETED** | `43c5887` | Monorepo layout (`backend/`, `web/`, `mobile/`), Express `/health` API, M3 Design System Tokens, Web & Flutter UI shells with disabled future tabs (`PulseMeter*`, `Quizzes*`, `Forum*`). |
| **Part 2** | Auth & Roles | **COMPLETED** | `1f3cb99`, `9d0a015` | Neon PostgreSQL tables (`users`, `courses`, `classrooms`, `enrollments`, `sessions`, `attendance_records`), bcrypt password hashing, signed JWT auth API (`/auth/signup`, `/auth/login`, `/auth/me`), Instructor-only Web dashboard restriction (`9d0a015`), Mobile Flutter Light-Mode login/signup screens. |
| **Part 3** | Classroom Management & Join Flow | **IN PLANNING / READY TO BUILD** | — | Teacher classroom CRUD, course list, join code/link/QR generator; Student join flow (code, link, QR scan). |
| **Part 4** | Attendance Session Engine | PENDING | — | Session start/stop, 3-QR token generator (HMAC), Redis token validation, ACL logging. |
| **Part 5** | QR Display (Web) + Scanner (Flutter) | PENDING | — | Socket.io 3-QR rotation stream, Flutter ML Kit multi-frame camera decoder, live attendance marking. |
| **Part 6** | Homepages & Dashboards | PENDING | — | Attendance summary dashboards & student/teacher drill-down views using future-proof card grids. |
| **Part 7** | CI/CD & Distribution | PENDING | — | GitHub Actions, Render & Vercel deployment, Firebase App Distribution signed APK pipeline. |

---

## Detailed Log of Completed Actions

### Action 1: Environment & Repository Initialization (Part 1)
- **Git Repo**: Cloned empty GitHub repository `https://github.com/priyamgoel/classpulse-1.git` locally.
- **Monorepo Layout**: Created `backend/`, `web/`, `mobile/`, `README.md`, and `.gitignore`.
- **Backend Setup**: Scaffolded Express server on port 4000 with GET `/health` endpoint returning server status & timestamp.
- **Shared Material 3 System**: Defined canonical M3 design tokens (`#6750A4` seed color) in `web/src/theme/tokens.ts` and `mobile/lib/theme/tokens.dart`.
- **UI Shells**: Built mirrored navigation bars across Web (Next.js + MUI) and Mobile (Flutter) with disabled tabs (`PulseMeter*`, `Quizzes*`, `Forum*`) displaying "Coming soon" badges.
- **Verification**: `curl http://localhost:4000/health` (200 OK), `npm run build` in `web/` (0 errors), `flutter analyze && flutter test` in `mobile/` (0 errors).

### Action 2: Cloud Database Setup & Credentials Gathering
- **Neon (PostgreSQL)**: Connected to Neon Postgres database instance via `DATABASE_URL` in `backend/.env`.
- **Upstash (Redis)**: Configured Upstash Redis connection via `REDIS_URL` in `backend/.env`.

### Action 3: Database Migration & Authentication System (Part 2)
- **Database Schema**: Created automated initialization script (`backend/src/db/index.js`) executing `backend/src/db/schema.sql` on startup. Created tables `users`, `courses`, `classrooms`, `enrollments`, `sessions`, `attendance_records` and pre-seeded course catalog.
- **Backend Auth Controller**: Created `backend/src/routes/auth.js` with `POST /auth/signup`, `POST /auth/login`, and `GET /auth/me`. Passwords hashed with `bcryptjs`, 7-day JWT tokens issued using `jsonwebtoken`.
- **Auth Middleware**: Created `backend/src/middleware/auth.js` enforcing token verification and role restrictions (`teacher` vs `student`).
- **Web App Scope Adjustment (Teacher-Only)**: Updated `web/src/app/login/page.tsx` and `web/src/app/signup/page.tsx` so Web Dashboard exclusively registers and logs in Instructor/Teacher accounts (`9d0a015`). Student accounts attempting Web login receive a friendly M3 Alert directing them to the Android mobile app.
- **Mobile App Auth**: Built `mobile/lib/services/auth_service.dart`, Light Mode `LoginScreen`, Light Mode `SignupScreen` with Role segmented button, and stateful app routing.
- **UI Polish**: Fixed `ClassroomCard` hover outline distortion by moving selection border directly into `Card` styling with `overflow: hidden` and smooth 0.15s border color transition (`88dce29`).
- **Verification**: Tested signup/login for both Teacher and Student roles, verified `/auth/me` protected endpoint and 401 Unauthorized rejection. Web build and Flutter analysis passed cleanly.

---

## Instructions for Next AI Session / Handover

When resuming this project in a new AI assistant session or account:

1. Read `progress.md`, [`prompt.md`](file:///C:/Users/priya/OneDrive/Documents/priyam-goel/5th-sem/ucs503_SE/classpulse-1/prompt.md), [`technical_specification.md`](file:///C:/Users/priya/OneDrive/Documents/priyam-goel/5th-sem/ucs503_SE/classpulse-1/technical_specification.md), and [`appearance_mode.md`](file:///C:/Users/priya/OneDrive/Documents/priyam-goel/5th-sem/ucs503_SE/classpulse-1/appearance_mode.md).
2. Note that **Part 1** and **Part 2** are fully complete, verified, and committed.
3. Begin directly with **Part 3 — Classroom Management & Join Flow**:
   - Create implementation plan for Part 3.
   - Restate goals and assumptions in 2-3 sentences.
   - Wait for user approval before writing code.
   - Keep Light Mode Only rule active across all UI work.
   - Update `progress.md` after completing Part 3.
