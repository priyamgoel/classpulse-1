const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { buildApp } = require('./helpers/app');
const { setHandler, reset } = require('./helpers/mockDb');
const { start, request } = require('./helpers/http');
const { users, makeToken } = require('./helpers/token');

const CLASSROOM = '99999999-9999-4999-8999-999999999999';
const COURSE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STUDENT = users.student.id;

let server;
let base;

before(async () => {
  const { app } = buildApp();
  const started = await start(app);
  server = started.server;
  base = started.base;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => reset());

test('only teachers can create a classroom', async () => {
  const res = await request(base, 'POST', '/classrooms', {
    token: makeToken(),
    body: { course_id: COURSE, section_name: '3CSE1' },
  });
  assert.equal(res.status, 403);
});

test('classroom creation rejects an unknown course', async () => {
  setHandler(async (sql) => {
    if (/select \* from courses/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/classrooms', {
    token: makeToken(users.teacher),
    body: { course_id: COURSE, section_name: '3CSE1' },
  });
  assert.equal(res.status, 404);
});

test('classroom creation returns a generated 6-character join code', async () => {
  setHandler(async (sql, params) => {
    if (/select \* from courses/i.test(sql)) {
      return { rows: [{ id: COURSE, course_code: 'UCS503P', course_name: 'Software Engineering Lab' }] };
    }
    if (/select id from classrooms where join_code/i.test(sql)) return { rows: [] };
    if (/insert into classrooms/i.test(sql)) {
      return {
        rows: [
          {
            id: CLASSROOM,
            course_id: params[0],
            teacher_id: params[1],
            section_name: params[2],
            join_code: params[3],
            created_at: new Date().toISOString(),
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/classrooms', {
    token: makeToken(users.teacher),
    body: { course_id: COURSE, section_name: '  3CSE1  ' },
  });

  assert.equal(res.status, 201);
  assert.match(res.body.classroom.join_code, /^[A-Z2-9]{6}$/);
  assert.equal(res.body.classroom.section_name, '3CSE1');
  assert.equal(res.body.classroom.teacher_name, users.teacher.full_name);
});

test('joining with an invalid code returns 404', async () => {
  setHandler(async () => ({ rows: [] }));
  const res = await request(base, 'POST', '/classrooms/join', {
    token: makeToken(),
    body: { join_code: 'ZZZZZZ' },
  });
  assert.equal(res.status, 404);
});

test('joining twice returns 409', async () => {
  setHandler(async (sql) => {
    if (/from classrooms c/i.test(sql)) {
      return {
        rows: [{ id: CLASSROOM, course_code: 'UCS503P', course_name: 'SE Lab', teacher_name: 'T' }],
      };
    }
    if (/from enrollments/i.test(sql)) return { rows: [{ id: 'enrollment' }] };
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/classrooms/join', {
    token: makeToken(),
    body: { join_code: 'abc234' },
  });
  assert.equal(res.status, 409);
});

test('a student can join a valid classroom', async () => {
  let inserted = false;
  setHandler(async (sql) => {
    if (/from classrooms c/i.test(sql)) {
      return {
        rows: [{ id: CLASSROOM, course_code: 'UCS503P', course_name: 'SE Lab', teacher_name: 'T' }],
      };
    }
    if (/from enrollments/i.test(sql)) return { rows: [] };
    if (/insert into enrollments/i.test(sql)) {
      inserted = true;
      return { rows: [] };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/classrooms/join', {
    token: makeToken(),
    body: { join_code: 'abc234' },
  });
  assert.equal(res.status, 200);
  assert.equal(inserted, true);
});

test('the roster is visible only to the owning teacher', async () => {
  setHandler(async (sql) => {
    if (/select \* from classrooms where id/i.test(sql)) {
      return { rows: [{ id: CLASSROOM, teacher_id: users.teacher.id }] };
    }
    if (/from enrollments en/i.test(sql)) {
      return {
        rows: [
          {
            student_id: STUDENT,
            full_name: users.student.full_name,
            email: users.student.email,
            joined_at: new Date().toISOString(),
          },
        ],
      };
    }
    return { rows: [] };
  });

  const owner = await request(base, 'GET', `/classrooms/${CLASSROOM}/roster`, {
    token: makeToken(users.teacher),
  });
  assert.equal(owner.status, 200);
  assert.equal(owner.body.roster.length, 1);

  const other = await request(base, 'GET', `/classrooms/${CLASSROOM}/roster`, {
    token: makeToken(users.otherTeacher),
  });
  assert.equal(other.status, 403);
});

test('unrelated teachers cannot delete a classroom', async () => {
  setHandler(async (sql) => {
    if (/select \* from classrooms where id/i.test(sql)) {
      return { rows: [{ id: CLASSROOM, teacher_id: users.teacher.id }] };
    }
    return { rows: [] };
  });

  const res = await request(base, 'DELETE', `/classrooms/${CLASSROOM}`, {
    token: makeToken(users.otherTeacher),
  });
  assert.equal(res.status, 403);
});

test('the owner can delete a classroom inside a transaction', async () => {
  const statements = [];
  setHandler(async (sql) => {
    const normalized = sql.replace(/\s+/g, ' ').trim().toUpperCase();
    statements.push(normalized);
    if (/select \* from classrooms where id/i.test(sql)) {
      return { rows: [{ id: CLASSROOM, teacher_id: users.teacher.id }] };
    }
    return { rows: [] };
  });

  const res = await request(base, 'DELETE', `/classrooms/${CLASSROOM}`, {
    token: makeToken(users.teacher),
  });
  assert.equal(res.status, 200);
  assert.ok(statements.includes('BEGIN'));
  assert.ok(statements.includes('COMMIT'));
});

test('a student can leave a classroom they are enrolled in', async () => {
  setHandler(async (sql) => {
    if (/from enrollments/i.test(sql)) return { rows: [{ id: 'enrollment' }] };
    return { rows: [] };
  });

  const res = await request(base, 'DELETE', `/classrooms/${CLASSROOM}/leave`, {
    token: makeToken(),
  });
  assert.equal(res.status, 200);
});

test('a student cannot leave a classroom they are not enrolled in', async () => {
  setHandler(async () => ({ rows: [] }));
  const res = await request(base, 'DELETE', `/classrooms/${CLASSROOM}/leave`, {
    token: makeToken(),
  });
  assert.equal(res.status, 404);
});

const classroomRow = {
  id: CLASSROOM,
  course_id: COURSE,
  teacher_id: users.teacher.id,
  section_name: '3CSE1',
  join_code: 'ABC234',
  course_code: 'UCS503P',
  course_name: 'SE Lab',
  teacher_name: users.teacher.full_name,
  student_count: 30,
};

function summaryHandler({ enrolled }) {
  return async (sql) => {
    if (/select c\.\*, co\.course_code/i.test(sql)) {
      return { rows: [{ ...classroomRow }] };
    }
    if (/select 1 from enrollments/i.test(sql)) {
      return { rows: enrolled ? [{ '?column?': 1 }] : [] };
    }
    if (/from sessions s/i.test(sql)) return { rows: [{ total_sessions: 2, avg_turnout_pct: 50 }] };
    if (/from pulsemeters/i.test(sql)) return { rows: [{ count: 1 }] };
    if (/from quizzes/i.test(sql)) return { rows: [{ count: 1 }] };
    if (/from live_activities/i.test(sql)) return { rows: [] };
    if (/from doubt_posts dp/i.test(sql)) {
      return { rows: [{ total_doubts: 0, open_doubts: 0, resolved_doubts: 0, total_replies: 0 }] };
    }
    return { rows: [] };
  };
}

test('a non-member cannot read a classroom summary', async () => {
  setHandler(summaryHandler({ enrolled: false }));

  const res = await request(base, 'GET', `/classrooms/${CLASSROOM}/summary`, {
    token: makeToken(users.otherStudent),
  });

  assert.equal(res.status, 403);
});

test('an enrolled student can read the summary without the join code', async () => {
  setHandler(summaryHandler({ enrolled: true }));

  const res = await request(base, 'GET', `/classrooms/${CLASSROOM}/summary`, {
    token: makeToken(users.student),
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.classroom.id, CLASSROOM);
  assert.equal(res.body.classroom.join_code, undefined);
});

test('the owning teacher can read the summary with the join code', async () => {
  setHandler(summaryHandler({ enrolled: false }));

  const res = await request(base, 'GET', `/classrooms/${CLASSROOM}/summary`, {
    token: makeToken(users.teacher),
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.classroom.join_code, 'ABC234');
});
