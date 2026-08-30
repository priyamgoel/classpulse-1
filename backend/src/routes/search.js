const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /search
 * Audience-Scoped Full-Text Search across doubt questions and discussion content.
 * Powered by PostgreSQL tsvector GIN indexing, ts_rank relevance scoring, and ts_headline highlighting.
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      q,
      course_id,
      classroom_id,
      scope,
      topic_id,
      status,
      limit = 20,
      offset = 0,
    } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query parameter "q" is required.' });
    }

    const cleanQuery = q.trim();
    const ilikePattern = `%${cleanQuery}%`;

    let conditions = [];
    let params = [cleanQuery, ilikePattern];
    let paramIdx = 3;

    // Full-text match condition with ILIKE fallback for partial words
    conditions.push(`(
      dp.search_vector @@ plainto_tsquery('english', $1)
      OR dp.title ILIKE $2
      OR dp.body ILIKE $2
      OR dp.pseudonym ILIKE $2
      OR ct.name ILIKE $2
      OR c.course_code ILIKE $2
      OR c.course_name ILIKE $2
    )`);

    // Audience Scope Filtering
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
      // Default view in classroom context
      conditions.push(`(dp.classroom_id = $${paramIdx} OR dp.audience_scope IN ('APP', 'COURSE'))`);
      params.push(classroom_id);
      paramIdx++;
    } else if (course_id) {
      conditions.push(`(dp.course_id = $${paramIdx} OR dp.audience_scope = 'APP')`);
      params.push(course_id);
      paramIdx++;
    }

    // Topic Filter
    if (topic_id) {
      conditions.push(`dp.topic_id = $${paramIdx}`);
      params.push(topic_id);
      paramIdx++;
    }

    // Status Filter
    if (status && status !== 'ALL') {
      conditions.push(`dp.status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }

    // Current user for helpful mark check
    const currentUserIdParam = `$${paramIdx}`;
    params.push(req.user.id);
    paramIdx++;

    const limitParam = `$${paramIdx}`;
    params.push(parseInt(limit, 10) || 20);
    paramIdx++;

    const offsetParam = `$${paramIdx}`;
    params.push(parseInt(offset, 10) || 0);

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
             ts_rank(dp.search_vector, plainto_tsquery('english', $1)) as rank_score,
             ts_headline('english', dp.body, plainto_tsquery('english', $1), 'StartSel=<b>, StopSel=</b>, MaxWords=35, MinWords=15') as headline,
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
      ORDER BY rank_score DESC, dp.helpful_count DESC, dp.created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const result = await db.query(query, params);

    const results = result.rows.map((post) => {
      const isAuthor = post.author_id === req.user.id;
      const isTeacher = req.user.role === 'teacher';

      return {
        ...post,
        author_display_name: post.is_anonymous
          ? (post.pseudonym || 'Anonymous Peer')
          : post.author_real_name,
        author_real_name: (!post.is_anonymous || isAuthor || isTeacher) ? post.author_real_name : null,
      };
    });

    res.json({
      query: cleanQuery,
      total: results.length,
      results,
    });
  } catch (err) {
    console.error('[ClassPulse Search] Error executing full-text search:', err);
    res.status(500).json({ error: 'Search execution failed.' });
  }
});

module.exports = router;
