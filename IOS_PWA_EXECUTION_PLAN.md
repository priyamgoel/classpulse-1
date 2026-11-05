# ClassPulse iOS 18+ PWA — Execution Plan

This is the build plan for the full student PWA. The product/architecture
rationale is in [`IOS_PWA_PLAN.md`](IOS_PWA_PLAN.md). This document is the
execution contract: what gets built, in what order, how it is verified, and what
is needed from you.

## Current progress

Implemented and passing locally:

- Foundation: server root layout, role-neutral auth, teacher/student guards,
  route-aware 401 redirects.
- PWA: manifest, icons, iOS meta tags, service worker, offline screen, install
  onboarding, update prompt, install banner.
- Student auth: login, signup, session persistence, profile, sign out.
- Classrooms: list, join by 6-character code, unenroll, classroom details.
- QR scanner: compact/long token parser, 3-frame accumulator, throttled WASM
  decoder with self-hosted `zxing_reader.wasm`, camera permission/error states,
  torch/zoom/camera-switch when supported, frame progress, diagnostics,
  200/409 submission handling.
- Attendance history: overall stats, per-classroom summaries, records, ACL,
  drill-down.
- PulseMeter: discovery, word cloud, MCQ, rating scale, duplicate handling.
- Quizzes: discovery, server-driven phases, countdown, answer submission,
  reveal states, final results, question review.
- Doubt forum: search, scope/status/sort/topic filters, create doubt, new topic,
  pseudonymity, replies, helpful marks, accept solution, edit/delete, endorsed
  badges.
- Verification: 29 web unit tests, `typecheck`, production build. The QR decoder
  was also validated in Chromium against a real QR canvas (about 100 ms decode).

Pending:

- Real-iPhone install, camera, and live 3-QR projector gate.
- End-to-end API verification with staging teacher/student accounts and live
  activities.
- Final device QA and documentation polish. Use
  [`IOS_TEST_CHECKLIST.md`](IOS_TEST_CHECKLIST.md) when the phone is available.

The temporary Chromium spike route has been removed. The scanner WASM remains as
a committed static asset for production.

## Locked scope

- **Support floor:** iOS 18+ (iPhone and iPad). Feature-detect rather than
  hard-block older devices, but do not treat them as release blockers.
- **Parity:** every student feature currently in the Flutter app.
- **Architecture:** add `/student` to the existing Next.js `web/` app.
- **Unchanged:** the instructor dashboard and the Flutter Android app.
- **Out of scope:** App Store distribution, Capacitor wrapper, push
  notifications, offline attendance, background scanning.
- **Backend:** no schema or endpoint changes expected. Only production CORS if
  the student app is ever served from a different origin.

## Parity matrix

| Android student feature | PWA surface | Backend |
|---|---|---|
| Login / signup / logout | `/student/login`, `/student/signup`, profile | `/auth/*` |
| Session persistence | localStorage + JWT expiry check | existing |
| Classroom list | `/student` | `/classrooms/mine` |
| Join by 6-char code | `/student` + `/student/join?code=` | `/classrooms/join` |
| Unenroll | classroom card menu | `DELETE /classrooms/:id/leave` |
| Classroom detail tabs | `/student/classrooms/[id]` | existing |
| 3-frame QR attendance | `/student/scan` | `/attendance/scan` |
| Attendance history + ACL | `/student/attendance` | `/attendance/me` |
| PulseMeter discovery | `/student/pulse` | `/live-activities/active` |
| Word cloud / MCQ / rating | `/student/pulse/[activityId]` | `/live-activities/:id/respond` |
| Quiz discovery | `/student/quizzes` | `/live-activities/active` |
| Live quiz play | `/student/quizzes/[activityId]` | `/live-activities/:id/quiz/*` |
| Doubt forum list/search/filter | `/student/doubts` | `/doubts`, `/search`, `/courses/:id/topics` |
| Create doubt | `/student/doubts/new` | `/doubts`, topics |
| Doubt thread + replies | `/student/doubts/[id]` | `/doubts/:id`, `/doubts/:id/replies` |
| Helpful / accept / endorse | thread actions | `/doubts/helpful`, accept-solution |
| Edit/delete own content | thread actions | `PUT/DELETE /doubts/*` |
| Profile | `/student/profile` | `/auth/me` |
| Install / offline shell | `/student/install`, SW | none |

