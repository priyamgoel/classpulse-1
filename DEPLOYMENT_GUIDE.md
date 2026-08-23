# ClassPulse — Deployment & Testing Guide (Iteration 1)

This guide provides complete, step-by-step instructions for running and testing ClassPulse locally and deploying the backend, web dashboard, and mobile APK to cloud infrastructure.

---

## 1. Local Development & End-to-End Testing

You can run and test all 3 applications simultaneously on your development machine.

### Step 1: Start the Backend API & WebSocket Server
```bash
cd backend
npm install
npm run dev
```
- **Backend API**: `http://localhost:4000`
- **Health Check**: `http://localhost:4000/health`
- **WebSocket Layer**: `ws://localhost:4000` (Socket.io)
- **Database**: Automatically connects to Neon PostgreSQL and Upstash Redis using `backend/.env`.

---

### Step 2: Start the Web Instructor Dashboard
```bash
cd web
npm install
npm run dev
```
- **Web App**: `http://localhost:3000`
- **Teacher Account Login**:
  - **Email**: `teacher@thapar.edu`
  - **Password**: `password123`
- **Capabilities**:
  - Create classroom sections (e.g. `UCS503P: Software Engineering Lab`).
  - View & rotate 6-character student join codes.
  - Launch live anti-proxy 3-QR stream projector.
  - Watch live attendance roster update in real time with Attendance Capture Latency (**ACL**) badges.
  - View class-level analytics, attendance percentage progress bars, and per-student drill-downs.

---

### Step 3: Run the Flutter Android App (Student)
```bash
cd mobile
flutter pub get
flutter run
```
- **Runs on**: Android Emulator or Physical Android Phone (via USB debugging).
- **Student Account Login**:
  - **Email**: `student@thapar.edu`
  - **Password**: `password123`
- **Capabilities**:
  - Join classroom sections via 6-character code.
  - Tap **"Scan QR"** to open hardware-accelerated multi-frame camera scanner.
  - Point camera at the teacher's rotating 3-QR stream to automatically buffer all 3 frames and mark **PRESENT**.
  - View Attendance Analytics tab with overall attendance % and per-course session history drill-downs.

---

## 2. Cloud Deployment (Production)

Follow these click-by-click instructions to deploy ClassPulse for real-device testing over Wi-Fi and pilot classroom trials.

---

### A. Deploy Backend to Render (Free Web Service)

1. Open [render.com](https://render.com) and log in with your GitHub account.
2. Click **"New +"** $\rightarrow$ **"Web Service"**.
3. Select your repository `priyamgoel/classpulse-1`.
4. Configure the service settings:
   - **Name**: `classpulse-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. In the **"Environment Variables"** section, add the variables from your `backend/.env`:
   - `DATABASE_URL`: *(Your Neon PostgreSQL connection string)*
   - `REDIS_URL`: *(Your Upstash Redis connection string)*
   - `JWT_SECRET`: `classpulse_production_jwt_secret_key_2026`
   - `QR_HMAC_SECRET`: `classpulse_production_hmac_secret_key_2026`
   - `PORT`: `4000`
6. Click **"Create Web Service"**.
7. Once deployed, copy your live backend URL (e.g., `https://classpulse-backend.onrender.com`).

---

### B. Deploy Web Dashboard to Vercel (Free Next.js Hosting)

1. Open [vercel.com](https://vercel.com) and sign in with your GitHub account.
2. Click **"Add New..."** $\rightarrow$ **"Project"**.
3. Import `priyamgoel/classpulse-1`.
4. Configure project settings:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click "Edit" and select `web`.
5. Under **"Environment Variables"**, add:
   - `NEXT_PUBLIC_API_URL`: `https://classpulse-backend.onrender.com` *(Paste your Render URL from Step A)*
6. Click **"Deploy"**.
7. Vercel will build and launch your live instructor dashboard URL (e.g., `https://classpulse-web.vercel.app`).

---

### C. Build and Distribute Android APK via Firebase

1. **Build Release APK locally**:
   ```bash
   cd mobile
   flutter build apk --release
   ```
   The built APK file will be generated at:
   `mobile/build/app/outputs/flutter-apk/app-release.apk`

2. **Upload to Firebase App Distribution**:
   - Open [Firebase Console](https://console.firebase.google.com).
   - Click **"Add project"** $\rightarrow$ name it `ClassPulse`.
   - In the left sidebar under *Release & Monitor*, click **"App Distribution"**.
   - Drag and drop `app-release.apk`.
   - Enter the email addresses of your pilot students/testers to invite them.
   - Students receive an email invite to install the app directly on their Android devices.

3. **Direct APK Installation (Alternative)**:
   - You can also copy `app-release.apk` directly to any Android smartphone via USB or Google Drive and tap to install.

---

## 3. Iteration 1 Definition of Done Checklist

| Feature | Requirement | Status |
|---|---|:---:|
| **Authentication & Roles** | Teacher & Student login/signup with role guards (Web is teacher-only) | ✅ |
| **Classroom Management** | Predefined course catalog, create section, 6-char join code/link/QR | ✅ |
| **Student Join Flow** | Student enters join code on mobile app and joins section roster | ✅ |
| **Anti-Proxy QR Engine** | 3-QR timestamped, HMAC-SHA256 signed rotating token stream (Redis TTL 15s) | ✅ |
| **Live Projector (Web)** | Rotating SVG QR stream + real-time Socket.io attendance roster feed | ✅ |
| **Multi-Frame Scanner** | Flutter camera scanner buffering 3 sequential frames with ACL tracking | ✅ |
| **Dashboards & Analytics** | Teacher section analytics + student drill-down; Student mobile attendance dashboard | ✅ |
| **Design System** | Strict **Light Mode Only** on Next.js MUI and Flutter Android App | ✅ |
| **CI/CD Pipeline** | GitHub Actions multi-job workflow for automated test, lint, and build | ✅ |
