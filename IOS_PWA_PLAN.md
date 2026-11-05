# ClassPulse Student PWA on iOS — Implementation Plan

## 1. Short answer

Yes. You can ship a student-facing Progressive Web App (PWA) that iPhone users
install from Safari via **Share → Add to Home Screen**. It does **not** go through
the App Store and does **not** require an Apple Developer account or a Mac.

The realistic approach is:

- Keep the Flutter Android app exactly as it is.
- Add a mobile-first student web app under the existing Next.js `web/` app at
  `/student`.
- Install it as a PWA on iOS, Android, and desktop Chrome.
- Reuse the existing backend, JWT auth, REST endpoints, and QR attendance logic.

The one feature that needs a real-device proof-of-concept before building the
rest is the **multi-frame QR attendance scanner**. iOS Safari does not support
the native `BarcodeDetector` API, so the scanner must use a WebAssembly QR
decoder, and camera behaviour inside an installed iOS web app has some known
WebKit quirks. Everything else is ordinary responsive web work.

### Locked decisions

- **Support floor:** iOS 18+. Devices below iOS 18 are not a release blocker. We
  will use feature detection rather than hard-blocking them, but the official
  support matrix starts at iOS 18.
- **Scope:** full student parity with the Android app, not an attendance-only
  MVP.
- **Architecture:** extend the existing Next.js `web/` app at `/student`; keep
  the instructor dashboard and the Flutter Android app unchanged.
- **Push notifications:** out of scope for v1 because the Android app does not
  have them either. Feature parity does not require push.
- **Offline:** app-shell/offline-message support only. QR attendance and live
  activities remain online-only, same as Android.
- **Distribution:** Home Screen PWA only. No App Store, no Apple Developer
  account, no Capacitor wrapper in v1.

The execution sequence, per-milestone tasks, and device checkpoints are in
[`IOS_PWA_EXECUTION_PLAN.md`](IOS_PWA_EXECUTION_PLAN.md).

---

## 2. What iOS actually supports in 2026

