const express = require('express');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /live-activities/:id/end
 * Role: Teacher
 * End the currently active live activity (PulseMeter or Quiz).
 * Sets status to ENDED, emits activity:ended via Socket.io.
 */
router.post('/:id/end', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const activityId = req.params.id;

    // Verify the activity exists, is ACTIVE, and teacher owns the classroom
    const activityCheck = await db.query(
      `SELECT la.*, c.teacher_id, c.id as cid
       FROM live_activities la
       JOIN classrooms c ON la.classroom_id = c.id
       WHERE la.id = $1`,
      [activityId]
    );

    if (activityCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Live activity not found' });
    }

    const activity = activityCheck.rows[0];

    if (activity.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You do not own this classroom' });
    }

    if (activity.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Activity is not currently active' });
    }

    // End the activity
    const endResult = await db.query(
      `UPDATE live_activities
       SET status = 'ENDED', ended_at = now()
       WHERE id = $1
       RETURNING *`,
      [activityId]
    );

    // Get final response count
    const countResult = await db.query(
      'SELECT COUNT(*)::int as total FROM pulsemeter_responses WHERE live_activity_id = $1',
      [activityId]
    );

    // Emit activity:ended to classroom
    const io = req.app.get('io');
    io.to(`classroom_${activity.classroom_id}`).emit('activity:ended', {
      activityId,
      activityType: activity.activity_type,
    });

    res.json({
      message: 'Live activity ended successfully',
      activity: endResult.rows[0],
      totalResponses: countResult.rows[0].total,
    });
  } catch (err) {
    console.error('[ClassPulse LiveActivity] Error ending activity:', err);
    res.status(500).json({ error: 'Failed to end live activity' });
  }
});

/**
 * POST /live-activities/:id/respond
 * Role: Student (enrolled)
 * Submit a PulseMeter response. Validates enrollment, active status, mute status,
 * and uniqueness. Emits live aggregated results to the teacher via Socket.io.
 */
router.post('/:id/respond', authenticateToken, async (req, res) => {
  try {
    const activityId = req.params.id;
    const { response_value } = req.body;

    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can submit responses' });
    }

    if (!response_value && response_value !== 0) {
      return res.status(400).json({ error: 'response_value is required' });
    }

    // Fetch the live activity, pulsemeter details, and classroom
    const activityCheck = await db.query(
      `SELECT la.*, p.type as pm_type, p.config as pm_config, p.title as pm_title
       FROM live_activities la
       JOIN pulsemeters p ON la.activity_ref_id = p.id
       WHERE la.id = $1 AND la.activity_type = 'PULSEMETER'`,
      [activityId]
    );

    if (activityCheck.rows.length === 0) {
      return res.status(404).json({ error: 'PulseMeter activity not found' });
    }

    const activity = activityCheck.rows[0];

    if (activity.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'This PulseMeter is no longer active' });
    }

    // Verify student is enrolled in the classroom
    const enrollmentCheck = await db.query(
      'SELECT id FROM enrollments WHERE classroom_id = $1 AND student_id = $2',
      [activity.classroom_id, req.user.id]
    );

    if (enrollmentCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not enrolled in this classroom' });
    }

    // For WORD_CLOUD: check if student is muted
    if (activity.pm_type === 'WORD_CLOUD') {
      const muteCheck = await db.query(
        `SELECT id FROM word_cloud_mutes
         WHERE student_id = $1 AND classroom_id = $2 AND muted_until > now()
         LIMIT 1`,
        [req.user.id, activity.classroom_id]
      );

      if (muteCheck.rows.length > 0) {
        return res.status(403).json({
          error: 'You are currently muted from word-cloud participation in this classroom',
        });
      }
    }

    // Validate response_value based on type
    const responseStr = String(response_value).trim();
    if (!responseStr) {
      return res.status(400).json({ error: 'Response cannot be empty' });
    }

    if (activity.pm_type === 'MCQ') {
      const validOptionIds = (activity.pm_config.options || []).map((o) => o.id);
      if (!validOptionIds.includes(responseStr)) {
        return res.status(400).json({ error: `Invalid option. Must be one of: ${validOptionIds.join(', ')}` });
      }
    } else if (activity.pm_type === 'RATING_SCALE') {
      const rating = parseInt(responseStr, 10);
      if (isNaN(rating) || rating < (activity.pm_config.min || 1) || rating > (activity.pm_config.max || 5)) {
        return res.status(400).json({
          error: `Rating must be between ${activity.pm_config.min || 1} and ${activity.pm_config.max || 5}`,
        });
      }
    }

    // Insert response (unique constraint prevents duplicates)
    try {
      await db.query(
        `INSERT INTO pulsemeter_responses (live_activity_id, student_id, response_value)
         VALUES ($1, $2, $3)`,
        [activityId, req.user.id, responseStr]
      );
    } catch (insertErr) {
      if (insertErr.constraint === 'pulsemeter_responses_live_activity_id_student_id_key') {
        return res.status(409).json({ error: 'You have already responded to this PulseMeter' });
      }
      throw insertErr;
    }

    // Compute aggregated results for live broadcast
    const aggregated = await computeAggregatedResults(activityId, activity);

    // Emit live results to teacher
    const io = req.app.get('io');
    io.to(`activity_${activityId}_teacher`).emit('pulsemeter:results', {
      activityId,
      ...aggregated,
    });

    io.to(`activity_${activityId}_teacher`).emit('activity:response_count', {
      activityId,
      responseCount: aggregated.responseCount,
      presentCount: aggregated.presentCount,
      attendancePending: aggregated.attendancePending,
    });

    res.status(201).json({
      message: 'Response submitted successfully',
    });
  } catch (err) {
    console.error('[ClassPulse LiveActivity] Error submitting response:', err);
    res.status(500).json({ error: 'Failed to submit response' });
  }
});