## Working agreement

1. I implement the code, tests, docs, and CI changes. You do not need to write
   code.
2. I cannot physically install the app on an iPhone or point a phone camera at a
   projector. At each device checkpoint I will give you a short, exact checklist;
   you run it and report the result. This is the only part of the work that
   cannot be automated.
3. I will keep a clean branch (`feat/ios-pwa`) and commit per milestone. Every
   milestone ends with `npm test`, `npm run typecheck`, and `npm run build`.
4. I will not modify the Flutter app. I will not change backend contracts unless
   a real blocker appears, and I will call it out before doing so.
5. If an iOS camera/WebKit limitation blocks a flow, I will implement the best
   fallback and document it. I will not hide a failing device result.

## What I need from you

Before or during M0:

- **Device:** an iPhone on iOS 18 or newer (ideally also an iOS 26 device), plus
  a second screen/projector for the live QR stream.
- **Deployment:** either a Vercel preview deployment of this repo, or approval
  to run a local HTTPS tunnel (Cloudflare Tunnel/ngrok) for device testing.
  Camera APIs require HTTPS and a trusted certificate.
- **Test data:** a teacher account and a student account on a staging/test
  database, and permission to create a test classroom, session, PulseMeter, quiz,
  and doubts. Attendance E2E needs a live teacher session.
- **Branch:** confirmation to work on `feat/ios-pwa` rather than `main`.
- **Branding:** if there is an official ClassPulse icon, send it. Otherwise I
  will create a simple Material 3 icon in the existing `#6750A4` palette.
- **Dependencies:** approval to add one QR-decoder dependency
  (`barcode-detector` or `zxing-wasm`) and small dev dependencies for icon
  generation/tests if needed.

---

# Milestones

## M0 — Baseline and scanner spike

**Goal:** prove the highest-risk piece on a real iPhone before building the app.

### Tasks

- [ ] Run the existing baseline:
  - `backend`: `npm test`
  - `web`: `npm test`, `npm run build`
  - `mobile`: `flutter analyze --no-fatal-infos`, `flutter test`
- [ ] Create branch `feat/ios-pwa` and record the baseline results.
- [ ] Add a temporary `/student/spike` page with:
  - [ ] Minimal PWA manifest, icon, and iOS meta tags so it can be installed.
  - [ ] A "Start camera" button that calls `getUserMedia` from a user gesture.
  - [ ] `<video autoPlay playsInline muted>` preview.
  - [ ] Lazy-loaded WASM QR decoder. Evaluate `barcode-detector` (stable
        `BarcodeDetector` surface over `zxing-wasm`) first; fall back to direct
        `zxing-wasm` if the ponyfill is awkward.
  - [ ] Decode loop at ~8–12 fps with a downscaled canvas (long edge 720–960 px).
  - [ ] On-screen diagnostics: decoded text, decode time, frames/sec, errors.
- [ ] Deploy the spike (preview or HTTPS tunnel).
- [ ] Device checklist for you:
  - [ ] Open in Safari, grant camera, confirm decoding.
  - [ ] Add to Home Screen, launch standalone, grant camera, confirm decoding.
  - [ ] Close from the app switcher and relaunch; note the permission prompt and
        whether the camera recovers.
  - [ ] Point at the real 3-QR projector stream for at least 20 attempts.
  - [ ] Report: successful 3-frame captures, time per attempt, failures, iPhone
        model, iOS version.

### Gate

- At least ~95% successful 3-frame captures within 8 seconds on the target
  device(s), with no unrecoverable camera state after backgrounding/relaunch.

If the gate fails, we stop and tune before building the UI: lower decode
resolution, change decoder, add digital zoom, adjust the loop, or document the
Safari-tab fallback. We do not build the rest on an unproven scanner.

**Temporary files are deleted after the gate.**

---

## M1 — Foundation: layout, auth, role guards

**Goal:** let the instructor and student surfaces coexist without breaking
either one.

### Tasks

