const crypto = require('crypto');
const db = require('../db');
const { getRedisClient } = require('../redis');

const HMAC_SECRET = process.env.QR_HMAC_SECRET || process.env.JWT_SECRET || 'classpulse_anti_proxy_secret_key_2026';
const TOKEN_TTL_SECONDS = 15;
const MAX_TOKEN_AGE_MS = 10000; // 10s freshness window per technical specification

// Helper to compute HMAC-SHA256 signature
function computeHmac(payloadString) {
  return crypto.createHmac('sha256', HMAC_SECRET).update(payloadString).digest('hex');
}

/**
 * Generates a signed, timestamped 3-QR token batch for an active session
 * @param {string} sessionId
 * @returns {Promise<{ batch_id: string, timestamp: number, tokens: Array }>}
 */
async function generate3QrSequence(sessionId) {
  const redis = getRedisClient();
  const batchId = crypto.randomUUID();
  const timestamp = Date.now();

  const tokens = [];
  for (let seqIdx = 0; seqIdx < 3; seqIdx++) {
    const tokenId = crypto.randomBytes(8).toString('hex');
    const signaturePayload = `${sessionId}:${batchId}:${seqIdx}:${timestamp}:${tokenId}`;
    const hash = computeHmac(signaturePayload);

    tokens.push({
      session_id: sessionId,
      batch_id: batchId,
      seq_idx: seqIdx,
      timestamp,
      token_id: tokenId,
      hash,
    });
  }

  // Cache in Redis with 15-second expiration
  const redisKey = `session:${sessionId}:batch:${batchId}`;
  await redis.set(redisKey, JSON.stringify({ batchId, timestamp, tokens }), 'EX', TOKEN_TTL_SECONDS);
  await redis.set(`session:${sessionId}:latest_batch`, batchId, 'EX', TOKEN_TTL_SECONDS);

  return {
    batch_id: batchId,
    timestamp,
    expires_in_seconds: TOKEN_TTL_SECONDS,
    tokens,
  };
}

/**
 * Validates a submitted 3-QR token sequence and marks attendance
 * @param {Object} params
 * @param {string} params.sessionId
 * @param {Array} params.tokens
 * @param {string|Date} params.scanStartedAt
 * @param {string} params.studentId
 */
async function validateAndMarkAttendance({ sessionId, tokens, scanStartedAt, studentId }) {
  const validatedAt = new Date();

  // 1. Structure check: must have exactly 3 tokens
  if (!Array.isArray(tokens) || tokens.length !== 3) {
    return {
      valid: false,
      statusCode: 400,
      error: 'Invalid scan sequence: Exactly 3 rotating tokens are required.',
    };
  }

  // 2. Sequence ordering check: index 0, 1, 2
  for (let i = 0; i < 3; i++) {
    if (tokens[i].seq_idx !== i) {
      return {
        valid: false,
        statusCode: 400,
        error: `Sequence ordering violation: Expected token index ${i}, received ${tokens[i].seq_idx}.`,
      };
    }
  }

  const batchId = tokens[0].batch_id;
  const tokenTimestamp = Number(tokens[0].timestamp);

  // 3. Consistency check across tokens
  for (let i = 0; i < 3; i++) {
    if (tokens[i].batch_id !== batchId || tokens[i].session_id !== sessionId) {
      return {
        valid: false,
        statusCode: 400,
        error: 'Token batch mismatch: Tokens belong to different batches or sessions.',
      };
    }
  }

  // 4. Freshness check: <= 10 seconds age
  const now = Date.now();
  const tokenAgeMs = now - tokenTimestamp;
  if (tokenAgeMs > MAX_TOKEN_AGE_MS || tokenAgeMs < -2000) { // allow 2s clock drift
    return {
      valid: false,
      statusCode: 400,
      error: `Token expired: QR code is ${Math.round(tokenAgeMs / 1000)}s old (max allowed freshness is 10s).`,
    };
  }

  // 5. Cryptographic signature check (HMAC-SHA256)
  for (let i = 0; i < 3; i++) {
    const signaturePayload = `${sessionId}:${batchId}:${i}:${tokens[i].timestamp}:${tokens[i].token_id}`;
    const expectedHash = computeHmac(signaturePayload);

    if (tokens[i].hash !== expectedHash) {
      return {
        valid: false,
        statusCode: 400,
        error: `Cryptographic verification failed: Token at index ${i} has an invalid HMAC signature.`,
      };
    }
  }

  // 6. Redis active token check
  const redis = getRedisClient();
  const redisKey = `session:${sessionId}:batch:${batchId}`;
  const cachedBatch = await redis.get(redisKey);
  if (!cachedBatch) {
    return {
      valid: false,
      statusCode: 400,
      error: 'Token no longer active in Redis cache: QR code sequence has rotated out.',
    };
  }

  // 7. Database session state check
  const sessionResult = await db.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
  if (sessionResult.rows.length === 0) {
    return { valid: false, statusCode: 404, error: 'Attendance session not found.' };
  }

  const session = sessionResult.rows[0];
  if (session.ended_at) {
    return { valid: false, statusCode: 400, error: 'This attendance session has already ended.' };
  }

  // 8. Classroom enrollment check
  const enrollResult = await db.query(
    'SELECT id FROM enrollments WHERE classroom_id = $1 AND student_id = $2',
    [session.classroom_id, studentId]
  );
  if (enrollResult.rows.length === 0) {
    return {
      valid: false,
      statusCode: 403,
      error: 'Forbidden: You are not enrolled in the classroom section for this session.',
    };
  }

  // 9. Duplicate attendance check
  const existingRecord = await db.query(
    'SELECT id FROM attendance_records WHERE session_id = $1 AND student_id = $2',
    [sessionId, studentId]
  );
  if (existingRecord.rows.length > 0) {
    return {
      valid: false,
      statusCode: 409,
      error: 'Conflict: Attendance has already been marked for this student in this session.',
    };
  }

  // 10. Parse scan_started_at and calculate Attendance Capture Latency (ACL)
  const scanStartedDate = scanStartedAt ? new Date(scanStartedAt) : validatedAt;
  const aclMs = Math.max(0, validatedAt.getTime() - scanStartedDate.getTime());

  // 11. Insert record into attendance_records
  const insertResult = await db.query(
    `INSERT INTO attendance_records (session_id, student_id, scan_started_at, validated_at, status)
     VALUES ($1, $2, $3, $4, 'PRESENT')
     RETURNING *`,
    [sessionId, studentId, scanStartedDate.toISOString(), validatedAt.toISOString()]
  );

  return {
    valid: true,
    statusCode: 200,
    message: 'Attendance validated and marked PRESENT',
    record: insertResult.rows[0],
    acl_ms: aclMs,
  };
}

module.exports = {
  generate3QrSequence,
  validateAndMarkAttendance,
  TOKEN_TTL_SECONDS,
  MAX_TOKEN_AGE_MS,
};