/**
 * GET /live-activities/:id/analytics
 * Role: Teacher
 * Returns present-vs-responded data and type-specific distribution charts.
 */
router.get('/:id/analytics', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const activityId = req.params.id;

    // Fetch activity + pulsemeter + classroom ownership
    const activityCheck = await db.query(
      `SELECT la.*, p.id as pm_id, p.title as pm_title, p.type as pm_type, p.config as pm_config,
              c.teacher_id
       FROM live_activities la
       JOIN pulsemeters p ON la.activity_ref_id = p.id
       JOIN classrooms c ON la.classroom_id = c.id
       WHERE la.id = $1 AND la.activity_type = 'PULSEMETER'`,
      [activityId]
    );

    if (activityCheck.rows.length === 0) {
      return res.status(404).json({ error: 'PulseMeter activity not found' });
    }

    const activity = activityCheck.rows[0];

    if (activity.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const aggregated = await computeAggregatedResults(activityId, activity);

    res.json({
      pulsemeter: {
        id: activity.pm_id,
        title: activity.pm_title,
        type: activity.pm_type,
        config: activity.pm_config,
      },
      liveActivity: {
        id: activity.id,
        classroom_id: activity.classroom_id,
        status: activity.status,
        started_at: activity.started_at,
        ended_at: activity.ended_at,
        attendance_session_id: activity.attendance_session_id,
        attendance_pending: activity.attendance_pending,
      },
      ...aggregated,
    });
  } catch (err) {
    console.error('[ClassPulse LiveActivity] Error fetching analytics:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /live-activities/active?classroom_id=...
 * Role: Any authenticated user
 * Check if there's a currently active live activity (PulseMeter or Quiz) for a classroom.
 */
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const { classroom_id } = req.query;

    if (!classroom_id) {
      return res.status(400).json({ error: 'classroom_id query parameter is required' });
    }

    const result = await db.query(
      `SELECT la.*,
              p.title as pm_title, p.type as pm_type, p.config as pm_config,
              q.title as quiz_title, q.scoring_mode as quiz_scoring_mode
       FROM live_activities la
       LEFT JOIN pulsemeters p ON la.activity_ref_id = p.id AND la.activity_type = 'PULSEMETER'
       LEFT JOIN quizzes q ON la.activity_ref_id = q.id AND la.activity_type = 'QUIZ'
       WHERE la.classroom_id = $1 AND la.status = 'ACTIVE'
       LIMIT 1`,
      [classroom_id]
    );

    if (result.rows.length === 0) {
      return res.json({ active: false, activity: null });
    }

    const row = result.rows[0];

    let quizDetails = null;
    if (row.activity_type === 'QUIZ' && row.quiz_title) {
      const qRes = await db.query(
        `SELECT id, question_text, options, order_index, time_limit_seconds
         FROM quiz_questions
         WHERE quiz_id = $1
         ORDER BY order_index ASC`,
        [row.activity_ref_id]
      );
      quizDetails = {
        title: row.quiz_title,
        scoring_mode: row.quiz_scoring_mode,
        question_count: qRes.rows.length,
        questions: qRes.rows,
      };
    }

    res.json({
      active: true,
      activity: {
        id: row.id,
        classroom_id: row.classroom_id,
        activity_type: row.activity_type,
        activity_ref_id: row.activity_ref_id,
        status: row.status,
        started_at: row.started_at,
        pulsemeter: row.pm_title ? {
          title: row.pm_title,
          type: row.pm_type,
          config: row.pm_config,
        } : null,
        quiz: quizDetails,
      },
    });
  } catch (err) {
    console.error('[ClassPulse LiveActivity] Error checking active activity:', err);
    res.status(500).json({ error: 'Failed to check active activity' });
  }
});

