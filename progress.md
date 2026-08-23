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

## Overall Build Status — Iteration 1 (100% Completed)

| Part | Name | Status | Git Commit | Key Artifacts / Features Built |
| --- | --- | --- | --- | --- |
| **Part 1** | Project Scaffold + Core UI Shell | **COMPLETED** | `43c5887` | Monorepo layout (`backend/`, `web/`, `mobile/`), Express `/health` API, M3 Design System Tokens, Web & Flutter UI shells with disabled future tabs (`PulseMeter*`, `Quizzes*`, `Forum*`). |
| **Part 2** | Auth & Roles | **COMPLETED** | `1f3cb99`, `9d0a015` | Neon PostgreSQL tables (`users`, `courses`, `classrooms`, `enrollments`, `sessions`, `attendance_records`), bcrypt password hashing, signed JWT auth API (`/auth/signup`, `/auth/login`, `/auth/me`), Instructor-only Web dashboard restriction (`9d0a015`), Mobile Flutter Light-Mode login/signup screens. |
| **Part 3** | Classroom Management & Join Flow | **COMPLETED** | `4b60326` | `GET /courses`, `POST /classrooms`, `POST /classrooms/:id/regenerate-join`, `POST /classrooms/join`, `GET /classrooms/mine`, `GET /classrooms/:id/roster` REST endpoints; Web: `CreateClassroomDialog`, `ClassroomJoinDetailsModal` (join code + copyable link + code regeneration), `ClassroomRosterDialog`; Mobile: `ClassroomService`, `JoinClassroomDialog` widget; Live classroom grid on Instructor Dashboard. |
| **Part 4** | Attendance Session Engine | **COMPLETED** | `1293fe9` | Upstash Redis connection & cache management, HMAC-SHA256 3-QR token generator with short-lived batches (15s TTL), `POST /sessions` (start), `POST /sessions/:id/end` (end), `GET /sessions/:id/active-tokens`, `POST /attendance/scan` (enforces order `[0,1,2]`, HMAC signature, $\le 10\text{s}$ freshness, enrollment, duplicate check, and logs ACL latency), `GET /attendance/session/:id`, `GET /attendance/me`, and Socket.io server integration. |
| **Part 5** | QR Display (Web) + Scanner (Flutter) | **COMPLETED** | `4390a80` | Live Web 3-QR rotating projector (`LiveSessionModal.tsx`) with Socket.io real-time roster feed and ACL chips; Flutter multi-frame camera scanner (`QrScannerScreen.dart`) with 3-frame sequence buffer and instant Attendance Capture Latency display. |
| **Part 6** | Homepages & Dashboards | **COMPLETED** | `5959c99` | Teacher analytics dashboard (`AttendanceAnalyticsView.tsx`) with 4 top metrics, student attendance performance table, student drill-down modal, past sessions timeline, and future-proof card grid (`PulseMeter*`, `Quizzes*`, `Forum*`); Student mobile attendance dashboard (`attendance_dashboard_screen.dart`) with overall percentage card, per-subject breakdown, and interactive session history drill-downs. |
| **Part 7** | CI/CD & Distribution | **COMPLETED** | `10682c8` | GitHub Actions multi-job pipeline (`.github/workflows/ci.yml`) for automated backend, web, and mobile testing & APK generation; Android camera & internet permissions; and comprehensive [`DEPLOYMENT_GUIDE.md`](file:///C:/Users/priya/OneDrive/Documents/priyam-goel/5th-sem/ucs503_SE/classpulse-1/DEPLOYMENT_GUIDE.md). |
| **Enhancements** | Lifecycle Management | **COMPLETED** | `b35c404` | Teacher classroom deletion (end of semester cascade delete) with M3 red confirmation dialog (`DELETE /classrooms/:id`); Student unenrollment on mobile via long-press bottom sheet (`DELETE /classrooms/:id/leave`). |
| **Enhancements** | Projector Distance Scanning | **COMPLETED** | `1520387`, `df18324`, `2a2c114` | Edge-to-edge maximized QR code (`calc(100vh - 32px)`) in Fullscreen Projector mode with zero wasted top/bottom margins; Flutter mobile scanner with `[1x, 2x, 5x, 10x, 15x, 20x]` zoom buttons for far-distance scanning. |

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

### Action 6: QR Display (Web) & Scanner (Flutter) (Part 5) — Commit `4390a80`
- **Web Projector Component (`web/src/components/LiveSessionModal.tsx`)**:
  - Fullscreen/modal projector displaying high-definition SVG rotating QR stream (`qrcode.react`) switching every 800ms across indices `[0, 1, 2]`.
  - Connected to Socket.io `session_${sessionId}` room; automatically appends newly validated students to the live roster feed in real-time without refreshing.
  - Displays student name, email, and live Attendance Capture Latency chip (`⚡ ACL: 413ms`).
  - Added "Start Attendance Session" trigger button on Instructor Dashboard.
- **Mobile Multi-Frame Scanner (`mobile/lib/screens/qr_scanner_screen.dart`)**:
  - Built camera scanner using `mobile_scanner` with viewfinder target HUD.
  - Implemented multi-frame buffer accumulating tokens `[0, 1, 2]` for the active batch.
  - Recorded `scan_started_at` timestamp on first detected frame and submitted sequence to `POST /attendance/scan`.
  - Displayed M3 success dialog with `PRESENT` status and Attendance Capture Latency metric (`ACL: XXXms`).
  - Added "Scan Attendance QR" fast-action card on student home screen.
- **Verification**: End-to-end Socket.io event delivery verified; Web build passed (`npm run build` compiled 6 static pages); Flutter analyze & tests passed with 0 issues.

### Action 7: Homepages & Dashboards (Part 6) — Commit `5959c99`
- **Backend Analytics Endpoints (`backend/src/routes/attendance.js`)**:
  - `GET /attendance/classroom/:id/summary`: Returns section stats (total sessions, enrolled headcount, avg attendance %, avg ACL ms), past sessions log, and per-student performance.
  - `GET /attendance/classroom/:id/student/:studentId`: Returns student-specific session attendance history and timestamps.
  - `GET /attendance/me`: Returns student's overall attendance rate and per-course attendance records.
- **Web Analytics & Drill-Downs (`web/src/components/AttendanceAnalyticsView.tsx`, `web/src/app/page.tsx`)**:
  - 4 Metric Cards: Class Attendance %, Sessions Conducted, Enrolled Count, Avg Capture Latency.
  - Student Attendance Table with progress bars and "View Log" drilldown modal.
  - Past Sessions Timeline table with headcount and ACL latency metrics.
  - Future Feature Hooks Card Grid: M3 cards for `PulseMeter*`, `Quizzes*`, `Forum*` with "Coming soon in Iteration 2" badges.
- **Mobile Student Attendance Dashboard (`mobile/lib/screens/attendance_dashboard_screen.dart`, `mobile/lib/main.dart`)**:
  - Overall attendance progress card with percentage and total sessions count.
  - Enrolled subjects breakdown cards with individual attendance rate progress bars.
  - Interactive bottom sheet drill-down showing chronological session history with ACL capture latencies.
  - Stateful tab switching in `AppShell` connecting `[Classrooms]`, `[Attendance]`, and `[Profile]`.
- **Verification**: API responses tested; Web Next.js build compiled successfully (`npm run build`); Flutter analyze & test passed with 0 errors.

### Action 8: CI/CD & Distribution (Part 7) — Commit `10682c8`
- **GitHub Actions Multi-Job Pipeline (`.github/workflows/ci.yml`)**:
  - Automated CI workflow executing on every push to `main`: `backend-ci` (Node 20), `web-ci` (Next.js production build), and `mobile-ci` (Java 17, Flutter 3.x, analyze, test, and debug APK build).
- **Android Permissions & Configuration**: Configured `INTERNET`, `CAMERA`, and autofocus hardware features in `mobile/android/app/src/main/AndroidManifest.xml` with app label `ClassPulse`.
- **Deployment Documentation (`DEPLOYMENT_GUIDE.md`)**: Comprehensive instructions covering local running, Render backend hosting, Vercel web hosting, and Firebase App Distribution for pilot Android APK rollouts.

---

## Instructions for Next AI Session / Handover

When resuming this project in a new AI assistant session or account:

1. Read `progress.md`, [`prompt.md`](file:///C:/Users/priya/OneDrive/Documents/priyam-goel/5th-sem/ucs503_SE/classpulse-1/prompt.md), [`technical_specification.md`](file:///C:/Users/priya/OneDrive/Documents/priyam-goel/5th-sem/ucs503_SE/classpulse-1/technical_specification.md), [`appearance_mode.md`](file:///C:/Users/priya/OneDrive/Documents/priyam-goel/5th-sem/ucs503_SE/classpulse-1/appearance_mode.md), and [`DEPLOYMENT_GUIDE.md`](file:///C:/Users/priya/OneDrive/Documents/priyam-goel/5th-sem/ucs503_SE/classpulse-1/DEPLOYMENT_GUIDE.md).
2. **Iteration 1 is 100% built, verified, and committed.**
3. To test or demonstrate:
   - Backend: `cd backend && npm run dev`
   - Web: `cd web && npm run dev`
   - Mobile: `cd mobile && flutter run`
4. If the user asks to deploy to cloud, follow the step-by-step instructions in `DEPLOYMENT_GUIDE.md` for Render, Vercel, and Firebase App Distribution.
5. If the user asks to start Iteration 2, refer to Section 7 of `technical_specification.md` (`PulseMeter`, `Live Quizzing`, `Doubt Forum`).
