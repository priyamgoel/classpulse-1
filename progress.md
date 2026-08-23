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
| **Part 3** | Classroom Management & Join Flow | **COMPLETED** | `4b60326` | `GET /courses`, `POST /classrooms`, `POST /classrooms/:id/regenerate-join`, `POST /classrooms/join`, `GET /classrooms/mine`, `GET /classrooms/:id/roster` REST endpoints; Web: `CreateClassroomDialog`, `ClassroomJoinDetailsModal` (join code + copyable link + code regeneration), `ClassroomRosterDialog`; Mobile: `ClassroomService`, `JoinClassroomDialog` widget; Live classroom grid on Instructor Dashboard. |
| **Part 4** | Attendance Session Engine | **COMPLETED** | `1293fe9` | Upstash Redis connection & cache management, HMAC-SHA256 3-QR token generator with short-lived batches (15s TTL), `POST /sessions` (start), `POST /sessions/:id/end` (end), `GET /sessions/:id/active-tokens`, `POST /attendance/scan` (enforces order `[0,1,2]`, HMAC signature, $\le 10\text{s}$ freshness, enrollment, duplicate check, and logs ACL latency), `GET /attendance/session/:id`, `GET /attendance/me`, and Socket.io server integration. |
| **Part 5** | QR Display (Web) + Scanner (Flutter) | PENDING | — | Live Web 3-QR rotating projector via Socket.io stream, Flutter camera multi-frame ML Kit decoder, end-to-end device scan testing. |
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

### Action 4: Classroom Management & Join Flow (Part 3) — Commit `4b60326`
- **Backend Routes**: `GET /courses`, `POST /classrooms`, `POST /classrooms/:id/regenerate-join`, `POST /classrooms/join`, `GET /classrooms/mine`, `GET /classrooms/:id/roster`.
- **Web Components**: `CreateClassroomDialog.tsx`, `ClassroomJoinDetailsModal.tsx`, `ClassroomRosterDialog.tsx`, and live Instructor Dashboard grid.
- **Mobile Components**: `ClassroomService`, `JoinClassroomDialog` (6-char code input), and live enrolled classroom view.
- **Verification**: All API endpoints tested; web & mobile builds passed with 0 errors.

### Action 5: Attendance Session Engine (Part 4) — Commit `1293fe9`
- **Redis Client (`backend/src/redis/index.js`)**: Connected to Upstash Redis with auto-reconnection and in-memory fallback.
- **Cryptographic Anti-Proxy Service (`backend/src/services/qrTokenService.js`)**:
  - Generated HMAC-SHA256 signed 3-QR token batches (`seq_idx: 0, 1, 2`) with 15-second TTL in Redis.
  - Built validation pipeline enforcing sequence ordering, signature authenticity, freshness window ($\le 10\text{s}$), active Redis batch lookup, classroom enrollment, and duplicate check.
  - Logged `scan_started_at` vs `validated_at` in PostgreSQL and computed Attendance Capture Latency (`acl_ms`).
- **Session & Attendance REST Routes (`backend/src/routes/sessions.js`, `backend/src/routes/attendance.js`)**:
  - `POST /sessions` (teacher starts session).
  - `POST /sessions/:id/end` (teacher ends session).
  - `GET /sessions/:id/active-tokens` (generates current rotating 3-QR token batch).
  - `POST /attendance/scan` (student submits scan with ACL calculation and broadcasts `attendance:marked` via Socket.io).
  - `GET /attendance/session/:id` (teacher views live attendance roster).
  - `GET /attendance/me` (student views personal attendance summary).
- **Socket.io Layer**: Configured WebSocket server on Express with session room management (`join_session`, `leave_session`).
- **Verification**: Executed automated verification suite testing: session start, token generation, valid scan with ACL calculation (353ms), duplicate scan rejection (409 Conflict), out-of-order sequence rejection (400 Bad Request), expired token rejection (400 Bad Request), tampered signature rejection (400 Bad Request), live roster retrieval, and session termination.

---

## Instructions for Next AI Session / Handover

When resuming this project in a new AI assistant session or account:

1. Read `progress.md`, [`prompt.md`](file:///C:/Users/priya/OneDrive/Documents/priyam-goel/5th-sem/ucs503_SE/classpulse-1/prompt.md), [`technical_specification.md`](file:///C:/Users/priya/OneDrive/Documents/priyam-goel/5th-sem/ucs503_SE/classpulse-1/technical_specification.md), and [`appearance_mode.md`](file:///C:/Users/priya/OneDrive/Documents/priyam-goel/5th-sem/ucs503_SE/classpulse-1/appearance_mode.md).
2. **Parts 1, 2, 3, and 4 are fully complete, verified, and committed.**
3. Before **Part 5 — QR Display (Web) + Scanner (Flutter)**:
   - Note the **Account & Credential Checkpoint** for Render & Vercel deployment before device testing, or proceed with local/emulator verification per user instructions.
   - Build Web live rotating 3-QR stream projector using Socket.io (`qr:rotate`).
   - Build Flutter multi-frame camera scanner using ML Kit.
   - Keep **Light Mode Only** strictly enforced across all UI components.