- [ ] Refactor `web/src/app/layout.tsx`:
  - [ ] Convert it to a server component.
  - [ ] Move `ThemeProvider`, `CssBaseline`, and `AuthProvider` into
        `web/src/app/providers.tsx` (`'use client'`).
  - [ ] Move title/description/viewport into exported `metadata`/`viewport`.
        Keep the existing font links.
- [ ] Make `AuthContext` role-neutral:
  - [ ] Restore any valid JWT user, not only teachers.
  - [ ] Keep token expiry handling and "remember me" behavior.
- [ ] Add `useRequireRole(role, redirectTo)`:
  - [ ] Wait for hydration before redirecting.
  - [ ] Teachers on `/student/*` go to `/`.
  - [ ] Students on instructor pages go to `/student`.
- [ ] Make `apiFetch` route-aware:
  - [ ] 401 on `/student/*` redirects to `/student/login`.
  - [ ] 401 elsewhere keeps `/login`.
  - [ ] Avoid redirect loops on login/signup pages.
- [ ] Update instructor surfaces:
  - [ ] `web/src/app/page.tsx` redirects a student session to `/student`.
  - [ ] `web/src/app/login/page.tsx` redirects student logins instead of
        logging them out and showing the Android-only error.
  - [ ] Add a "Student? Open the student app" link on the instructor login page.
- [ ] Add unit tests for role/redirect helpers.
- [ ] Run the baseline suite and build.

### Acceptance

- Teacher login/dashboard behavior is unchanged.
- A student session is no longer deleted by the shared auth provider.
- A student landing on `/` or `/login` is routed to `/student`.
- A teacher landing on `/student` is routed to `/`.
- No flash of protected content while auth is loading.

---

## M2 — PWA shell, install flow, service worker

**Goal:** a real installable iOS app shell with an honest install experience.

### Tasks

- [ ] Add `web/public/student/manifest.webmanifest`:
  - `id`, `name`, `short_name`, `start_url: /student`, `scope: /student`,
    `display: standalone`, `orientation: portrait`, theme/background colors,
    192/512 icons plus maskable.
- [ ] Create icons:
  - [ ] 180×180 `apple-touch-icon`
  - [ ] 192×192, 512×512, 1024×1024
  - [ ] 512×512 maskable with safe padding
  - [ ] Generate from an SVG source so they can be regenerated.
- [ ] Add `web/src/app/student/layout.tsx`:
  - [ ] `metadata` with `manifest`, `appleWebApp`, icons, title.
  - [ ] `viewport` with `viewportFit: 'cover'` and theme color.
  - [ ] Safe-area CSS and `100dvh` usage.
- [ ] Add `web/public/student/sw.js`:
  - [ ] Cache versioning and cleanup.
  - [ ] Network-first navigations with cached fallback.
  - [ ] Cache-first/stale-while-revalidate for `/_next/static` and icons.
  - [ ] Never cache cross-origin API calls or authenticated HTML responses.
  - [ ] `SKIP_WAITING` message handling.
- [ ] Add PWA provider component:
  - [ ] Register `/student/sw.js` with scope `/student/`.
  - [ ] Detect `standalone` via `display-mode` and `navigator.standalone`.
  - [ ] Detect iOS, Safari, and common in-app browsers.
  - [ ] Show an install banner only where appropriate; persist dismissal.
  - [ ] Show "update available" and refresh on confirmation.
- [ ] Add `/student/install`:
  - [ ] Numbered Share → Add to Home Screen steps.
  - [ ] iOS 26 "Open as Web App" note and iOS 18 behavior.
  - [ ] In-app-browser escape instructions ("Open in Safari").
  - [ ] Install-first warning: install before signing in.
  - [ ] Camera troubleshooting section.
- [ ] Add `/student/offline`.
- [ ] Add `web/next.config.js` headers:
  - [ ] `Cache-Control: no-cache` for the manifest and service worker.
- [ ] Tests for platform/standalone/in-app detection.
- [ ] Run tests, typecheck, build; verify manifest and SW are served.

### Acceptance

- Manifest returns the right content type; icons load.
- A fresh install opens standalone at `/student`.
- The install page is understandable without developer knowledge.
- The SW controls `/student/*`, does not break navigation, and updates cleanly.
- Offline navigation shows the offline page rather than a browser error.

**Device checkpoint A (after M1/M2):** install, launch standalone, confirm app
name/icon, sign in, relaunch and confirm session persistence.

