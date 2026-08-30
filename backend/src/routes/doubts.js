const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { getOrAssignPseudonym } = require('../utils/pseudonym');

/**
 * GET /doubts
 * List doubt posts filtered by audience scope, course, classroom, topic, and status.
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      course_id,
      classroom_id,
      scope,
      topic_id,
      status,
      sort_by = 'recent',
      search,
    } = req.query;

    let conditions = ['1=1'];
    let params = [];
    let paramIdx = 1;

    // Scope & Audience filtering
    if (scope === 'APP') {
      conditions.push(`dp.audience_scope = 'APP'`);
    } else if (scope === 'COURSE' && course_id) {
      conditions.push(`dp.course_id = $${paramIdx}`);
      params.push(course_id);
      paramIdx++;
      conditions.push(`dp.audience_scope IN ('APP', 'COURSE')`);
    } else if (scope === 'CLASSROOM' && classroom_id) {
      conditions.push(`(dp.classroom_id = $${paramIdx} OR (dp.course_id = (SELECT course_id FROM classrooms WHERE id = $${paramIdx}) AND dp.audience_scope IN ('APP', 'COURSE')))`);
      params.push(classroom_id);
      paramIdx++;
    } else if (classroom_id) {
      // Default classroom context view: show classroom + course + app scope
      conditions.push(`(dp.classroom_id = $${paramIdx} OR dp.audience_scope IN ('APP', 'COURSE'))`);
      params.push(classroom_id);
      paramIdx++;
    } else if (course_id) {
      conditions.push(`(dp.course_id = $${paramIdx} OR dp.audience_scope = 'APP')`);
      params.push(course_id);
      paramIdx++;
    }

    // Topic filter
    if (topic_id) {
      conditions.push(`dp.topic_id = $${paramIdx}`);
      params.push(topic_id);
      paramIdx++;
    }

    // Status filter
    if (status && status !== 'ALL') {
      conditions.push(`dp.status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }

    // Search query filter (Case-insensitive title & body)
    if (search && search.trim().length > 0) {
      conditions.push(`(dp.title ILIKE $${paramIdx} OR dp.body ILIKE $${paramIdx})`);
      params.push(`%${search.trim()}%`);
      paramIdx++;
    }

    // Sorting
    let orderBy = 'dp.created_at DESC';
    if (sort_by === 'helpful') {
      orderBy = 'dp.helpful_count DESC, dp.created_at DESC';
    } else if (sort_by === 'unanswered') {
      orderBy = 'reply_count ASC, dp.created_at DESC';
    }

    // Add current user id for helpful state check
    const currentUserIdParam = `$${paramIdx}`;
    params.push(req.user.id);

    const query = `
      SELECT dp.id, dp.course_id, dp.classroom_id, dp.topic_id, dp.author_id,
             dp.audience_scope, dp.title, dp.body, dp.is_anonymous, dp.pseudonym,
             dp.status, dp.helpful_count, dp.created_at, dp.updated_at,
             ct.name as topic_name,
             c.course_code, c.course_name,
             u.full_name as author_real_name,
             u.role as author_role,
             COUNT(dr.id)::int as reply_count,
             BOOL_OR(dr.is_solution) as has_accepted_solution,
             EXISTS(
               SELECT 1 FROM doubt_helpful_marks dhm
               WHERE dhm.target_type = 'POST' AND dhm.target_id = dp.id AND dhm.user_id = ${currentUserIdParam}
             ) as user_has_marked_helpful
      FROM doubt_posts dp
      JOIN courses c ON dp.course_id = c.id
      JOIN users u ON dp.author_id = u.id
      LEFT JOIN course_topics ct ON dp.topic_id = ct.id
      LEFT JOIN doubt_replies dr ON dp.id = dr.doubt_post_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY dp.id, ct.name, c.course_code, c.course_name, u.full_name, u.role
      ORDER BY ${orderBy}
    `;

    const result = await db.query(query, params);

    // Apply anonymity masking for list responses
    const posts = result.rows.map((post) => {
      const isAuthor = post.author_id === req.user.id;
      const isTeacher = req.user.role === 'teacher';

      return {
        ...post,
        author_display_name: post.is_anonymous
          ? (post.pseudonym || 'Anonymous Peer')
          : post.author_real_name,
        // Only include real name if not anonymous, or if requester is author/teacher
        author_real_name: (!post.is_anonymous || isAuthor || isTeacher) ? post.author_real_name : null,
      };
    });

    res.json({ posts });
  } catch (err) {
    console.error('[ClassPulse Doubts] Error fetching doubts:', err);
    res.status(500).json({ error: 'Failed to fetch doubt posts' });
  }
});

/**
 * POST /doubts
 * Create a new Doubt Post.
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      course_id,
      classroom_id,
      topic_id,
      audience_scope = 'CLASSROOM',
      title,
      body,
      is_anonymous = false,
    } = req.body;

    if (!course_id || !title || !body) {
      return res.status(400).json({ error: 'course_id, title, and body are required' });
    }

    if (!['APP', 'COURSE', 'CLASSROOM'].includes(audience_scope)) {
      return res.status(400).json({ error: 'Invalid audience_scope. Must be APP, COURSE, or CLASSROOM.' });
    }

    let pseudonym = null;
    if (is_anonymous) {
      pseudonym = await getOrAssignPseudonym(req.user.id, course_id);
    }

    const insertResult = await db.query(
      `INSERT INTO doubt_posts (
         course_id, classroom_id, topic_id, author_id, audience_scope,
         title, body, is_anonymous, pseudonym
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        course_id,
        classroom_id || null,
        topic_id || null,
        req.user.id,
        audience_scope,
        title.trim(),
        body.trim(),
        is_anonymous,
        pseudonym,
      ]
    );

    const post = insertResult.rows[0];

    res.status(201).json({
      message: 'Doubt post created successfully',
      post: {
        ...post,
        author_display_name: is_anonymous ? pseudonym : req.user.full_name || 'You',
      },
    });
  } catch (err) {
    console.error('[ClassPulse Doubts] Error creating doubt post:', err);
    res.status(500).json({ error: 'Failed to create doubt post' });
  }
});

/**
 * GET /doubts/:id
 * Retrieve a specific Doubt Post with all discussion replies and solution status.
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;

    // Fetch post
    const postRes = await db.query(
      `SELECT dp.*,
              ct.name as topic_name,
              c.course_code, c.course_name,
              u.full_name as author_real_name, u.role as author_role, u.email as author_email,
              EXISTS(
                SELECT 1 FROM doubt_helpful_marks dhm
                WHERE dhm.target_type = 'POST' AND dhm.target_id = dp.id AND dhm.user_id = $2
              ) as user_has_marked_helpful
       FROM doubt_posts dp
       JOIN courses c ON dp.course_id = c.id
       JOIN users u ON dp.author_id = u.id
       LEFT JOIN course_topics ct ON dp.topic_id = ct.id
       WHERE dp.id = $1`,
      [postId, req.user.id]
    );

    if (postRes.rows.length === 0) {
      return res.status(404).json({ error: 'Doubt post not found' });
    }

    const post = postRes.rows[0];

    // Fetch replies
    const repliesRes = await db.query(
      `SELECT dr.*,
              u.full_name as author_real_name, u.role as author_role,
              EXISTS(
                SELECT 1 FROM doubt_helpful_marks dhm
                WHERE dhm.target_type = 'REPLY' AND dhm.target_id = dr.id AND dhm.user_id = $2
              ) as user_has_marked_helpful
       FROM doubt_replies dr
       JOIN users u ON dr.author_id = u.id
       WHERE dr.doubt_post_id = $1
       ORDER BY dr.is_solution DESC, dr.is_teacher_endorsed DESC, dr.helpful_count DESC, dr.created_at ASC`,
      [postId, req.user.id]
    );

    const isTeacher = req.user.role === 'teacher';
    const isPostAuthor = post.author_id === req.user.id;

    const replies = repliesRes.rows.map((r) => {
      const isReplyAuthor = r.author_id === req.user.id;
      return {
        ...r,
        author_display_name: r.is_anonymous
          ? (r.pseudonym || 'Anonymous Peer')
          : r.author_real_name,
        author_real_name: (!r.is_anonymous || isReplyAuthor || isTeacher) ? r.author_real_name : null,
      };
    });

    res.json({
      post: {
        ...post,
        author_display_name: post.is_anonymous
          ? (post.pseudonym || 'Anonymous Peer')
          : post.author_real_name,
        author_real_name: (!post.is_anonymous || isPostAuthor || isTeacher) ? post.author_real_name : null,
      },
      replies,
      canRevealAuthor: isTeacher,
    });
  } catch (err) {
    console.error('[ClassPulse Doubts] Error fetching doubt details:', err);
    res.status(500).json({ error: 'Failed to fetch doubt details' });
  }
});

/**
 * POST /doubts/:id/replies
 * Add a reply/answer to a doubt post.
 */
