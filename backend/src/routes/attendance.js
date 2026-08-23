const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateAndMarkAttendance } = require('../services/qrTokenService');

const router = express.Router();

// Helper to access Socket.io instance attached to Express app
function getSocketIo(req) {
  return req.app.get('io');
}

// POST /attendance/scan — Student submits decoded 3-QR sequence + scan_started_at
router.post('/scan', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const { session_id, tokens, scan_started_at } = req.body;

    if (!session_id || !tokens) {
      return res.status(400).json({ error: 'session_id and tokens array are required' });
    }

    const validation = await validateAndMarkAttendance({
      sessionId: session_id,
      tokens,
      scanStartedAt: scan_started_at,
      studentId: req.user.id,
    });

    if (!validation.valid) {
      return res.status(validation.statusCode).json({ error: validation.error });
    }

    // Broadcast attendance:marked event via Socket.io for live teacher dashboard update
    const io = getSocketIo(req);
    if (io) {
      io.to(`session_${session_id}`).emit('attendance:marked', {
        session_id,
        student: {
          id: req.user.id,
          full_name: req.user.full_name,
          email: req.user.email,
        },
        validated_at: validation.record.validated_at,
        scan_started_at: validation.record.scan_started_at,
        acl_ms: validation.acl_ms,
        status: validation.record.status,
      });
    }

    res.status(200).json({
      message: validation.message,
      record: validation.record,
      acl_ms: validation.acl_ms,
    });
  } catch (err) {
    console.error('Error validating attendance scan:', err);
    res.status(500).json({ error: 'Failed to validate attendance scan' });
  }
});

// GET /attendance/session/:id — Teacher views live attendance roster for session
router.get('/session/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const sessionId = req.params.id;

    // Verify session and teacher ownership
    const sessionCheck = await db.query(
      `SELECT s.*, c.teacher_id, co.course_code, co.course_name, c.section_name
       FROM sessions s
       JOIN classrooms c ON s.classroom_id = c.id
       JOIN courses co ON c.course_id = co.id
       WHERE s.id = $1`,
      [sessionId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (sessionCheck.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not teach this session' });
    }

    const recordsResult = await db.query(
      `SELECT ar.id, ar.student_id, ar.status, ar.scan_started_at, ar.validated_at,
              u.full_name, u.email,
              EXTRACT(MILLISECONDS FROM (ar.validated_at - ar.scan_started_at))::int as acl_ms
       FROM attendance_records ar
       JOIN users u ON ar.student_id = u.id
       WHERE ar.session_id = $1
       ORDER BY ar.validated_at ASC`,
      [sessionId]
    );

    res.json({
      session: sessionCheck.rows[0],
      attendance: recordsResult.rows,
      total_present: recordsResult.rows.length,
    });
  } catch (err) {
    console.error('Error fetching session attendance:', err);
    res.status(500).json({ error: 'Failed to fetch session attendance' });
  }
});

// GET /attendance/me — Student views their own attendance summary & records
router.get('/me', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const studentId = req.user.id;

    // Fetch individual attended sessions
    const recordsResult = await db.query(
      `SELECT ar.id, ar.session_id, ar.status, ar.validated_at, ar.scan_started_at,
              s.started_at as session_started_at, s.ended_at as session_ended_at,
              c.id as classroom_id, c.section_name,
              co.course_code, co.course_name,
              u.full_name as teacher_name
       FROM attendance_records ar
       JOIN sessions s ON ar.session_id = s.id
       JOIN classrooms c ON s.classroom_id = c.id
       JOIN courses co ON c.course_id = co.id
       JOIN users u ON c.teacher_id = u.id
       WHERE ar.student_id = $1
       ORDER BY ar.validated_at DESC`,
      [studentId]
    );

    // Fetch summary per enrolled classroom
    const summaryResult = await db.query(
      `SELECT c.id as classroom_id, co.course_code, co.course_name, c.section_name,
              COUNT(DISTINCT s.id)::int as total_sessions,
              COUNT(DISTINCT ar.id)::int as attended_sessions,
              CASE
                WHEN COUNT(DISTINCT s.id) > 0 THEN
                  ROUND((COUNT(DISTINCT ar.id)::numeric / COUNT(DISTINCT s.id)::numeric) * 100, 1)
                ELSE 100.0
              END as attendance_percentage
       FROM enrollments en
       JOIN classrooms c ON en.classroom_id = c.id
       JOIN courses co ON c.course_id = co.id
       LEFT JOIN sessions s ON s.classroom_id = c.id
       LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.student_id = $1
       WHERE en.student_id = $1
       GROUP BY c.id, co.course_code, co.course_name, c.section_name
       ORDER BY co.course_code ASC`,
      [studentId]
    );

    res.json({
      summary: summaryResult.rows,
      records: recordsResult.rows,
    });
  } catch (err) {
    console.error('Error fetching student attendance:', err);
    res.status(500).json({ error: 'Failed to fetch attendance records' });
  }
});

module.exports = router;
