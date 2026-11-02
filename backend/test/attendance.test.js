const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { buildApp } = require('./helpers/app');
const { setHandler, reset, calls } = require('./helpers/mockDb');
const { resetRedis } = require('./helpers/mockRedis');
const { start, request } = require('./helpers/http');
const { users, makeToken } = require('./helpers/token');
const { generate3QrSequence } = require('../src/services/qrTokenService');

const SESSION = '77777777-7777-4777-8777-777777777777';
const CLASSROOM = '88888888-8888-4888-8888-888888888888';
const STUDENT = users.student.id;

let server;
let base;
let io;

before(async () => {
  const built = buildApp();
  io = built.io;
  const started = await start(built.app);
  server = started.server;
  base = started.base;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  reset();
  resetRedis();
  io.events.length = 0;
});

function hmac(payload) {
  return crypto
    .createHmac('sha256', process.env.QR_HMAC_SECRET)
    .update(payload)
    .digest('hex');
}

function ageBatch(batch, timestamp) {
  return {
    ...batch,
    timestamp,
    tokens: batch.tokens.map((token, index) => ({
      ...token,
      timestamp,
      hash: hmac(`${SESSION}:${token.batch_id}:${index}:${timestamp}:${token.token_id}`),
    })),
  };
}

function scanDbHandler() {
  return async (sql, params) => {
    if (/from sessions where id/i.test(sql)) {
      return {
        rows: [{ id: SESSION, classroom_id: CLASSROOM, ended_at: null }],
      };
    }
    if (/from enrollments/i.test(sql)) return { rows: [{ id: 'enrollment' }] };
    if (/from attendance_records/i.test(sql)) return { rows: [] };
    if (/insert into attendance_records/i.test(sql)) {
      return {
        rows: [
          {
            id: 'record-1',
            session_id: SESSION,
            student_id: STUDENT,
            scan_started_at: params[2],
            validated_at: params[3],
            status: 'PRESENT',
          },
        ],
      };
    }
    return { rows: [] };
  };
}

test('attendance scan requires session_id and tokens', async () => {
  const res = await request(base, 'POST', '/attendance/scan', {
    token: makeToken(),
    body: { session_id: SESSION },
  });
  assert.equal(res.status, 400);
});