// In-memory tracker for active quiz questions and server start timestamps
// Key: `${activityId}_${questionId}` -> { startTimeMs: number, timeLimitSeconds: number }
const activeQuestionTimers = new Map();

/**
 * POST /live-activities/:id/quiz/start-question
 * Role: Teacher
 * Start a specific quiz question with server-authoritative countdown.
 * Broadcasts quiz:question_start to classroom.
 */
router.post('/:id/quiz/start-question', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const activityId = req.params.id;
    const { question_id, question_index } = req.body;

    // Verify activity is an active QUIZ owned by the teacher
    const activityCheck = await db.query(
      `SELECT la.*, c.teacher_id
       FROM live_activities la
       JOIN classrooms c ON la.classroom_id = c.id
       WHERE la.id = $1 AND la.activity_type = 'QUIZ'`,
      [activityId]
    );

    if (activityCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Active Live Quiz not found' });
    }

    const activity = activityCheck.rows[0];
    if (activity.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (activity.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Quiz activity is no longer active' });
    }

    // Fetch the question
    let question;
    if (question_id) {
      const qRes = await db.query('SELECT * FROM quiz_questions WHERE id = $1 AND quiz_id = $2', [question_id, activity.activity_ref_id]);
      if (qRes.rows.length === 0) return res.status(404).json({ error: 'Question not found' });
      question = qRes.rows[0];
    } else {
      const idx = question_index !== undefined ? question_index : 0;
      const qRes = await db.query(
        'SELECT * FROM quiz_questions WHERE quiz_id = $1 ORDER BY order_index ASC LIMIT 1 OFFSET $2',
        [activity.activity_ref_id, idx]
      );
      if (qRes.rows.length === 0) return res.status(404).json({ error: 'Question index out of bounds' });
      question = qRes.rows[0];
    }

    const startTimeMs = Date.now();
    const timeLimitSeconds = question.time_limit_seconds || 20;
    const endTimeMs = startTimeMs + (timeLimitSeconds * 1000);

    // Save timer key
    activeQuestionTimers.set(`${activityId}_${question.id}`, {
      startTimeMs,
      timeLimitSeconds,
      endTimeMs,
    });

    // Broadcast question to all students in the classroom without revealing correct_option_id
    const io = req.app.get('io');
    io.to(`classroom_${activity.classroom_id}`).emit('quiz:question_start', {
      activityId,
      questionIndex: question.order_index,
      question: {
        id: question.id,
        question_text: question.question_text,
        options: question.options,
        time_limit_seconds: timeLimitSeconds,
        order_index: question.order_index,
      },
      startTimeMs,
      endTimeMs,
    });

    res.json({
      message: 'Question started successfully',
      questionId: question.id,
      questionIndex: question.order_index,
      startTimeMs,
      endTimeMs,
      timeLimitSeconds,
    });
  } catch (err) {
    console.error('[ClassPulse LiveQuiz] Error starting question:', err);
    res.status(500).json({ error: 'Failed to start question' });
  }
});

