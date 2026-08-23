# ClassPulse — Real-Time Classroom Engagement Platform

ClassPulse is a real-time classroom engagement platform designed for anti-proxy QR attendance, real-time feedback, live quizzing, and structured doubt resolution.

## Project Structure

```
classpulse-1/
├── backend/    # Node.js + Express REST & Socket.io API
├── web/        # Next.js + MUI (Material Design 3) Web Dashboard
└── mobile/     # Flutter (Android Target) Mobile Application
```

## Quick Start (Iteration 1 - Part 1)

### Backend
```bash
cd backend
npm install
npm run dev
```
Health endpoint: `http://localhost:4000/health`

### Web
```bash
cd web
npm install
npm run dev
```
Dashboard: `http://localhost:3000`

### Mobile
```bash
cd mobile
flutter pub get
flutter run
```
