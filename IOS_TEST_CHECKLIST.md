# ClassPulse iOS PWA — Device Test Checklist

Use this when the borrowed iPhone is available. Run the tests in order and send
back the feedback block at the bottom. You do not need to run any commands.

## Before you start

- iPhone on **iOS 18 or newer**.
- The deployed HTTPS URL for the web app (for example
  `https://classpulse.example.com`). Camera access will not work on HTTP.
- A **student test account** and a **teacher test account**.
- A teacher-created classroom with the student enrolled.
- A live attendance session with the rotating 3-QR projector stream.
- A live PulseMeter activity and a live quiz (or the ability to start them).
- Optional: a Mac with Safari Web Inspector for console details. If not, the
  scanner's built-in diagnostics panel is enough.

## 1. Install and launch

- [ ] Open `/student/install` in **Safari**. Confirm the install steps are visible.
- [ ] Tap **Share → Add to Home Screen**. Keep **Open as Web App** on.
- [ ] Confirm the ClassPulse icon and name appear on the Home Screen.
- [ ] Launch from the Home Screen. Confirm there is no Safari address bar.
- [ ] Confirm the bottom navigation shows Classes, Attendance, Pulse, Quizzes,
      Forum, and the account menu opens.
- [ ] Rotate the phone. Confirm the layout does not break or overflow.

## 2. Authentication and session

- [ ] Sign in with the student account in the installed app.
- [ ] Close the app from the app switcher, reopen it, and confirm you are still
      signed in.
- [ ] Sign out and confirm you return to the student login screen.
- [ ] Sign in again.
- [ ] Open `/` on the same phone in Safari and confirm the instructor dashboard
      does not accept the student session (it should send you back to `/student`).

## 3. Camera permission

- [ ] Open **Scan** from the Classes screen.
- [ ] Confirm the explainer appears before the camera starts.
- [ ] Tap **Start camera** and allow camera access.
- [ ] Confirm the live camera preview appears.
- [ ] Force-close the app from the app switcher and reopen it.
- [ ] Open Scan again. Note whether iOS asks for camera permission again.
- [ ] Confirm the scanner still starts after the re-prompt.

## 4. QR attendance (the critical test)

Run this against the live projector stream, once in Safari and once in the
installed app.

- [ ] Point the phone at the rotating 3-QR stream.
- [ ] Confirm Frame 1, Frame 2, and Frame 3 fill in as the codes rotate.
- [ ] Confirm the app submits automatically after the third frame.
- [ ] Confirm a **Marked PRESENT** screen appears.
- [ ] Record the capture latency (ACL) shown on the success screen.
- [ ] Scan the same session again and confirm the app shows the
      "already marked" state instead of a hard error.

Repeat at least **10 times** and record:

| Attempt | Safari / Installed | Success? | ACL shown | Notes |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |
| 8 | | | | |
| 9 | | | | |
| 10 | | | | |

Also test:

- [ ] Low light.
- [ ] The projector at the normal classroom distance.
- [ ] Moving the phone while scanning.
- [ ] Opening **Scanner diagnostics** and recording decode time, fps, frames
      seen, and the last error.
- [ ] Denying camera permission once and checking the recovery message.
- [ ] Backgrounding the app during scanning, then returning.

## 5. Attendance history

- [ ] Open **Attendance**. Confirm the overall percentage and session counts.
- [ ] Open a classroom. Confirm the session drill-down shows dates, teacher, and
      ACL.
- [ ] Confirm a missing/manual ACL displays as "—", not `NaN`.
- [ ] Confirm long course names do not overflow the screen.

## 6. PulseMeter

- [ ] Have the teacher launch a **word cloud**. Confirm it appears in **Pulse**
      within a few seconds.
- [ ] Submit a word. Confirm the confirmation screen shows the submitted value.
- [ ] Repeat for an **MCQ** and a **rating scale**.
- [ ] Confirm a duplicate submission is treated as already submitted.
- [ ] Have the teacher end the activity. Confirm the app shows "Activity ended".

## 7. Live quiz

- [ ] Have the teacher launch a quiz and start the first question.
- [ ] Confirm the question, countdown, and options appear.
- [ ] Submit an answer. Confirm "Answer submitted" appears.
- [ ] Confirm the teacher can reveal the answer and the app shows
      correct/incorrect plus the correct option.
- [ ] Let the timer expire on a question and confirm the time-up state.
- [ ] Complete the quiz. Confirm score, rank, participants, correct/answered
      counts, and the question review.
- [ ] Confirm a correct answer is never visible before the teacher reveals it.

## 8. Doubt forum

- [ ] Open **Forum** and confirm the classroom selector, search, scope chips,
      status, sort, and topics work.
- [ ] Ask a doubt with a title, body, section scope, and topic.
- [ ] Ask a doubt with a new topic and with the pseudonym switch on.
- [ ] Reply to a doubt.
- [ ] Mark a post and a reply helpful.
- [ ] As the student who asked, accept a reply as the solution and confirm the
      SOLVED state.
- [ ] Confirm a teacher-endorsed reply shows the ENDORSED badge.
- [ ] Edit and delete your own post and reply.
- [ ] Confirm another student's anonymous post does not reveal a real name.

## 9. Offline and updates

- [ ] Turn on Airplane Mode, reopen the installed app, and confirm a clear
      offline screen rather than a browser error.
- [ ] Turn networking back on and confirm the app recovers.
- [ ] Deploy a small change. Reopen the app and confirm the update prompt
      appears and refreshes to the new version.

## 10. Regression checks

- [ ] Android app still logs in and scans attendance against the same backend.
- [ ] Instructor dashboard still loads classrooms and can start a session.
- [ ] Instructor dashboard can still create a PulseMeter and a quiz.
- [ ] No backend 500s appear during any of the tests.

## Feedback template

Copy this into your reply and fill it in:

```text
iPhone model:
iOS version:
Tested in: Safari / installed Home Screen app / both
Web URL:
Backend URL (if different):
Teacher account available: yes/no
Student account available: yes/no

Install:
- Result:
- Problems:

Login/session:
- Result:
- Problems:

Camera:
- Permission prompt behaviour:
- Camera started: yes/no
- Problems:

QR attendance:
- Successes: __ / 10
- Typical ACL:
- Frame progress worked: yes/no
- Duplicate scan behaviour:
- Diagnostics (decode ms / fps / frames / last error):
- Problems:

Attendance history:
- Result:
- Problems:

PulseMeter:
- Result:
- Problems:

Quiz:
- Result:
- Problems:

Doubt forum:
- Result:
- Problems:

Offline/update:
- Result:
- Problems:

Screenshots / screen recording:
- Attach or list file names.

Console errors (if you have a Mac + Safari Web Inspector):
- Paste the first 10 errors.
```

## Known iOS behaviours to expect

- The installed app has **separate storage** from Safari. Install first, then
  sign in.
- iOS may re-ask for camera permission on every cold launch of a Home Screen
  web app. This is a WebKit limitation, not an app bug.
- A link shared in WhatsApp/Instagram opens in that app's built-in browser.
  Use "Open in Safari" before installing.
- Tapping a join link outside the app may open Safari rather than the installed
  app. Copy the 6-character code and enter it in the app.
