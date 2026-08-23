const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./db');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Initialize PostgreSQL database tables on startup
db.initDb();

// Mount API Routes
app.use('/auth', authRoutes);

// Health Check Endpoint (Part 1 Acceptance Requirement)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'classpulse-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root Endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to ClassPulse API Server',
    health: '/health'
  });
});

app.listen(PORT, () => {
  console.log(`[ClassPulse Backend] Server running on http://localhost:${PORT}`);
  console.log(`[ClassPulse Backend] Health check available at http://localhost:${PORT}/health`);
});