test('a valid scan returns 200 and broadcasts attendance:marked', async () => {
  const batch = await generate3QrSequence(SESSION);
  const timestamp = Date.now() - 3000;
  const aged = ageBatch(batch, timestamp);
  setHandler(scanDbHandler());

  const res = await request(base, 'POST', '/attendance/scan', {
    token: makeToken(),
    body: {
      session_id: SESSION,
      tokens: aged.tokens,
      scan_started_at: new Date(timestamp + 1000).toISOString(),
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.record.status, 'PRESENT');
  assert.ok(res.body.acl_ms >= 1500);

  const event = io.events.find((e) => e.event === 'attendance:marked');
  assert.ok(event, 'expected attendance:marked to be emitted');
  assert.equal(event.room, `session_${SESSION}`);
  assert.equal(event.payload.student.id, STUDENT);
});

test('an invalid scan is rejected with the service status code', async () => {
  setHandler(scanDbHandler());
  const res = await request(base, 'POST', '/attendance/scan', {
    token: makeToken(),
    body: { session_id: SESSION, tokens: [{ seq_idx: 0 }] },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /Exactly 3/);
});

test('only the owning teacher can read the live session roster', async () => {
  setHandler(async (sql) => {
    if (/from sessions s/i.test(sql)) {
      return {
        rows: [
          {
            id: SESSION,
            classroom_id: CLASSROOM,
            teacher_id: users.teacher.id,
            ended_at: null,
            course_code: 'UCS503P',
            course_name: 'Software Engineering Lab',
            section_name: '3CSE1',
          },
        ],
      };
    }
    if (/from attendance_records ar/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const owner = await request(base, 'GET', `/attendance/session/${SESSION}`, {
    token: makeToken(users.teacher),
  });
  assert.equal(owner.status, 200);
  assert.equal(owner.body.total_present, 0);

  const other = await request(base, 'GET', `/attendance/session/${SESSION}`, {
    token: makeToken(users.otherTeacher),
  });
  assert.equal(other.status, 403);
});

test('students can read their own attendance overview', async () => {
  setHandler(async (sql) => {
    if (/from attendance_records ar/i.test(sql)) return { rows: [] };
    if (/from enrollments en/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const res = await request(base, 'GET', '/attendance/me', { token: makeToken() });
  assert.equal(res.status, 200);
  assert.equal(res.body.overall.total_sessions, 0);
  assert.equal(res.body.overall.attended_sessions, 0);
  assert.equal(res.body.overall.attendance_percentage, 0);
});

test('teachers cannot call the student-only attendance overview', async () => {
  const res = await request(base, 'GET', '/attendance/me', {
    token: makeToken(users.teacher),
  });
  assert.equal(res.status, 403);
});

test('manual override validates the status value', async () => {
  const res = await request(base, 'POST', '/attendance/override', {
    token: makeToken(users.teacher),
    body: {
      classroom_id: CLASSROOM,
      session_id: SESSION,
      student_id: STUDENT,
      status: 'MAYBE',
    },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /PRESENT or ABSENT/);
});

test('manual override rejects a teacher who does not own the classroom', async () => {
  setHandler(async (sql) => {
    if (/select id from classrooms where id = \$1 and teacher_id/i.test(sql)) {
      return { rows: [] };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/attendance/override', {
    token: makeToken(users.teacher),
    body: {
      classroom_id: CLASSROOM,
      session_id: SESSION,
      student_id: STUDENT,
      status: 'PRESENT',
    },
  });
  assert.equal(res.status, 403);
});

test('manual override upserts PRESENT for an enrolled student', async () => {
  let upsertCalled = false;
  setHandler(async (sql, params) => {
    if (/select id from classrooms where id = \$1 and teacher_id/i.test(sql)) {
      return { rows: [{ id: CLASSROOM }] };
    }
    if (/select id from sessions where id = \$1 and classroom_id/i.test(sql)) {
      return { rows: [{ id: SESSION }] };
    }
    if (/select id from enrollments where classroom_id = \$1 and student_id/i.test(sql)) {
      return { rows: [{ id: 'enrollment' }] };
    }
    if (/insert into attendance_records/i.test(sql)) {
      upsertCalled = true;
      return { rows: [] };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/attendance/override', {
    token: makeToken(users.teacher),
    body: {
      classroom_id: CLASSROOM,
      session_id: SESSION,
      student_id: STUDENT,
      status: 'present',
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'PRESENT');
  assert.equal(upsertCalled, true);
});

test('manual override refuses students who are not enrolled', async () => {
  setHandler(async (sql) => {
    if (/select id from classrooms where id = \$1 and teacher_id/i.test(sql)) {
      return { rows: [{ id: CLASSROOM }] };
    }
    if (/select id from sessions where id = \$1 and classroom_id/i.test(sql)) {
      return { rows: [{ id: SESSION }] };
    }
    if (/select id from enrollments/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/attendance/override', {
    token: makeToken(users.teacher),
    body: {
      classroom_id: CLASSROOM,
      session_id: SESSION,
      student_id: STUDENT,
      status: 'ABSENT',
    },
  });
  assert.equal(res.status, 400);
});

test('classroom summary reports zero attendance when there are no sessions or students', async () => {
  setHandler(async (sql) => {
    if (/from classrooms c/i.test(sql)) {
      return { rows: [{ id: CLASSROOM, teacher_id: users.teacher.id }] };
    }
    if (/from sessions s/i.test(sql)) return { rows: [] };
    if (/from enrollments en/i.test(sql)) return { rows: [] };
    if (/from attendance_records ar/i.test(sql)) {
      return { rows: [{ overall_avg_acl_ms: null }] };
    }
    return { rows: [] };
  });

  const res = await request(base, 'GET', `/attendance/classroom/${CLASSROOM}/summary`, {
    token: makeToken(users.teacher),
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.stats.average_attendance_percentage, 0);
  assert.equal(res.body.stats.total_sessions, 0);

  const perStudentQuery = calls.find(
    (call) => /from enrollments en/i.test(call.sql) && /attendance_percentage/i.test(call.sql)
  );
  assert.ok(perStudentQuery);
  assert.match(perStudentQuery.sql, /s\.started_at >= en\.joined_at/i);
  assert.match(perStudentQuery.sql, /COUNT\(DISTINCT s\.id\)/i);
});

test('student attendance summary only counts sessions after enrollment', async () => {
  setHandler(async (sql) => {
    if (/from attendance_records ar/i.test(sql)) return { rows: [] };
    if (/from enrollments en/i.test(sql)) {
      return {
        rows: [
          {
            classroom_id: CLASSROOM,
            course_code: 'UCS503P',
            course_name: 'Software Engineering Lab',
            section_name: '3CSE1',
            teacher_name: 'Prof. Teacher',
            total_sessions: 2,
            attended_sessions: 1,
            attendance_percentage: 50,
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'GET', '/attendance/me', { token: makeToken() });

  assert.equal(res.status, 200);
  assert.equal(res.body.overall.total_sessions, 2);
  assert.equal(res.body.overall.attended_sessions, 1);
  assert.equal(res.body.overall.attendance_percentage, 50);

  const summaryQuery = calls.find(
    (call) => /from enrollments en/i.test(call.sql) && /attendance_percentage/i.test(call.sql)
  );
  assert.ok(summaryQuery);
  assert.match(summaryQuery.sql, /s\.started_at >= en\.joined_at/i);
  assert.match(summaryQuery.sql, /COUNT\(DISTINCT s\.id\)/i);
});

test('student drilldown rejects a student who is not enrolled in the classroom', async () => {
  setHandler(async (sql) => {
    if (/select teacher_id from classrooms/i.test(sql)) {
      return { rows: [{ teacher_id: users.teacher.id }] };
    }
    if (/select id, full_name, email from users/i.test(sql)) {
      return { rows: [{ id: STUDENT, full_name: 'Test Student', email: 'student@example.com' }] };
    }
    if (/from enrollments/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const res = await request(
    base,
    'GET',
    `/attendance/classroom/${CLASSROOM}/student/${STUDENT}`,
    { token: makeToken(users.teacher) }
  );

  assert.equal(res.status, 400);
  assert.match(res.body.error, /not enrolled/);
});

test('attendance warning threshold must be between 0 and 100', async () => {
  const res = await request(base, 'POST', `/attendance/classroom/${CLASSROOM}/send-warnings`, {
    token: makeToken(users.teacher),
    body: { threshold: 150 },
  });

  assert.equal(res.status, 400);
  assert.match(res.body.error, /threshold/);
});
