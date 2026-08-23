const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Helper to generate a clean 6-character human-readable join code
function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// POST /classrooms — Teacher creates a classroom section
router.post('/', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const { course_id, section_name } = req.body;

    if (!course_id || !section_name) {
      return res.status(400).json({ error: 'course_id and section_name are required' });
    }

    // Verify course exists
    const courseCheck = await db.query('SELECT * FROM courses WHERE id = $1', [course_id]);
    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Selected course not found' });
    }

    // Generate unique join code
    let joinCode = generateJoinCode();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      const codeCheck = await db.query('SELECT id FROM classrooms WHERE join_code = $1', [joinCode]);
      if (codeCheck.rows.length === 0) {
        isUnique = true;
      } else {
        joinCode = generateJoinCode();
        attempts++;
      }
    }

    const newClassroomResult = await db.query(
      `INSERT INTO classrooms (course_id, teacher_id, section_name, join_code)
       VALUES ($1, $2, $3, $4)
       RETURNING id, course_id, teacher_id, section_name, join_code, created_at`,
      [course_id, req.user.id, section_name.trim(), joinCode]
    );

    const classroom = newClassroomResult.rows[0];

    res.status(201).json({
      message: 'Classroom created successfully',
      classroom: {
        ...classroom,
        course_code: courseCheck.rows[0].course_code,
        course_name: courseCheck.rows[0].course_name,
        teacher_name: req.user.full_name,
        student_count: 0,
      },
    });
  } catch (err) {
    console.error('Error creating classroom:', err);
    res.status(500).json({ error: 'Failed to create classroom' });
  }
});

// POST /classrooms/:id/regenerate-join — Teacher rotates join code
router.post('/:id/regenerate-join', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const classroomId = req.params.id;

    // Check ownership
    const classCheck = await db.query('SELECT * FROM classrooms WHERE id = $1', [classroomId]);
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    if (classCheck.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not teach this classroom' });
    }

    const newJoinCode = generateJoinCode();
    const updateResult = await db.query(
      'UPDATE classrooms SET join_code = $1 WHERE id = $2 RETURNING *',
      [newJoinCode, classroomId]
    );

    res.json({
      message: 'Join code regenerated successfully',
      classroom: updateResult.rows[0],
    });
  } catch (err) {
    console.error('Error regenerating join code:', err);
    res.status(500).json({ error: 'Failed to regenerate join code' });
  }
});

// POST /classrooms/join — Student joins classroom section via join code
router.post('/join', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const { join_code } = req.body;

    if (!join_code) {
      return res.status(400).json({ error: 'Join code is required' });
    }

    const cleanCode = join_code.trim().toUpperCase();

    // Find classroom by join code
    const classResult = await db.query(
      `SELECT c.*, co.course_code, co.course_name, u.full_name as teacher_name
       FROM classrooms c
       JOIN courses co ON c.course_id = co.id
       JOIN users u ON c.teacher_id = u.id
       WHERE c.join_code = $1`,
      [cleanCode]
    );

    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid join code. No active classroom found.' });
    }

    const classroom = classResult.rows[0];

    // Check if already enrolled
    const enrollCheck = await db.query(
      'SELECT id FROM enrollments WHERE classroom_id = $1 AND student_id = $2',
      [classroom.id, req.user.id]
    );

    if (enrollCheck.rows.length > 0) {
      return res.status(409).json({ error: 'You are already enrolled in this classroom section.' });
    }

    // Insert enrollment
    await db.query(
      'INSERT INTO enrollments (classroom_id, student_id) VALUES ($1, $2)',
      [classroom.id, req.user.id]
    );

    res.status(200).json({
      message: `Successfully joined ${classroom.course_code}: ${classroom.course_name}`,
      classroom,
    });
  } catch (err) {
    console.error('Error joining classroom:', err);
    res.status(500).json({ error: 'Failed to join classroom' });
  }
});

// GET /classrooms/mine — List classrooms for authenticated user (Teacher: taught; Student: enrolled)
router.get('/mine', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'teacher') {
      const result = await db.query(
        `SELECT c.*, co.course_code, co.course_name,
                $2::text as teacher_name,
                (SELECT COUNT(*)::int FROM enrollments e WHERE e.classroom_id = c.id) as student_count
         FROM classrooms c
         JOIN courses co ON c.course_id = co.id
         WHERE c.teacher_id = $1
         ORDER BY c.created_at DESC`,
        [req.user.id, req.user.full_name]
      );
      return res.json({ classrooms: result.rows });
    } else {
      const result = await db.query(
        `SELECT c.*, co.course_code, co.course_name, u.full_name as teacher_name,
                (SELECT COUNT(*)::int FROM enrollments e WHERE e.classroom_id = c.id) as student_count,
                en.joined_at
         FROM enrollments en
         JOIN classrooms c ON en.classroom_id = c.id
         JOIN courses co ON c.course_id = co.id
         JOIN users u ON c.teacher_id = u.id
         WHERE en.student_id = $1
         ORDER BY en.joined_at DESC`,
        [req.user.id]
      );
      return res.json({ classrooms: result.rows });
    }
  } catch (err) {
    console.error('Error fetching classrooms:', err);
    res.status(500).json({ error: 'Failed to fetch classrooms' });
  }
});

// GET /classrooms/:id/roster — Teacher views enrolled student roster for section
router.get('/:id/roster', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const classroomId = req.params.id;

    // Check ownership
    const classCheck = await db.query('SELECT * FROM classrooms WHERE id = $1', [classroomId]);
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    if (classCheck.rows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not teach this classroom' });
    }

    const rosterResult = await db.query(
      `SELECT u.id as student_id, u.full_name, u.email, en.joined_at
       FROM enrollments en
       JOIN users u ON en.student_id = u.id
       WHERE en.classroom_id = $1
       ORDER BY u.full_name ASC`,
      [classroomId]
    );

    res.json({
      classroom_id: classroomId,
      roster: rosterResult.rows,
    });
  } catch (err) {
    console.error('Error fetching roster:', err);
    res.status(500).json({ error: 'Failed to fetch roster' });
  }
});

module.exports = router;