---

## M3 — Student API layer, shell, auth pages, classrooms

**Goal:** the core student app is usable end-to-end except for scanning.

### Tasks

- [ ] Add `web/src/lib/studentTypes.ts`:
  - [ ] Types for user, classroom, live activity, PulseMeter, quiz, quiz state,
        doubt post/reply, topic, attendance summary/record.
  - [ ] Defensive parsers for numeric fields returned as strings (the Flutter
        app already does this).
- [ ] Add `web/src/lib/studentApi.ts`:
  - [ ] `login`, `signup`, `me`, `classrooms`, `joinClassroom`,
        `leaveClassroom`, `activeActivity`, `respond`, `quizAnswer`,
        `quizResults`, `attendance`, `topics`, `createTopic`, `doubts`,
        `search`, `doubt`, `createDoubt`, `updateDoubt`, `deleteDoubt`,
        `reply`, `updateReply`, `deleteReply`, `acceptSolution`,
        `toggleHelpful`.
  - [ ] Central 10s timeout and consistent error extraction.
  - [ ] No inline fetches in components.
- [ ] Add `usePolling`:
  - [ ] Pause when the document is hidden.
  - [ ] Resume and refetch on visibility.
  - [ ] In-flight guard, sequence numbers, cleanup.
- [ ] Add `StudentShell`:
  - [ ] Top bar with title, install status, avatar/profile menu.
  - [ ] Bottom navigation: Classrooms, Attendance, PulseMeter, Quizzes, Forum.
  - [ ] Profile via avatar menu (better than a cramped sixth tab).
  - [ ] Safe-area padding; max-width container for tablets/desktop.
  - [ ] Hide chrome on `/student/scan`.
- [ ] Add `/student/login` and `/student/signup`:
  - [ ] Student-only, with links to the instructor login.
  - [ ] Show install context if opened in Safari.
  - [ ] Handle rate-limit, invalid credentials, and network errors.
- [ ] Add `/student` classrooms home:
  - [ ] Cards with course/section/teacher/attendance/activity counts.
  - [ ] Join dialog with 6-character code, uppercase normalization.
  - [ ] Unenroll confirmation.
  - [ ] Pull-to-refresh equivalent (refresh button + background refetch).
  - [ ] Empty state with join CTA.
- [ ] Add `/student/classrooms/[id]` with Overview / PulseMeter / Quizzes /
      Forum tabs, filtered to that classroom.
- [ ] Add `/student/join?code=...` public landing page:
  - [ ] Show the code prominently, copy button.
  - [ ] Platform-aware install instructions.
  - [ ] Link into `/student` after install.
- [ ] Update the instructor-facing `/join` page to the same platform-aware copy.
- [ ] Tests for query building, parsers, and auth guards.
- [ ] Run tests, typecheck, build.

### Acceptance

- Student can sign up, log in, persist a session, join by code, see classrooms,
  and unenroll.
- Navigation works at 320 px width and on a tablet.
- No student route can be accessed by a teacher, and vice versa.
- A code from an instructor link can be copied and used in the installed app.

---

## M4 — QR attendance scanner

**Goal:** full parity with the Android scanner.

### Tasks

- [ ] Add `web/src/lib/qr/token.ts`:
  - [ ] Parse compact (`s,b,i,t,k,h`) and long-form tokens.
  - [ ] Normalize `session_id`, `batch_id`, `seq_idx`, `timestamp`, `token_id`,
        `hash`.
  - [ ] Reject malformed/empty tokens without throwing.
- [ ] Add `web/src/lib/qr/accumulator.ts`:
  - [ ] Buffer by `seq_idx` (0, 1, 2).
  - [ ] Reset on new `batch_id`.
  - [ ] Capture `scan_started_at` on the first frame of a batch.
  - [ ] Ignore duplicate frames.
  - [ ] Return `collecting` or `ready` with the ordered 3-token array.
- [ ] Add `web/src/lib/qr/decoder.ts`:
  - [ ] Lazy-load the WASM decoder.
  - [ ] Throttle to ~8–12 fps.
  - [ ] Downscale frames before decode.
  - [ ] Cancel cleanly when the component unmounts.
  - [ ] Expose decode timing for diagnostics.