/**
 * POST /live-activities/:id/quiz/answer
 * Role: Student
 * Submit an answer to the currently active quiz question.
 * Applies time-weighted scoring formula (Section 4a) using server-clock measurement.
 */
router.post('/:id/quiz/answer', authenticateToken, async (req, res) => {
  try {
    const activityId = req.params.id;
    const { question_id, selected_option_id } = req.body;

    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can submit quiz answers' });
    }

    if (!question_id || !selected_option_id) {
      return res.status(400).json({ error: 'question_id and selected_option_id are required' });
    }

    // Verify activity is ACTIVE
    const activityCheck = await db.query(
      `SELECT la.*, q.scoring_mode
       FROM live_activities la
       JOIN quizzes q ON la.activity_ref_id = q.id
       WHERE la.id = $1 AND la.activity_type = 'QUIZ'`,
      [activityId]
    );

    if (activityCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Live Quiz not found' });
    }

    const activity = activityCheck.rows[0];
    if (activity.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Quiz is no longer active' });
    }

    // Verify student is enrolled
    const enrollmentCheck = await db.query(
      'SELECT id FROM enrollments WHERE classroom_id = $1 AND student_id = $2',
      [activity.classroom_id, req.user.id]
    );

    if (enrollmentCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not enrolled in this classroom' });
    }

    // Fetch question to verify correct answer
    const questionCheck = await db.query(
      'SELECT * FROM quiz_questions WHERE id = $1 AND quiz_id = $2',
      [question_id, activity.activity_ref_id]
    );

    if (questionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const question = questionCheck.rows[0];
    const cleanSelected = String(selected_option_id).toLowerCase().trim();
    const cleanCorrect = String(question.correct_option_id).toLowerCase().trim();
    const isCorrect = cleanSelected === cleanCorrect;

    // Calculate response time from server question start timer
    const timerInfo = activeQuestionTimers.get(`${activityId}_${question_id}`);
    const nowMs = Date.now();
    let responseTimeMs = 1000; // default fallback
    let timeLimit = question.time_limit_seconds || 20;

    if (timerInfo) {
      responseTimeMs = Math.max(0, nowMs - timerInfo.startTimeMs);
      timeLimit = timerInfo.timeLimitSeconds || timeLimit;
    }

    const responseTimeSeconds = responseTimeMs / 1000;

    // Section 4a Scoring Formula
    // Fraction remaining f = max(0, min(1, (T - response_time_seconds) / T))
    let scoreAwarded = 0;
    if (isCorrect) {
      const f = Math.max(0, Math.min(1, (timeLimit - responseTimeSeconds) / timeLimit));
      if (activity.scoring_mode === 'NARROW') {
        // NARROW mode: 700 + 300 * f
        scoreAwarded = Math.round(700 + 300 * f);
      } else {
        // WIDE mode (Default): 300 + 700 * f
        scoreAwarded = Math.round(300 + 700 * f);
      }
    }

    // Insert response into quiz_responses table
    try {
      await db.query(
        `INSERT INTO quiz_responses (live_activity_id, question_id, student_id, selected_option_id, is_correct, response_time_ms, score_awarded)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [activityId, question_id, req.user.id, cleanSelected, isCorrect, responseTimeMs, scoreAwarded]
      );
    } catch (insertErr) {
      if (insertErr.constraint === 'quiz_responses_live_activity_id_question_id_student_id_key') {
        return res.status(409).json({ error: 'You have already submitted an answer for this question' });
      }
      throw insertErr;
    }

    // Get live response count for this question
    const countRes = await db.query(
      'SELECT COUNT(*)::int as total FROM quiz_responses WHERE live_activity_id = $1 AND question_id = $2',
      [activityId, question_id]
    );

    // Emit live answer tick to teacher room
    const io = req.app.get('io');
    io.to(`activity_${activityId}_teacher`).emit('quiz:live_answers', {
      activityId,
      questionId: question_id,
      answeredCount: countRes.rows[0].total,
    });

    res.status(201).json({
      message: 'Answer submitted successfully',
      is_correct: isCorrect,
      score_awarded: scoreAwarded,
      response_time_ms: responseTimeMs,
      correct_option_id: question.correct_option_id,
    });
  } catch (err) {
    console.error('[ClassPulse LiveQuiz] Error submitting answer:', err);
    res.status(500).json({ error: 'Failed to submit quiz answer' });
  }
});

/**
 * POST /live-activities/:id/quiz/show-results
 * Role: Teacher
 * Reveals answer, broadcasts option distribution, and sends updated cumulative leaderboard.
 */
router.post('/:id/quiz/show-results', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const activityId = req.params.id;
    const { question_id } = req.body;

    const activityCheck = await db.query(
      `SELECT la.*, c.teacher_id
       FROM live_activities la
       JOIN classrooms c ON la.classroom_id = c.id
       WHERE la.id = $1 AND la.activity_type = 'QUIZ'`,
      [activityId]
    );

    if (activityCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Live Quiz not found' });
    }

    const activity = activityCheck.rows[0];
    if (activity.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Fetch question
    const qCheck = await db.query('SELECT * FROM quiz_questions WHERE id = $1', [question_id]);
    if (qCheck.rows.length === 0) return res.status(404).json({ error: 'Question not found' });
    const question = qCheck.rows[0];

    // Compute distribution for this question
    const distRes = await db.query(
      `SELECT selected_option_id, COUNT(*)::int as count
       FROM quiz_responses
       WHERE live_activity_id = $1 AND question_id = $2
       GROUP BY selected_option_id`,
      [activityId, question_id]
    );

    const options = question.options || [];
    const distribution = options.map((opt) => ({
      option_id: opt.id,
      option_text: opt.text,
      count: distRes.rows.find((r) => r.selected_option_id === opt.id)?.count || 0,
      is_correct: opt.id === question.correct_option_id,
    }));

    // Compute cumulative leaderboard
    const leaderboard = await computeQuizLeaderboard(activityId);

    // Broadcast question results and leaderboard to classroom
    const io = req.app.get('io');
    io.to(`classroom_${activity.classroom_id}`).emit('quiz:question_results', {
      activityId,
      questionId: question_id,
      correct_option_id: question.correct_option_id,
      distribution,
      leaderboard,
    });

    res.json({
      questionId: question_id,
      correct_option_id: question.correct_option_id,
      distribution,
      leaderboard,
    });
  } catch (err) {
    console.error('[ClassPulse LiveQuiz] Error showing results:', err);
    res.status(500).json({ error: 'Failed to show results' });
  }
});

/**
 * GET /live-activities/:id/quiz/leaderboard
 * Role: Any authenticated user in classroom
 * Retrieve the current cumulative leaderboard for a live quiz.
 */
router.get('/:id/quiz/leaderboard', authenticateToken, async (req, res) => {
  try {
    const activityId = req.params.id;
    const leaderboard = await computeQuizLeaderboard(activityId);
    res.json({ activityId, leaderboard });
  } catch (err) {
    console.error('[ClassPulse LiveQuiz] Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

/**
 * POST /live-activities/:id/quiz/end
 * Role: Teacher
 * Conclude the live quiz session, finalize leaderboard, and broadcast quiz:ended.
 */
router.post('/:id/quiz/end', authenticateToken, requireRole('teacher'), async (req, res) => {
  try {
    const activityId = req.params.id;

    const activityCheck = await db.query(
      `SELECT la.*, c.teacher_id, c.id as cid
       FROM live_activities la
       JOIN classrooms c ON la.classroom_id = c.id
       WHERE la.id = $1 AND la.activity_type = 'QUIZ'`,
      [activityId]
    );

    if (activityCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Live Quiz not found' });
    }

    const activity = activityCheck.rows[0];
    if (activity.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // End activity
    const endRes = await db.query(
      `UPDATE live_activities
       SET status = 'ENDED', ended_at = now()
       WHERE id = $1
       RETURNING *`,
      [activityId]
    );

    const finalLeaderboard = await computeQuizLeaderboard(activityId);

    // Broadcast quiz:ended to classroom
    const io = req.app.get('io');
    io.to(`classroom_${activity.classroom_id}`).emit('quiz:ended', {
      activityId,
      finalLeaderboard,
      podium: finalLeaderboard.slice(0, 3),
    });

    res.json({
      message: 'Quiz session concluded successfully',
      activity: endRes.rows[0],
      finalLeaderboard,
      podium: finalLeaderboard.slice(0, 3),
    });
  } catch (err) {
    console.error('[ClassPulse LiveQuiz] Error ending quiz:', err);
    res.status(500).json({ error: 'Failed to end quiz session' });
  }
});

/**
 * Helper: Compute cumulative leaderboard for a quiz activity.
 */
async function computeQuizLeaderboard(activityId) {
  const result = await db.query(
    `SELECT qr.student_id,
            u.full_name as student_name,
            u.email as student_email,
            SUM(qr.score_awarded)::int as total_score,
            COUNT(CASE WHEN qr.is_correct THEN 1 END)::int as correct_count,
            COUNT(qr.id)::int as total_answered,
            ROUND(AVG(qr.response_time_ms))::int as avg_response_time_ms
     FROM quiz_responses qr
     JOIN users u ON qr.student_id = u.id
     WHERE qr.live_activity_id = $1
     GROUP BY qr.student_id, u.full_name, u.email
     ORDER BY total_score DESC, avg_response_time_ms ASC`,
    [activityId]
  );

  return result.rows.map((row, idx) => ({
    rank: idx + 1,
    ...row,
  }));
}

/**
 * Helper: Compute aggregated PulseMeter results for charts.
 */
async function computeAggregatedResults(activityId, activity) {
  // Response count
  const countResult = await db.query(
    'SELECT COUNT(*)::int as total FROM pulsemeter_responses WHERE live_activity_id = $1',
    [activityId]
  );
  const responseCount = countResult.rows[0].total;

  // Present count from linked attendance session
  let presentCount = null;
  const attendancePending = activity.attendance_pending;

  if (activity.attendance_session_id) {
    const presentResult = await db.query(
      'SELECT COUNT(*)::int as total FROM attendance_records WHERE session_id = $1',
      [activity.attendance_session_id]
    );
    presentCount = presentResult.rows[0].total;
  }

  // Type-specific distribution
  let distribution = [];

  if (activity.pm_type === 'MCQ') {
    // Count per option
    const distResult = await db.query(
      `SELECT response_value as option_id, COUNT(*)::int as count
       FROM pulsemeter_responses
       WHERE live_activity_id = $1
       GROUP BY response_value
       ORDER BY response_value`,
      [activityId]
    );

    const options = activity.pm_config.options || [];
    distribution = options.map((opt) => ({
      option_id: opt.id,
      option_text: opt.text,
      count: distResult.rows.find((r) => r.option_id === opt.id)?.count || 0,
    }));
  } else if (activity.pm_type === 'RATING_SCALE') {
    // Count per rating value
    const min = activity.pm_config.min || 1;
    const max = activity.pm_config.max || 5;

    const distResult = await db.query(
      `SELECT response_value as rating, COUNT(*)::int as count
       FROM pulsemeter_responses
       WHERE live_activity_id = $1
       GROUP BY response_value`,
      [activityId]
    );

    for (let i = min; i <= max; i++) {
      distribution.push({
        rating: i,
        count: distResult.rows.find((r) => String(r.rating) === String(i))?.count || 0,
      });
    }
  } else if (activity.pm_type === 'WORD_CLOUD') {
    // Count per word, sorted by frequency
    const distResult = await db.query(
      `SELECT LOWER(TRIM(response_value)) as word, COUNT(*)::int as count
       FROM pulsemeter_responses
       WHERE live_activity_id = $1
       GROUP BY LOWER(TRIM(response_value))
       ORDER BY count DESC, word ASC
       LIMIT 100`,
      [activityId]
    );
    distribution = distResult.rows;
  }

  return { responseCount, presentCount, attendancePending, distribution };
}

module.exports = router;