| Capability | iOS Home Screen web app | Notes / impact |
|---|---|---|
| Installation | Yes, manual: Share → Add to Home Screen | No `beforeinstallprompt`, no install API, no automatic prompt. |
| App Store distribution | No | PWA is a Home Screen app, not a store app. |
| Standalone window | Yes | Since iOS 26, every added site opens as a web app by default. iOS 16.4–18 needs `display: standalone` or `apple-mobile-web-app-capable`. |
| Camera (`getUserMedia`) | Yes, over HTTPS and from a user gesture | Works in installed apps. Known WebKit bug: camera permission is re-prompted on every cold launch in Home Screen apps (WebKit #327237). |
| Native `BarcodeDetector` | No / disabled behind a non-functional flag | Do not use it. Use `zxing-wasm` or the `barcode-detector` polyfill. |
| Service worker / Cache API | Yes | iOS does not require a service worker to install, but we need one for offline shell, fast startup, and Android installability. |
| Web Push | Yes, installed only, iOS 16.4+ | Requires a user gesture and a push service. Optional, not needed for v1. |
| Background sync / background camera | No | The app must be open to scan or receive live updates. |
| Storage | Separate container from Safari; exempt from Safari's 7-day eviction when installed | Installing after signing in in Safari will produce a fresh login screen. Plan the onboarding around this. |
| Deep links into installed PWA | Unreliable | A link sent in WhatsApp will usually open in Safari or an in-app browser, not the installed PWA. Use a join code plus copy/paste. |

Sources of truth for the implementation phase: Apple/WebKit release notes, MDN
compatibility tables, and the WebKit bug tracker. Re-check camera behaviour on
the actual target iPhones before release.

---

## 3. Current repo gap

What already exists and can be reused:

- `backend/` — all student endpoints already exist because the Flutter app uses
  them: `/auth/*`, `/classrooms/*`, `/attendance/scan`, `/attendance/me`,
  `/live-activities/*`, `/quizzes/*`, `/doubts/*`, `/courses/:id/topics`.
- `mobile/` — the complete student feature set and the reference UX. Keep it for
  Android.
- `web/` — Next.js 14 + MUI, shared theme tokens, `apiFetch`, JWT storage, and
  auth context. Reuse all of this.

What blocks a student PWA today:

1. `web/src/context/AuthContext.tsx` deliberately clears any non-teacher session
   (line ~39). A student session would be deleted before the student routes load.
2. `web/src/app/login/page.tsx` rejects student accounts and tells them to use
   the Android app.
3. `web/src/lib/api.ts` redirects all 401s to `/login`; student routes need
   `/student/login`.
4. `web/src/app/join/page.tsx` is Android-only copy.
5. No manifest, icons, service worker, iOS meta tags, or install onboarding.
6. The web app is desktop-first; the student surface needs mobile layout,
   bottom navigation, safe-area handling, and camera UX.

Backend changes needed for the MVP: **none**, except confirming the production
`CORS_ORIGINS` includes the student origin (it already must include the web
origin if the dashboard works).

---

## 4. Recommended architecture

### Option A (recommended): extend the existing `web/` app

Add a student route group at `/student` in the same Next.js deployment:

```
https://<web-domain>/student          → student home / classrooms
https://<web-domain>/student/login
https://<web-domain>/student/signup
https://<web-domain>/student/join     → public join-code page
https://<web-domain>/student/scan     → full-screen QR scanner
https://<web-domain>/student/attendance
https://<web-domain>/student/pulse
https://<web-domain>/student/quizzes
https://<web-domain>/student/doubts
https://<web-domain>/student/profile
https://<web-domain>/student/install  → illustrated install guide
```

Why this is the easy path:

- One deployment, one domain, one CORS entry.
- Reuses `apiFetch`, token storage, theme tokens, and existing dependencies.
- Route-level code splitting means students do not download instructor code.
- The instructor dashboard keeps its current URL and behaviour.
- A future subdomain (`student.example.com`) can serve the same routes without a
  rewrite.

Trade-off: the PWA shares a Next.js app with the instructor dashboard. Keep the
student routes physically separate (`src/app/student/**`,
`src/components/student/**`, `src/lib/student/**`) so the boundary stays clean.

### Option B: a separate `student-web/` Next.js app

Cleaner separation and smaller deploy surface, but duplicates auth, theme, API
helpers, CI, and deployment configuration. Only worth it if the student app is
expected to grow independently or move to a separate domain soon.

### Not recommended now

- **Flutter web build** — large bundle, weaker camera/PWA integration, and a
  second rendering stack to maintain.
- **Capacitor/iOS native wrapper** — requires a Mac, Xcode, an Apple Developer
  account, and App Store/TestFlight review. Keep this as a future escape hatch
  only if the PWA camera experience proves unacceptable.

---

## 5. Key design decisions for iOS

### 5.1 Install-first onboarding

Because an installed web app gets its own storage container:

- Do not tell students to sign in first and install later; they will appear
  logged out in the installed app.
- Recommended flow: open `/student/install` in Safari → Add to Home Screen →
  launch ClassPulse → sign in → grant camera when scanning.
- Show a dismissible install banner on iOS Safari when not standalone. There is
  no automatic install prompt, so the banner must explain the Share-sheet steps.
- Detect in-app browsers (WhatsApp, Instagram, Facebook, LinkedIn) and show
  "Open in Safari" instructions; Add to Home Screen is not reliably available
  inside those.
- Update the instructor-facing `/join` page to be platform-aware: Android keeps
  the APK instructions, iOS gets the PWA install steps, and the 6-character code
  stays visible with a copy button.
- Add a QR code (using the already-installed `qrcode.react`) pointing to the
  install page so instructors can put it on a slide.

### 5.2 Camera permission UX

Camera access in an installed iOS web app may be requested again on every cold
launch (WebKit bug #327237). Design for that:

- Never call `getUserMedia` on page load. Show a clear "Start camera" button so
  the permission request comes from a user gesture.
- Explain why camera access is needed before the system prompt.
- Handle `NotAllowedError`, `NotFoundError`, `NotReadableError`, and
  `OverconstrainedError` with specific recovery instructions.
- Provide a "Troubleshooting" section: check Settings → Safari → Camera, close
  and reopen the app, update iOS.
- Provide a fallback for devices where the installed camera is broken: add
  instructions to remove the Home Screen app and add it again with **Open as Web
  App** turned off (iOS 26). That opens the same site in Safari, where camera
  permission persists, at the cost of browser chrome.
- Test `navigator.permissions.query({ name: 'camera' })`; support varies. Do not
  depend on it.

### 5.3 QR scanner implementation

The existing protocol requires exactly three frames from the same batch, with the
same `session_id`, `batch_id`, `timestamp`, and HMAC signature. The backend
allows tokens up to 10 seconds old, and the instructor projector rotates frames
every 800 ms by default. The browser must collect all three within that window.

Implementation outline:

- `getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })`.
- Render into `<video autoPlay playsInline muted>`; `playsInline` is mandatory on
  iOS.
- Decode loop using `zxing-wasm` (or `barcode-detector`, the maintained
  `zxing-wasm`-backed polyfill). Lazy-load the WASM module only on `/student/scan`.
- Throttle decoding to roughly 8–12 fps, draw the video frame into a canvas,
  downscale the long edge to ~720–960 px, and decode QR only.
- Keep a `Map<seq_idx, token>` buffer identical to
  `mobile/lib/screens/qr_scanner_screen.dart`:
  - Reset the buffer when `batch_id` changes.
  - Record `scan_started_at` when the first frame of a batch is seen.
  - Submit when indices 0, 1, and 2 are present.
- Normalize both compact (`s,b,i,t,k,h`) and long-form fields before POSTing to
  `/attendance/scan`, matching the Flutter client.
- Treat HTTP 200 as success and HTTP 409 as "already marked present", not as a
  hard failure.
- Show the three-frame accumulator (Frame 1/2/3) and capture latency, matching
  the Android UX.
- Support rear/front camera switching if the device allows it. Torch support is
  not reliable on iOS Safari; do not make it a core feature. If zoom constraints
  are unavailable, implement digital zoom by cropping the center of the canvas.
- Use `navigator.wakeLock` where available (iOS 18.4+ in Home Screen apps) and
  release it when scanning stops.
- Keep the scanner full-screen with safe-area padding and `touch-action: none` to
  prevent accidental zoom/scroll.

**Phase 0 must measure:** decode time per frame, successful 3-frame capture rate
over at least 20 attempts, and whether all three frames can be captured in under
8 seconds on the oldest supported iPhone. If not, tune resolution, decoder
settings, or fall back to the Safari-tab flow before building the rest of the
student UI.

### 5.4 Deep links and join codes

iOS does not reliably route external links into an installed web app. Plan for
that:

- Instructor shares a 6-character code and/or a link to `/student/join?code=XYZ`.
- The join page displays the code prominently with a copy button and install
  instructions.
- A student who already installed the PWA copies the code and enters it in the
  app. Avoid promising that tapping a link will open the installed app.
- If we later add push notifications, tapping a notification can open the app,
  but that is not a replacement for join links.

### 5.5 Standalone layout, safe areas, and iOS meta tags

Add to the student layout/metadata:

- `manifest: '/student/manifest.webmanifest'`
- `apple-mobile-web-app-capable: yes` (legacy fallback for iOS 16.4–18)
- `apple-mobile-web-app-status-bar-style: default` (or `black-translucent` for
  the scanner)
- `apple-mobile-web-app-title: ClassPulse`
- 180×180 `apple-touch-icon`
- `theme-color: #6750A4`
- `viewport-fit=cover`
- CSS using `env(safe-area-inset-*)`, `100dvh`, and no fixed `100vh`.

Manifest fields:

```json
{
  "id": "/student",
  "name": "ClassPulse Student",
  "short_name": "ClassPulse",
  "start_url": "/student",
  "scope": "/student",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#FEF7FF",
  "theme_color": "#6750A4",
  "icons": [
    { "src": "/icons/student-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/student-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/student-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

iOS reads only a subset of the manifest (`name`, `short_name`, `start_url`,
`scope`, `display`, `id`, `theme_color`, and `icons` only when no
`apple-touch-icon` exists). The Apple meta tags and icon still matter.

### 5.6 Service worker and updates

The service worker is optional for iOS installation but useful for startup speed,
offline shell, and Android's install prompt.

- Serve it from `web/public/student/sw.js` so its scope is `/student/`.
- Register with `navigator.serviceWorker.register('/student/sw.js', { scope: '/student/' })`.
- Cache static assets cache-first and navigations network-first with an offline
  fallback page.
- Never cache authenticated API responses or anything cross-origin.
- Add an update flow: when a new worker is waiting, show "Update available" and
  activate it on user confirmation, then reload. Do not leave users stuck on a
  stale build.
- Add `Cache-Control: no-cache` for `sw.js` and the manifest in
  `next.config.js` headers.
- If hand-rolling the service worker becomes fragile with Next.js RSC payloads,
  use the maintained Serwist integration instead of `next-pwa` (which is
  unmaintained). Verify compatibility with this Next.js version before adopting.

### 5.7 Live activities

The Flutter student app uses polling (4 s for PulseMeter, timer-based polling for
quizzes). Mirror that:

- Poll only while the page is visible; pause on `visibilitychange`.
- Refetch on resume and refresh manually.
- `socket.io-client` is already installed if we later want push-style updates,
  but polling is lower risk and matches existing behaviour.
- Handle expired activities, ended sessions, and duplicate submissions.

### 5.8 Push notifications (optional, later)

Not required for v1. If added:

- iOS 16.4+ installed PWA only; user gesture required.
- Needs VAPID keys, a `push_subscriptions` table, backend send endpoints, and a
  `push` handler in the service worker.
- Useful for "attendance is open", "new doubt reply", "quiz started".
- Budget an extra phase and test on a real device.

---

## 6. Phased delivery plan

Estimates are rough for one developer already familiar with this repo. Calendar
time depends heavily on physical iPhone access.

### Phase 0 — Feasibility spike (2–3 days)

**Goal:** prove the risky part before building UI.

- Deploy a throwaway `/student/spike` page (or a local HTTPS tunnel) with a
  manifest, camera start button, and `zxing-wasm` decode loop.
- Test on a physical iPhone in both Safari and an installed Home Screen web app,
  against the real instructor projector running the 3-QR stream.
- Measure decode speed, 3-frame capture success, permission prompts, cold-launch
  behaviour, and background/foreground behaviour.
- Verify install, standalone launch, and login persistence across a cold launch.

**Gate:** at least ~95% successful 3-frame captures within 8 seconds on the target
device(s). If this fails, stop and re-plan the scanner before building the app.

**Prerequisite:** at least one physical iPhone (ideally one iOS 18+ and one iOS
26) and a second screen/projector. Camera and installation cannot be validated
in a desktop browser or the iOS Simulator.

### Phase 1 — PWA shell, install onboarding, auth (4–5 days)

- Refactor `web/src/app/layout.tsx` into a server layout with a client
  `Providers` component so nested metadata can be exported.
- Add the `/student` route group, mobile shell, bottom navigation, and profile.
- Add manifest, icons, iOS meta tags, service worker, install banner, and
  `/student/install` guide.
- Make auth role-neutral; add student login/signup; add role guards so teachers
  and students cannot land in each other's surfaces.
- Update `apiFetch` to redirect to `/student/login` on student routes.
- Update `/join` for iOS, Android, and copy-to-clipboard.
- Add unit tests for platform detection, auth guards, and redirect logic.

### Phase 2 — Classrooms + QR attendance (5–7 days)

This is the **minimum viable iOS product**.

- Student home: enrolled classrooms, join with code, unenroll.
- Full-screen scanner with camera permission flow, frame accumulator, submit,
  success/error/duplicate handling, troubleshooting, and Safari fallback.
- Extract the frame-buffer logic into a pure module and unit-test it:
  out-of-order frames, batch reset, duplicate frames, incomplete sequences.
- Test on all target iPhones; tune decode resolution and frame rate.
- Verify end-to-end with the instructor's live session.

### Phase 3 — Attendance history + live activities (5–6 days)

- Attendance dashboard (`GET /attendance/me`): per-classroom summary and records.
- PulseMeter: active activity list, word-cloud/MCQ/rating responses, results.
- Quizzes: active quiz, timer, answer submission, personal results.
- Visibility-aware polling hooks with reconnect on resume.

### Phase 4 — Doubt forum (5–6 days)

- Thread list, filters, create doubt, detail, replies, accept solution, helpful
  votes, edit/delete, instructor endorsement display.
- Topics and course-wide/classroom-wide scopes.
- Build mobile-specific UI rather than reusing the desktop `DoubtForumView`.

### Phase 5 — Hardening and release (3–4 days)

- Offline shell and clear offline states; no pretend-offline data.
- Update prompt, error boundaries, loading skeletons.
- Safe areas, keyboard behaviour, focus states, reduced motion.
- Lazy-load the scanner/WASM; check the student bundle size.
- CI: web tests + production build; keep Android and instructor suites green.
- Lighthouse/installability audit on Android Chrome; manual iOS checklist.
- Write the install guide, support matrix, and known-issues page.
- Pilot with one section, measure scan success rate, then roll out.

**Total:** roughly 24–31 developer-days for full parity; ~12–15 days for the
install + auth + classrooms + scanner MVP.

---

## 7. Concrete file map

```
web/
├── next.config.js                         # headers for sw.js/manifest (new)
├── public/
│   ├── icons/                             # 180/192/512/1024 + maskable (new)
│   └── student/
│       ├── sw.js                          # student-scoped service worker (new)
│       └── manifest.webmanifest           # PWA manifest (new)
└── src/
    ├── app/
    │   ├── layout.tsx                     # refactor: server layout + Providers
    │   ├── providers.tsx                  # client ThemeProvider/AuthProvider (new)
    │   ├── join/page.tsx                  # platform-aware install instructions
    │   ├── page.tsx                       # add teacher role guard
    │   ├── login/page.tsx                 # redirect students to /student
    │   └── student/
    │       ├── layout.tsx                 # metadata, PWA boot, student shell
    │       ├── page.tsx                   # classrooms home
    │       ├── login/page.tsx
    │       ├── signup/page.tsx
    │       ├── join/page.tsx
    │       ├── scan/page.tsx
    │       ├── attendance/page.tsx
    │       ├── pulse/page.tsx
    │       ├── quizzes/page.tsx
    │       ├── doubts/page.tsx
    │       ├── doubts/[id]/page.tsx
    │       ├── profile/page.tsx
    │       └── install/page.tsx
    ├── components/student/                 # mobile student UI (new)
    │   ├── StudentShell.tsx
    │   ├── InstallBanner.tsx
    │   ├── ClassroomCard.tsx
    │   ├── JoinClassroomDialog.tsx
    │   ├── FrameProgress.tsx
    │   ├── ActivityCard.tsx
    │   └── DoubtThread.tsx
    ├── context/AuthContext.tsx             # role-neutral session restore
    ├── lib/
    │   ├── api.ts                          # route-aware login redirect
    │   ├── studentApi.ts                   # typed wrappers for student endpoints
    │   ├── studentPwa.ts                   # install/standalone/platform detection
    │   └── qrScan.ts                       # decoder loop + frame accumulator (new)
    └── hooks/
        ├── usePolling.ts                   # visibility-aware polling
        └── useRequireRole.ts               # teacher/student guards
```

Backend changes for the MVP: none. If the PWA is deployed on a new origin, add it
to `CORS_ORIGINS` in the backend environment. If push is added later, add VAPID
configuration, a subscription table, and send endpoints.

---

## 8. API mapping (reuse existing endpoints)

| Student flow | Endpoint(s) |
|---|---|
| Sign up / log in | `POST /auth/signup`, `POST /auth/login`, `GET /auth/me` |
| Classrooms | `GET /classrooms/mine`, `POST /classrooms/join`, `DELETE /classrooms/:id/leave` |
| QR attendance | `POST /attendance/scan`, `GET /attendance/me` |
| PulseMeter | `GET /live-activities/active?classroom_id=...`, `POST /live-activities/:id/respond` |
| Quizzes | `GET /live-activities/active?classroom_id=...`, `POST /live-activities/:id/quiz/answer`, `GET /live-activities/:id/quiz/my-results` |
| Doubts | `GET /doubts`, `POST /doubts`, `GET /doubts/:id`, `POST /doubts/:id/replies`, `PUT /doubts/:id`, `DELETE /doubts/:id`, `POST /doubts/helpful`, `POST /doubts/replies/:replyId/accept-solution` |
| Topics | `GET /courses/:courseId/topics`, `POST /courses/:courseId/topics` |

The existing Flutter screens are the reference for request bodies and response
shapes. Extract those shapes into typed helpers in `studentApi.ts` so the UI does
not scatter inline fetches.

---

## 9. Test matrix

### Devices

- iPhone with iOS 16.4 (oldest install target, if supported)
- iPhone with iOS 17/18 (camera-in-PWA bug history)
- iPhone with iOS 26 (current default web-app behaviour)
- iPad (optional; layout check)
- Android Chrome (PWA install and scanner)
- Desktop Chrome/Safari (layout and non-camera flows)

### Scenarios

- Safari tab → Add to Home Screen → launch standalone → sign in.
- Install after signing in in Safari; confirm the expected fresh login and
  document it.
- Cold launch after a day; check session persistence and camera re-prompt.
- Permission denied → recovery instructions → retry.
- Scan 3 frames from a live projector; success, expired batch, mixed batch,
  duplicate attendance (409), session ended.
- Scanner in low light, at projector distance, with motion, and with the
  instructor's 800 ms / 300 ms / 100 ms rotation settings.
- Background/foreground during scanning and during a live activity.
- Slow network / offline: clear message, no false success.
- PWA update available → refresh → no stale cache.
- Android app and instructor dashboard regression.

### Automation

- Vitest unit tests for the frame accumulator, token normalization, auth guards,
  platform detection, and redirect logic.
- Existing web tests and production build in CI.
- Optional Playwright smoke tests with a mocked API for the student login and
  classroom list; camera flows stay manual.
- Lighthouse installability audit on Android Chrome; manual iOS audit against
  the checklist above.

---

## 10. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| QR decode too slow on iOS in the browser | Medium | Phase 0 spike; WASM decoder, downscaled frames, adaptive frame rate; Safari fallback; instructor default 800 ms rotation. |
| Camera fails or re-prompts in the installed app | Medium | User-gesture start, clear recovery UI, test matrix, documented "Open as Web App off" Safari fallback. |
| Installing after login loses the session | High | Install-first onboarding; explain clearly; no surprises. |
| Users cannot find Add to Home Screen | High | Illustrated `/student/install` page, in-app banner, instructor slide with QR code. |
| Join/deep links do not open the installed app | High | Code-first join flow with copy button; do not rely on deep links. |
| Service worker serves stale builds | Medium | Versioned caches, update prompt, `no-cache` for SW/manifest, test update path. |
| Student bundle inherits instructor code | Low | Route-level split; student-only components; lazy-load scanner/WASM; check bundle output. |
| iOS version fragmentation | Medium | Set a support floor, document it, test oldest and newest; provide Safari fallback. |
| No App Store presence | Accepted | PWA is the chosen trade-off; revisit Capacitor only if needed. |
| Android app regressions | Low | No backend contract changes; keep mobile CI and smoke-test the APK. |

---

## 11. Definition of done

- An iPhone user can follow a linked guide, install ClassPulse from Safari, and
  launch it standalone with the correct icon and name.
- A student can sign up or log in, stay signed in across launches, and join a
  classroom with a code.
- A student can scan the live 3-frame QR stream and be marked present, including
  the already-marked (409) case, on the target iPhone models.
- PulseMeter, quizzes, attendance history, and the doubt forum work on a phone
  viewport.
- Offline and permission-denied states are explicit, not silent failures.
- The instructor dashboard and Android app behave exactly as before.
- CI is green; the install guide, support matrix, and known-issues page are
  published.

---

## 12. Resolved decisions

1. **Scope:** full student parity in v1.
2. **Minimum iOS version:** iOS 18+.
3. **Deployment shape:** same domain at `/student`.
4. **Push notifications:** out of scope for v1.
5. **Offline expectations:** app-shell/offline-message only.
6. **Future App Store path:** PWA is the permanent iOS solution for now.
7. **Device access:** a physical iPhone is still needed for the camera and
   installation checkpoints. Implementation and automated verification are done
   by the agent; the device checkpoints are listed in the execution plan.