- [ ] Add `/student/scan`:
  - [ ] Pre-permission explanation + "Start camera" button.
  - [ ] Rear camera preferred; camera switch only when supported.
  - [ ] Torch only if `getCapabilities().torch` is available.
  - [ ] Digital zoom fallback (center crop) if hardware zoom is unavailable.
  - [ ] Full-screen viewfinder, frame target, safe-area handling.
  - [ ] Frame 1/2/3 progress identical to Android.
  - [ ] Submit automatically when all three frames are collected.
  - [ ] POST `/attendance/scan` with `session_id`, ordered `tokens`, and
        `scan_started_at`.
  - [ ] Treat 200 as success; show ACL (`acl_ms`).
  - [ ] Treat 409 as "already marked present", not a hard failure.
  - [ ] Show server errors for expired/mixed batches with a clear retry.
  - [ ] Handle `NotAllowedError`, `NotFoundError`, `NotReadableError`,
        `OverconstrainedError`, and no-camera devices.
  - [ ] Keep the screen awake while scanning where supported.
  - [ ] Optional beep on frame capture; initialize audio on the Start gesture.
  - [ ] Collapsible diagnostics: decode ms, fps, frame count, last error.
- [ ] Add unit tests:
  - [ ] Out-of-order frames.
  - [ ] Duplicate frames.
  - [ ] Batch change resets.
  - [ ] Incomplete sequences.
  - [ ] Compact vs long token formats.
- [ ] Add a "Safari fallback" help panel for devices where installed-PWA camera
      fails.
- [ ] Run tests, typecheck, build.

### Gate

- On the target iPhone, scan the real projector stream and get PRESENT in at
  least 3 consecutive attempts.
- Repeat after a cold launch (permission re-prompt path).
- 409 duplicate submission behaves correctly.
- No camera leak: stopping the scanner releases all tracks.

**Device checkpoint B:** full attendance flow in Safari and installed PWA.

---

## M5 — Attendance dashboard

**Goal:** parity with `attendance_dashboard_screen.dart`.

### Tasks

- [ ] `/student/attendance`:
  - [ ] Overall attendance card (sessions, attended, percentage).
  - [ ] Per-classroom summary cards.
  - [ ] Record list with date, teacher, status, ACL.
  - [ ] Classroom drill-down showing session history.
  - [ ] Refresh, loading, empty, and error states.
  - [ ] Percent/ACL formatting helpers with tests.
- [ ] Add a link from each classroom card/detail.
- [ ] Tests for summary/record grouping and formatting.
- [ ] Run tests, typecheck, build.

### Acceptance

- Data matches the Android screen for the same student.
- Missing ACL/manual overrides render as "—" rather than `NaN`.
- Long course names and dates do not overflow on a 320 px screen.

---

## M6 — PulseMeter and live quizzes

**Goal:** full parity with the live activity flows.

### PulseMeter

- [ ] `/student/pulse`:
  - [ ] Classroom selector persisted in the URL (`?classroom=`).
  - [ ] Poll `/live-activities/active` every 4 s while visible.
  - [ ] Show only `PULSEMETER` activities.
  - [ ] Idle state with a manual "Check again" action.
- [ ] `/student/pulse/[activityId]`:
  - [ ] Word cloud input (max 35 chars).
  - [ ] MCQ option cards.
  - [ ] Rating scale with min/max labels.
  - [ ] Submit to `/live-activities/:id/respond`.
  - [ ] Treat 201 and 409 as submitted.
  - [ ] Show the submitted value and a return action.
  - [ ] Handle activity ended/replaced and expired sessions.
- [ ] Tests for response validation and submitted-state rendering.

### Quizzes

- [ ] `/student/quizzes`:
  - [ ] Classroom selector and 4 s discovery poll.
  - [ ] Show only `QUIZ` activities.
  - [ ] Active quiz card with title, question count, scoring mode.
- [ ] `/student/quizzes/[activityId]`:
  - [ ] Poll active state every 2 s; local 1 s ticker for countdown.
  - [ ] Server phases: waiting, open, answered, revealed, finished, error.
  - [ ] Sanitize: never display the correct option before `revealed`.
  - [ ] Answer submission with 201/400/409 handling.
  - [ ] Optimistic answer state plus authoritative poll reconciliation.
  - [ ] Reveal banner with correct/incorrect and awarded points.
  - [ ] Final results: score, rank, participants, correct/answered counts,
        per-question review.
  - [ ] Handle activity changed, ended, 401/403/404, and retryable errors.
