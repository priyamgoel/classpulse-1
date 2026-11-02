# ClassPulse — Real-Time Classroom Engagement Platform

ClassPulse is a classroom engagement platform with anti-proxy QR attendance, live
PulseMeter polls, live quizzes, a structured doubt forum, attendance analytics, and
instructor moderation tools.

Current implementation:

- **QR attendance** — instructors project a rotating stream of three HMAC-signed QR
  tokens; the mobile app scans all three frames to record attendance.
- **PulseMeter** — live word-cloud, MCQ, and rating-scale activities with real-time
  student responses.
- **Live quizzes** — instructor-authored multiple-choice quizzes with live results and
  WIDE/NARROW scoring modes.
- **Doubt forum** — pseudonymous classroom, course-wide, and app-wide doubt threads with
  replies, accepted solutions, helpful votes, and instructor endorsement.
- **Analytics** — section-level attendance summaries, per-student drill-downs, and live
  activity results.
- **Moderation** — profanity filtering, muted word-cloud terms, and instructor-only
  author reveal for pseudonymous forum posts.

## Project Structure

```
classpulse-1/
├── backend/    # Node.js + Express REST & Socket.io API
├── web/        # Next.js + MUI instructor dashboard
└── mobile/     # Flutter Android student app
```

## Prerequisites

- **Node.js 20+** and npm (backend and web)
- **PostgreSQL** (local or [Neon](https://neon.tech))
- **Redis** (local or [Upstash](https://upstash.com)); optional, but required for
  multi-instance deployments
- **Flutter 3.29+** (Dart 3.7+) and the Android toolchain for the mobile app

## Backend Setup

```bash
cd backend
cp .env.example .env
npm ci
npm test
npm run dev
```

`backend/.env.example` documents the core variables. The server refuses to start
without these required values:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — secret used to sign auth tokens
- `QR_HMAC_SECRET` — secret used to sign QR attendance tokens

Also set `REDIS_URL` for shared token storage (the backend falls back to per-instance
memory if Redis is unavailable). Set `CORS_ORIGINS` to the web origin(s) allowed to call
the API; it defaults to `http://localhost:3000`. See
[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for the full variable reference.

- API: `http://localhost:4000`
- Health check: `http://localhost:4000/health` (`200 ok` / `503 degraded`)
- WebSocket: `ws://localhost:4000` (Socket.io)

## Web Setup

The web app is the instructor dashboard.

```bash
cd web
cp .env.example .env.local
npm ci
npm run dev
```

Set `NEXT_PUBLIC_API_URL` to the backend origin (for example
`http://localhost:4000`). In production it must be the deployed API origin, and that
origin must also be listed in the backend's `CORS_ORIGINS`.

Build the production bundle with:

```bash
npm run build
```

The dashboard runs at `http://localhost:3000`.

## Mobile Setup

The mobile app is the student app for Android.

```bash
cd mobile
flutter pub get
flutter test
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000
```

`API_BASE_URL` defaults to the deployed API when omitted. Use `http://10.0.2.2:4000`
from the Android emulator, or your machine's LAN address for a physical device.

Build a release APK with:

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://your-api.example.com
```

## Roles

- **Web is instructor-only.** Teachers create and manage sections, sessions, activities,
  quizzes, analytics, and forum moderation. Teacher accounts are created on the web
  signup page; when `TEACHER_INVITE_CODE` is configured, signup requires that code. In
  production, teacher signup is closed if no invite code is configured.
- **Mobile is student-only.** Students join sections with a 6-character code, scan QR
  attendance streams, answer live activities and quizzes, and participate in the forum.
- Student accounts are created in the mobile app; teacher accounts are created on the web.

## Testing

Run each suite from its app directory:

```bash
# Backend — Node.js test runner
cd backend
npm test

# Web — unit tests and production build
cd web
npm test
npm run build

# Mobile — static analysis and tests
cd mobile
flutter analyze --no-fatal-infos
flutter test
```

Backend tests use mocked PostgreSQL and Redis helpers, so they do not require live
database or Redis services. Web tests run with Vitest and jsdom.

The GitHub Actions workflow in [.github/workflows/ci.yml](.github/workflows/ci.yml) runs
the backend syntax check and tests, the web tests and production build, and the mobile
analyze, test, and APK build.

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for local end-to-end testing and cloud
deployment steps.
