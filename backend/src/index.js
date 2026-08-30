const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const db = require('./db');
const { getRedisClient } = require('./redis');
const authRoutes = require('./routes/auth');
const coursesRoutes = require('./routes/courses');
const classroomsRoutes = require('./routes/classrooms');
const sessionsRoutes = require('./routes/sessions');
const attendanceRoutes = require('./routes/attendance');
const pulsemetersRoutes = require('./routes/pulsemeters');
const liveActivitiesRoutes = require('./routes/liveActivities');
const wordCloudMutesRoutes = require('./routes/wordCloudMutes');
const quizzesRoutes = require('./routes/quizzes');
const doubtsRoutes = require('./routes/doubts');
const topicsRoutes = require('./routes/topics');
const searchRoutes = require('./routes/search');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

// Setup Socket.io real-time WebSocket layer
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log(`[ClassPulse Socket] Client connected: ${socket.id}`);

  // Attendance session rooms
  socket.on('join_session', (sessionId) => {
    socket.join(`session_${sessionId}`);
    console.log(`[ClassPulse Socket] Client ${socket.id} joined room session_${sessionId}`);
  });

  socket.on('leave_session', (sessionId) => {
    socket.leave(`session_${sessionId}`);
    console.log(`[ClassPulse Socket] Client ${socket.id} left room session_${sessionId}`);
  });

  // Classroom broadcast channels
  socket.on('join_classroom', (classroomId) => {
    socket.join(`classroom_${classroomId}`);
    console.log(`[ClassPulse Socket] Client ${socket.id} joined room classroom_${classroomId}`);
  });

  socket.on('leave_classroom', (classroomId) => {
    socket.leave(`classroom_${classroomId}`);
    console.log(`[ClassPulse Socket] Client ${socket.id} left room classroom_${classroomId}`);
  });

  // Live Activity rooms (PulseMeter / Quizzing)
  socket.on('join_activity', (activityId) => {
    socket.join(`activity_${activityId}`);
    console.log(`[ClassPulse Socket] Client ${socket.id} joined room activity_${activityId}`);
  });

  socket.on('join_activity_teacher', (activityId) => {
    socket.join(`activity_${activityId}_teacher`);
    console.log(`[ClassPulse Socket] Teacher ${socket.id} joined room activity_${activityId}_teacher`);
  });

  socket.on('leave_activity', (activityId) => {
    socket.leave(`activity_${activityId}`);
    socket.leave(`activity_${activityId}_teacher`);
    console.log(`[ClassPulse Socket] Client ${socket.id} left activity rooms for ${activityId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[ClassPulse Socket] Client disconnected: ${socket.id}`);
  });
});

app.use(cors());
app.use(express.json());

// Initialize PostgreSQL database and Redis on startup
db.initDb();
getRedisClient();

// Mount API Routes
app.use('/auth', authRoutes);
app.use('/courses', coursesRoutes);
app.use('/classrooms', classroomsRoutes);
app.use('/sessions', sessionsRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/pulsemeters', pulsemetersRoutes);
app.use('/live-activities', liveActivitiesRoutes);
app.use('/word-cloud-mutes', wordCloudMutesRoutes);
app.use('/quizzes', quizzesRoutes);
app.use('/doubts', doubtsRoutes);
app.use('/courses', topicsRoutes);
app.use('/search', searchRoutes);

// Health Check Endpoint (Part 1 Acceptance Requirement)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'classpulse-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Root Endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to ClassPulse API Server',
    health: '/health',
  });
});

server.listen(PORT, () => {
  console.log(`[ClassPulse Backend] Server running on http://localhost:${PORT}`);
  console.log(`[ClassPulse Backend] Real-time WebSocket listening on port ${PORT}`);
  console.log(`[ClassPulse Backend] Health check available at http://localhost:${PORT}/health`);
});
