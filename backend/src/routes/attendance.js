const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateAndMarkAttendance } = require('../services/qrTokenService');

const router = express.Router();

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

// GET /attendance/session/:id — Teacher views live attendance roster for a specific session
router.get('/session/:id', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const sessionId = req.params.id;

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

// GET /attendance/classroom/:id/summary — Teacher views section analytics & per-student breakdown
router.get('/classroom/:id/summary', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const classroomId = req.params.id;

    // Check ownership
    const classCheck = await db.query(
      `SELECT c.*, co.course_code, co.course_name
       FROM classrooms c
       JOIN courses co ON c.course_id = co.id
       WHERE c.id = $1`,
      [classroomId]
    );

    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    if (classCheck.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not teach this classroom' });
    }

    // 1. Total sessions conducted
    const sessionsResult = await db.query(
      `SELECT s.id, s.started_at, s.ended_at,
              COUNT(ar.id)::int as present_count,
              ROUND(AVG(EXTRACT(MILLISECONDS FROM (ar.validated_at - ar.scan_started_at)))::numeric, 1)::float as avg_acl_ms
       FROM sessions s
       LEFT JOIN attendance_records ar ON ar.session_id = s.id
       WHERE s.classroom_id = $1
       GROUP BY s.id, s.started_at, s.ended_at
       ORDER BY s.started_at DESC`,
      [classroomId]
    );

    const totalSessions = sessionsResult.rows.length;

    // 2. Per-student attendance breakdown
    const studentsResult = await db.query(
      `SELECT u.id as student_id, u.full_name, u.email, en.joined_at,
              COUNT(ar.id)::int as attended_sessions,
              CASE
                WHEN $2::int > 0 THEN
                  ROUND((COUNT(ar.id)::numeric / $2::numeric) * 100, 1)::float
                ELSE 100.0
              END as attendance_percentage,
              MAX(ar.validated_at) as last_attendance_at,
              ROUND(AVG(EXTRACT(MILLISECONDS FROM (ar.validated_at - ar.scan_started_at)))::numeric, 1)::float as avg_acl_ms
       FROM enrollments en
       JOIN users u ON en.student_id = u.id
       LEFT JOIN sessions s ON s.classroom_id = en.classroom_id
       LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.student_id = u.id
       WHERE en.classroom_id = $1
       GROUP BY u.id, u.full_name, u.email, en.joined_at
       ORDER BY u.full_name ASC`,
      [classroomId, totalSessions]
    );

    // 3. Aggregate statistics
    const totalEnrolled = studentsResult.rows.length;
    let avgAttendancePercentage = 100.0;
    if (totalEnrolled > 0 && totalSessions > 0) {
      const sum = studentsResult.rows.reduce((acc, s) => acc + parseFloat(s.attendance_percentage || 0), 0);
      avgAttendancePercentage = Math.round((sum / totalEnrolled) * 10) / 10;
    }

    // Overall Average ACL latency across all records for this classroom
    const aclResult = await db.query(
      `SELECT ROUND(AVG(EXTRACT(MILLISECONDS FROM (ar.validated_at - ar.scan_started_at)))::numeric, 1) as overall_avg_acl_ms
       FROM attendance_records ar
       JOIN sessions s ON ar.session_id = s.id
       WHERE s.classroom_id = $1`,
      [classroomId]
    );

    res.json({
      classroom: classCheck.rows[0],
      stats: {
        total_sessions: totalSessions,
        total_enrolled: totalEnrolled,
        average_attendance_percentage: avgAttendancePercentage,
        average_acl_ms: parseFloat(aclResult.rows[0]?.overall_avg_acl_ms || 0) || 0,
      },
      sessions: sessionsResult.rows,
      students: studentsResult.rows,
    });
  } catch (err) {
    console.error('Error fetching classroom summary:', err);
    res.status(500).json({ error: 'Failed to fetch classroom attendance summary' });
  }
});

// GET /attendance/classroom/:id/student/:studentId — Teacher views single student's session history
router.get('/classroom/:id/student/:studentId', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { id: classroomId, studentId } = req.params;

    const classCheck = await db.query('SELECT teacher_id FROM classrooms WHERE id = $1', [classroomId]);
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Classroom not found' });
    }
    if (classCheck.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const studentInfo = await db.query('SELECT id, full_name, email FROM users WHERE id = $1', [studentId]);
    if (studentInfo.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // List all sessions for this classroom and whether this student attended
    const records = await db.query(
      `SELECT s.id as session_id, s.started_at, s.ended_at,
              ar.status, ar.validated_at, ar.scan_started_at,
              EXTRACT(MILLISECONDS FROM (ar.validated_at - ar.scan_started_at))::int as acl_ms
       FROM sessions s
       LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.student_id = $2
       WHERE s.classroom_id = $1
       ORDER BY s.started_at DESC`,
      [classroomId, studentId]
    );

    res.json({
      student: studentInfo.rows[0],
      sessions: records.rows.map((r) => ({
        session_id: r.session_id,
        started_at: r.started_at,
        ended_at: r.ended_at,
        status: r.status || 'ABSENT',
        validated_at: r.validated_at,
        acl_ms: r.acl_ms,
      })),
    });
  } catch (err) {
    console.error('Error fetching student drilldown:', err);
    res.status(500).json({ error: 'Failed to fetch student attendance drilldown' });
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
              u.full_name as teacher_name,
              EXTRACT(MILLISECONDS FROM (ar.validated_at - ar.scan_started_at))::int as acl_ms
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
              u.full_name as teacher_name,
              COUNT(DISTINCT s.id)::int as total_sessions,
              COUNT(DISTINCT ar.id)::int as attended_sessions,
              CASE
                WHEN COUNT(DISTINCT s.id) > 0 THEN
                  ROUND((COUNT(DISTINCT ar.id)::numeric / COUNT(DISTINCT s.id)::numeric) * 100, 1)::float
                ELSE 100.0
              END as attendance_percentage
       FROM enrollments en
       JOIN classrooms c ON en.classroom_id = c.id
       JOIN courses co ON c.course_id = co.id
       JOIN users u ON c.teacher_id = u.id
       LEFT JOIN sessions s ON s.classroom_id = c.id
       LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.student_id = $1
       WHERE en.student_id = $1
       GROUP BY c.id, co.course_code, co.course_name, c.section_name, u.full_name
       ORDER BY co.course_code ASC`,
      [studentId]
    );

    // Calculate overall attendance aggregate
    let totalAllSessions = 0;
    let totalAllAttended = 0;
    summaryResult.rows.forEach((s) => {
      totalAllSessions += parseInt(s.total_sessions || 0, 10);
      totalAllAttended += parseInt(s.attended_sessions || 0, 10);
    });

    const overallPercentage =
      totalAllSessions > 0
        ? Math.round((totalAllAttended / totalAllSessions) * 1000) / 10
        : 100.0;

    res.json({
      overall: {
        total_sessions: totalAllSessions,
        attended_sessions: totalAllAttended,
        attendance_percentage: overallPercentage,
      },
      summary: summaryResult.rows,
      records: recordsResult.rows,
    });
  } catch (err) {
    console.error('Error fetching student attendance:', err);
    res.status(500).json({ error: 'Failed to fetch attendance records' });
  }
});

module.exports = router;