router.post('/:id/replies', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const { body, is_anonymous = false } = req.body;

    if (!body || typeof body !== 'string' || body.trim().length === 0) {
      return res.status(400).json({ error: 'Reply body is required' });
    }

    // Verify post exists
    const postRes = await db.query('SELECT course_id FROM doubt_posts WHERE id = $1', [postId]);
    if (postRes.rows.length === 0) {
      return res.status(404).json({ error: 'Doubt post not found' });
    }

    const courseId = postRes.rows[0].course_id;

    let pseudonym = null;
    if (is_anonymous) {
      pseudonym = await getOrAssignPseudonym(req.user.id, courseId);
    }

    const isTeacher = req.user.role === 'teacher';

    const insertRes = await db.query(
      `INSERT INTO doubt_replies (
         doubt_post_id, author_id, body, is_anonymous, pseudonym, is_teacher_endorsed
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [postId, req.user.id, body.trim(), is_anonymous, pseudonym, isTeacher]
    );

    res.status(201).json({
      message: 'Reply posted successfully',
      reply: {
        ...insertRes.rows[0],
        author_display_name: is_anonymous ? pseudonym : req.user.full_name || 'You',
        author_role: req.user.role,
        user_has_marked_helpful: false,
      },
    });
  } catch (err) {
    console.error('[ClassPulse Doubts] Error posting reply:', err);
    res.status(500).json({ error: 'Failed to post reply' });
  }
});

/**
 * POST /doubts/:id/reveal-author
 * Role: Teacher
 * Reveals unmasked student identity behind an anonymous doubt post.
 */
router.post('/:id/reveal-author', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const postId = req.params.id;

    const result = await db.query(
      `SELECT u.id, u.full_name, u.email, u.role,
              dp.is_anonymous, dp.pseudonym, dp.title, dp.created_at
       FROM doubt_posts dp
       JOIN users u ON dp.author_id = u.id
       WHERE dp.id = $1`,
      [postId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doubt post not found' });
    }

    res.json({
      author: result.rows[0],
    });
  } catch (err) {
    console.error('[ClassPulse Doubts] Error revealing author:', err);
    res.status(500).json({ error: 'Failed to reveal author' });
  }
});

/**
 * POST /doubts/helpful
 * Toggle helpful mark on a Post or Reply.
 */
router.post('/helpful', authenticateToken, async (req, res) => {
  try {
    const { target_type, target_id } = req.body;

    if (!target_type || !['POST', 'REPLY'].includes(target_type) || !target_id) {
      return res.status(400).json({ error: 'target_type (POST/REPLY) and target_id are required' });
    }

    const table = target_type === 'POST' ? 'doubt_posts' : 'doubt_replies';

    // Check if user already marked helpful
    const checkRes = await db.query(
      'SELECT id FROM doubt_helpful_marks WHERE user_id = $1 AND target_type = $2 AND target_id = $3',
      [req.user.id, target_type, target_id]
    );

    let marked = false;
    let newCount = 0;

    if (checkRes.rows.length > 0) {
      // Remove mark
      await db.query(
        'DELETE FROM doubt_helpful_marks WHERE user_id = $1 AND target_type = $2 AND target_id = $3',
        [req.user.id, target_type, target_id]
      );
      const updateRes = await db.query(
        `UPDATE ${table} SET helpful_count = GREATEST(0, helpful_count - 1) WHERE id = $1 RETURNING helpful_count`,
        [target_id]
      );
      marked = false;
      newCount = updateRes.rows[0]?.helpful_count || 0;
    } else {
      // Add mark
      await db.query(
        'INSERT INTO doubt_helpful_marks (user_id, target_type, target_id) VALUES ($1, $2, $3)',
        [req.user.id, target_type, target_id]
      );
      const updateRes = await db.query(
        `UPDATE ${table} SET helpful_count = helpful_count + 1 WHERE id = $1 RETURNING helpful_count`,
        [target_id]
      );
      marked = true;
      newCount = updateRes.rows[0]?.helpful_count || 1;
    }

    res.json({
      marked,
      helpful_count: newCount,
    });
  } catch (err) {
    console.error('[ClassPulse Doubts] Error toggling helpful:', err);
    res.status(500).json({ error: 'Failed to update helpful mark' });
  }
});

/**
 * POST /doubts/replies/:id/accept-solution
 * Mark or unmark a reply as the accepted solution (by post author or teacher).
 */
router.post('/replies/:id/accept-solution', authenticateToken, async (req, res) => {
  try {
    const replyId = req.params.id;

    // Verify reply and parent post ownership
    const checkRes = await db.query(
      `SELECT dr.*, dp.author_id as post_author_id
       FROM doubt_replies dr
       JOIN doubt_posts dp ON dr.doubt_post_id = dp.id
       WHERE dr.id = $1`,
      [replyId]
    );

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Reply not found' });
    }

    const reply = checkRes.rows[0];
    const isPostAuthor = reply.post_author_id === req.user.id;
    const isTeacher = req.user.role === 'teacher';

    if (!isPostAuthor && !isTeacher) {
      return res.status(403).json({ error: 'Only the doubt author or a teacher can accept a solution' });
    }

    const newSolutionState = !reply.is_solution;

    // Reset other solutions on the same post if marking true
    if (newSolutionState) {
      await db.query(
        'UPDATE doubt_replies SET is_solution = FALSE WHERE doubt_post_id = $1',
        [reply.doubt_post_id]
      );
      await db.query(
        'UPDATE doubt_posts SET status = \'RESOLVED\' WHERE id = $1',
        [reply.doubt_post_id]
      );
    } else {
      await db.query(
        'UPDATE doubt_posts SET status = \'OPEN\' WHERE id = $1',
        [reply.doubt_post_id]
      );
    }

    const updateRes = await db.query(
      'UPDATE doubt_replies SET is_solution = $1 WHERE id = $2 RETURNING *',
      [newSolutionState, replyId]
    );

    res.json({
      message: newSolutionState ? 'Reply marked as accepted solution' : 'Reply unmarked as solution',
      reply: updateRes.rows[0],
      post_status: newSolutionState ? 'RESOLVED' : 'OPEN',
    });
  } catch (err) {
    console.error('[ClassPulse Doubts] Error accepting solution:', err);
    res.status(500).json({ error: 'Failed to update accepted solution' });
  }
});

/**
 * POST /doubts/replies/:id/endorse
 * Role: Teacher
 * Teacher endorses an answer.
 */
router.post('/replies/:id/endorse', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const replyId = req.params.id;

    const replyRes = await db.query('SELECT * FROM doubt_replies WHERE id = $1', [replyId]);
    if (replyRes.rows.length === 0) {
      return res.status(404).json({ error: 'Reply not found' });
    }

    const newEndorsedState = !replyRes.rows[0].is_teacher_endorsed;

    const updateRes = await db.query(
      'UPDATE doubt_replies SET is_teacher_endorsed = $1 WHERE id = $2 RETURNING *',
      [newEndorsedState, replyId]
    );

    res.json({
      message: newEndorsedState ? 'Reply endorsed by teacher' : 'Teacher endorsement removed',
      reply: updateRes.rows[0],
    });
  } catch (err) {
    console.error('[ClassPulse Doubts] Error endorsing reply:', err);
    res.status(500).json({ error: 'Failed to endorse reply' });
  }
});

module.exports = router;