- [ ] Extract quiz phase/selector logic into pure functions and test:
  - [ ] Remaining time/progress.
  - [ ] Current question lookup.
  - [ ] Answered vs revealed vs time-up.
  - [ ] Answer merge behavior.
- [ ] Run tests, typecheck, build.

### Acceptance

- PulseMeter and quiz behavior matches Android on the same activity.
- A quiz can be answered, revealed, and completed with correct final results.
- Backgrounding the app pauses polling; returning refreshes state.
- No correct answer leaks in the network-independent UI before reveal.

**Device checkpoint C:** live PulseMeter and quiz on iPhone.

---

## M7 — Doubt forum

**Goal:** parity with the forum, including pseudonymity and moderation-facing
states.

### Tasks

- [ ] `/student/doubts`:
  - [ ] Classroom selector.
  - [ ] Search with debounce; use `/search?q=...` when searching, `/doubts`
        otherwise.
  - [ ] Scope chips: All, Section, Course-Wide, Global.
  - [ ] Topic filter.
  - [ ] Status filter (open/resolved) and sort (recent/helpful) where supported.
  - [ ] Post cards: status, scope, topic, author/pseudonym, preview, helpful,
        reply count.
  - [ ] Helpful toggle on posts.
  - [ ] Empty and error states.
- [ ] `/student/doubts/new`:
  - [ ] Title, body, audience scope, topic, new-topic creation, pseudonym switch.
  - [ ] Validate lengths and required fields.
  - [ ] Create topic first if a new one is entered.
  - [ ] Return to the list on success.
- [ ] `/student/doubts/[id]`:
  - [ ] Post card with author/pseudonym, scope, topic, helpful.
  - [ ] Replies ordered by accepted/endorsed/helpful as returned by the API.
  - [ ] Reply composer with pseudonym switch.
  - [ ] Helpful on replies.
  - [ ] Accept/unaccept solution (post author only).
  - [ ] Teacher endorsement badge display.
  - [ ] Edit/delete own post; edit/delete own reply.
  - [ ] Refresh.
- [ ] Add query-builder and permission tests:
  - [ ] Search vs list query construction.
  - [ ] Scope/topic/status params.
  - [ ] `canManagePost` / `canManageReply` rules.
- [ ] Run tests, typecheck, build.

### Acceptance

- Students can ask, reply, mark helpful, accept a solution, edit, and delete.
- Anonymous content never exposes a real name to another student.
- Teacher-endorsed replies are visibly distinct.
- Search and filters return the same content as Android.

**Device checkpoint D:** browse, post, reply, accept on iPhone.

---

## M8 — Profile, polish, accessibility, offline/update

**Goal:** make it feel like a finished app rather than a set of pages.

### Tasks

- [ ] `/student/profile`:
  - [ ] Name, email, role, app version, light-mode note.
  - [ ] Install status / "Install this app" link.
  - [ ] Support/troubleshooting link.
  - [ ] Sign out.
  - [ ] Refresh user via `/auth/me` if needed.
- [ ] Add `ErrorBoundary` for student routes.
- [ ] Add consistent loading skeletons, empty states, and retry actions.
- [ ] Accessibility:
  - [ ] Labels on icon buttons and form controls.
  - [ ] Visible focus rings.
  - [ ] Minimum 44 px touch targets.
  - [ ] Reduced-motion handling.
  - [ ] Do not globally disable pinch zoom; disable double-tap zoom only inside
        the scanner.
- [ ] iOS layout polish:
  - [ ] Notch/Dynamic Island and home-indicator safe areas.
  - [ ] `100dvh`, no content under the bottom bar.
  - [ ] Keyboard does not cover the reply composer or login button.
  - [ ] Standalone status bar and theme color.
- [ ] Performance:
  - [ ] Lazy-load the scanner and WASM.
  - [ ] Check `/student` first-load JS in `next build`.
  - [ ] Avoid importing instructor components into student routes.
