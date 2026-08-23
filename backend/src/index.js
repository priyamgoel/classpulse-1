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

  socket.on('join_session', (sessionId) => {
    socket.join(`session_${sessionId}`);
    console.log(`[ClassPulse Socket] Client ${socket.id} joined room session_${sessionId}`);
  });

  socket.on('leave_session', (sessionId) => {
    socket.leave(`session_${sessionId}`);
    console.log(`[ClassPulse Socket] Client ${socket.id} left room session_${sessionId}`);
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
