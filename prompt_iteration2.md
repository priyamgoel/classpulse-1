# ClassPulse — Iteration 2 Build Prompt

You are continuing as the senior full-stack engineer on **ClassPulse**. You
already built and shipped Iteration 1 (auth, classroom management, anti-proxy
QR attendance) — see `progress.md` for exactly what exists and which commits
built it. Read that file first so you don't rebuild or contradict anything
already working.

You are now building **Iteration 2**: PulseMeter, Live MCQ Quizzing, the
Doubt Forum with audience-scoped search, and a proper analytics/charting
layer (including a retrofit of Iteration 1's dashboards, which shipped
without real charts).

`technical_specification_iteration2.md` is the source of truth for this
iteration's schema, API/WebSocket contracts, and part breakdown. It **extends**
`technical_specification.md` (Iteration 1) — don't treat it as a replacement.
If anything here conflicts with Iteration 1's spec, Iteration 2's spec wins
for anything it explicitly changes; everything else from Iteration 1 stands.

`appearance_mode.md`'s light-mode-only rule still applies to every new
screen and chart.

---

## Non-negotiable working rules (same as Iteration 1)

1. **Build in the 8 parts defined in `technical_specification_iteration2.md`
   Section 7, strictly in order.** Do not start Part *N+1* until the user has
   explicitly reviewed and approved Part *N*. Stop, summarize what you built,
   list what's unverified/assumption-based, and wait for feedback.
2. **Never build a feature ahead of its part.** Leave `// TODO(partN):`
   comments and documented hooks instead.
3. **The scoring formula, attendance-linkage logic, topic-tag scoping, mute
   durations, and pseudonym scheme are all finalized** in
   `technical_specification_iteration2.md` Sections 2, 4a, and 4b — implement
   them exactly as documented, do not re-ask about them or simplify them
   away. In particular: the WIDE/NARROW scoring toggle (Section 4a), the
   pending/resolve logic for present-vs-responded (Section 4b), the
   course-level seeded (not teacher-authored) topic tags, and the
   one-pseudonym-per-student-per-course scheme with teacher-only reveal are
   all deliberate, specific designs — not simplifications to skip for
   speed. If you hit a genuinely new ambiguity the spec doesn't cover, flag
   it the same way Iteration 1 did: state the ambiguity and your proposed
   default, then wait for confirmation before proceeding.
4. **Ask before assuming on anything user-facing or irreversible** — same
   standard as Iteration 1. Non-user-facing implementation details are fine
   to decide yourself.
5. **Match the design system exactly**, including the new chart theming
   tokens defined in Part 1 — reuse them everywhere charts appear afterward,
   don't reinvent styling per chart.
6. **No new credentials are needed for Iteration 2.** Everything runs on the
   existing Neon/Upstash/Render/Vercel/Firebase setup from Iteration 1 — do
   not introduce a new charting SaaS, search service, or hosting account.
7. **Explain, don't just execute** — same as Iteration 1: briefly explain new
   concepts the first time they show up (e.g., what a GIN index is, what
   "server-authoritative timestamp" means and why quiz timing uses it).
8. **Keep `progress.md` updated after every part, in the same format it's
   already in.** After finishing and getting approval for each part, append
   a new row to the status table and a new dated entry to the detailed log —
   don't wait until the whole iteration is done, and don't summarize multiple
   parts into one entry. `progress.md` is the single source of truth for
   handover across AI sessions/accounts, so it needs to reflect reality after
   every change, not just at milestones. This applies for the rest of the
   project's life, not just Iteration 2 — treat it as a standing rule.

---

## Tech stack additions (fixed — do not substitute without asking)

| Layer | Choice |
|---|---|
| Web charts | Recharts |
| Mobile charts | `fl_chart` (new Flutter dependency) |
| Full-text search | PostgreSQL native `tsvector`/`tsquery` (no external search service) |

Everything else (Next.js/MUI, Flutter/Material 3, Express, Socket.io+Redis,
Postgres/Neon, JWT auth, Vercel/Render/Firebase/GitHub Actions) is unchanged
from Iteration 1.

---

## Communication style expected from you

Same as Iteration 1: restate what you're building and any assumptions at the
start of each part; give a plain-language summary (not a wall of code) at the
end of each part covering what works, how to test it, and what's deferred;
call out unmet acceptance criteria explicitly rather than marking a part done.

---

## Testing guidance

- **All parts**: test locally first (web in browser, Flutter on emulator or
  USB-connected phone), against the same cloud Postgres/Redis already in use.
- **Parts 3 and 5 specifically** (live PulseMeter and live quiz sessions)
  need a real end-to-end test exactly like Iteration 1's Part 5 did — teacher
  on web, student on the real Flutter app, over the deployed Render/Vercel
  URLs, not localhost, since a physical phone can't reach a laptop's
  localhost over Wi-Fi.
- After each part, redeploy to Render/Vercel (backend/web already have CI/CD
  from Iteration 1's Part 7 — pushing to `main` handles this automatically)
  so the user can review live, not just locally.

---

## Definition of done for Iteration 2

A teacher can author and launch a PulseMeter or quiz and see live results;
students respond from the real Flutter app and see immediate feedback; a
full quiz produces a correct leaderboard; students can post, reply to, and
mark doubts "Helpful" at all three audience scopes, and search finds them
correctly within that scope; both teacher and student homepages show
attendance, quiz, and doubt activity together using real charts, not tables.
Everything is deployed and reachable for review at each part's checkpoint,
same as Iteration 1.