- [ ] Offline/update:
  - [ ] Verify cached shell and offline page.
  - [ ] Verify the update prompt and one-click refresh.
- [ ] Run tests, typecheck, build.

### Acceptance

- No horizontal scroll at 320 px.
- No focus/keyboard traps on iOS.
- Student bundle does not include instructor-only pages.
- An installed app can update without clearing site data.

---

## M9 — Full QA, CI, docs, release

**Goal:** ship it.

### Tasks

- [ ] Add a `typecheck` script to `web/package.json` and run it in CI.
- [ ] Add the student routes to the CI build check.
- [ ] Add `IOS_TEST_CHECKLIST.md` with the exact device scenarios.
- [ ] Update `README.md`:
  - [ ] Student PWA section and dev commands.
  - [ ] Install instructions.
  - [ ] Support matrix (iOS 18+).
- [ ] Update `DEPLOYMENT_GUIDE.md`:
  - [ ] HTTPS requirement.
  - [ ] `CORS_ORIGINS` if a separate origin is used.
  - [ ] Manifest/SW cache headers.
  - [ ] iOS install and troubleshooting notes.
- [ ] Run the full suite:
  - [ ] Backend tests.
  - [ ] Web tests + typecheck + production build.
  - [ ] Mobile analyze/tests (unchanged, regression check).
- [ ] Deploy a preview and run:
  - [ ] Instructor dashboard smoke test.
  - [ ] Android app smoke test against the same backend.
  - [ ] Full iOS checklist in Safari and installed PWA.
- [ ] Fix all parity gaps found in QA.
- [ ] Pilot with one section; collect scan success/time and any camera errors.
- [ ] Promote to production.
- [ ] Remove temporary spike code and stale feature flags.

### Acceptance

- All items in the parity matrix work on iOS 18+.
- No instructor or Android regressions.
- CI is green.
- Docs and install guide are published.
- Rollback is trivial: the PWA is additive; no backend schema changes.

---

# Suggested commit sequence

Use one commit per logical unit so a regression is easy to bisect:

1. `refactor(web): split root layout into server layout and client providers`
2. `feat(auth): allow student sessions and add role-aware redirects`
3. `feat(student): add student shell, login, signup, and profile`
4. `feat(student): add classroom list, join, and unenroll`
5. `feat(pwa): add manifest, icons, service worker, and install guide`
6. `feat(student): add QR token parsing and frame accumulator`
7. `feat(student): add multi-frame QR scanner`
8. `feat(student): add attendance dashboard`
9. `feat(student): add PulseMeter and live quiz flows`
10. `feat(student): add doubt forum`
11. `test(student): cover scanner, quiz state, and auth guards`
12. `docs: add iOS PWA setup, support matrix, and test checklist`
13. `ci(web): add typecheck and student build verification`

# Risk gates

| Gate | When | Pass condition | If it fails |
|---|---|---|---|
| G0 | After M0 | Camera + WASM decode the real 3-QR stream reliably | Tune decoder/resolution; test Safari fallback; do not proceed blindly |
| G1 | After M4 | 3 consecutive successful attendance scans on device | Fix scanner UX/timing before live features |
| G2 | After M6 | PulseMeter and quiz parity on device | Isolate server-response mismatches; fix before forum |
| G3 | After M9 | Full parity + no instructor/Android regressions | Hold release; fix blockers |

# Definition of done

- A student can install the PWA from Safari on iOS 18+, launch it standalone,
  sign in, and stay signed in across launches.
- The student can join a classroom, scan the 3-frame QR stream, and see the
  attendance record and ACL.
- The student can use PulseMeter, live quizzes, and the full doubt forum with
  the same outcomes as the Android app.
- Camera permission denial and re-prompting have clear recovery paths.
- The app works at phone widths, respects safe areas, and has no obvious
  accessibility blockers.
- The instructor dashboard and Android app are unchanged.
- Tests, typecheck, production build, and CI are green.
- Install guide, support matrix, troubleshooting, and test checklist are
  published.

# First action

Once you confirm the branch and provide (or confirm) the device/deployment/test
account inputs above, I start with M0: baseline verification, branch creation,
and the scanner spike. I will report the baseline results and the exact device
checklist before moving to M1.
