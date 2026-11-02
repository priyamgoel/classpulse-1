const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { buildApp } = require('./helpers/app');
const { setHandler, reset, calls } = require('./helpers/mockDb');
const { start, request } = require('./helpers/http');
const { users, makeToken } = require('./helpers/token');

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

test('signup rejects missing fields', async () => {
  const res = await request(base, 'POST', '/auth/signup', {
    body: { email: 'a@b.com' },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /Missing required fields/);
});

test('signup rejects an invalid role', async () => {
  const res = await request(base, 'POST', '/auth/signup', {
    body: { email: 'a@b.com', password: 'secret123', full_name: 'A', role: 'admin' },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /Role must be/);
});

test('signup rejects a password shorter than 8 characters', async () => {
  const res = await request(base, 'POST', '/auth/signup', {
    body: { email: 'a@b.com', password: '1234567', full_name: 'A', role: 'student' },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /at least 8/);
});

test('signup rejects an invalid email address', async () => {
  const res = await request(base, 'POST', '/auth/signup', {
    body: { email: 'not-an-email', password: 'secret123', full_name: 'A', role: 'student' },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /valid email/i);
});

test('signup rejects an overlong full name', async () => {
  const res = await request(base, 'POST', '/auth/signup', {
    body: {
      email: 'a@b.com',
      password: 'secret123',
      full_name: 'x'.repeat(121),
      role: 'student',
    },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /Full name/);
});

test('signup returns 409 for a duplicate email', async () => {
  setHandler(async (sql) => {
    if (/select id from users/i.test(sql)) return { rows: [{ id: 'existing' }] };
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/auth/signup', {
    body: { email: 'a@b.com', password: 'secret123', full_name: 'A', role: 'student' },
  });
  assert.equal(res.status, 409);
});

test('signup hashes the password and never stores it in plaintext', async () => {
  let insertParams = null;
  setHandler(async (sql, params) => {
    if (/select id from users/i.test(sql)) return { rows: [] };
    if (/insert into users/i.test(sql)) {
      insertParams = params;
      return {
        rows: [
          {
            id: users.student.id,
            email: params[0],
            full_name: params[2],
            role: params[3],
            created_at: new Date().toISOString(),
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/auth/signup', {
    body: {
      email: '  STUDENT@Example.com ',
      password: 'secret123',
      full_name: 'Test Student',
      role: 'STUDENT',
    },
  });

  assert.equal(res.status, 201);
  assert.ok(res.body.token);
  assert.equal(insertParams[0], 'student@example.com');
  assert.equal(insertParams[3], 'student');
  assert.notEqual(insertParams[1], 'secret123');
  assert.equal(await bcrypt.compare('secret123', insertParams[1]), true);

  const decoded = jwt.decode(res.body.token);
  assert.equal(decoded.role, 'student');
  assert.equal(decoded.id, users.student.id);
});

test('teacher signup requires a matching invite code when one is configured', async () => {
  const previousCode = process.env.TEACHER_INVITE_CODE;
  process.env.TEACHER_INVITE_CODE = 'TEST-INVITE-123';

  try {
    setHandler(async (sql, params) => {
      if (/select id from users/i.test(sql)) return { rows: [] };
      if (/insert into users/i.test(sql)) {
        return {
          rows: [
            {
              id: users.teacher.id,
              email: params[0],
              full_name: params[2],
              role: params[3],
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
      return { rows: [] };
    });

    const body = {
      email: 'new.teacher@example.com',
      password: 'secret123',
      full_name: 'New Teacher',
      role: 'teacher',
    };

    const missing = await request(base, 'POST', '/auth/signup', { body });
    assert.equal(missing.status, 403);
    assert.match(missing.body.error, /invite code/i);

    const wrong = await request(base, 'POST', '/auth/signup', {
      body: { ...body, teacher_invite_code: 'not-the-code' },
    });
    assert.equal(wrong.status, 403);

    const ok = await request(base, 'POST', '/auth/signup', {
      body: { ...body, teacher_invite_code: 'TEST-INVITE-123' },
    });
    assert.equal(ok.status, 201);
    assert.equal(jwt.decode(ok.body.token).role, 'teacher');
  } finally {
    if (previousCode === undefined) delete process.env.TEACHER_INVITE_CODE;
    else process.env.TEACHER_INVITE_CODE = previousCode;
  }
});

test('teacher signup is rejected in production when no invite code is configured', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousCode = process.env.TEACHER_INVITE_CODE;
  process.env.NODE_ENV = 'production';
  delete process.env.TEACHER_INVITE_CODE;

  try {
    const res = await request(base, 'POST', '/auth/signup', {
      body: {
        email: 'new.teacher@example.com',
        password: 'secret123',
        full_name: 'New Teacher',
        role: 'teacher',
      },
    });

    assert.equal(res.status, 403);
    assert.match(res.body.error, /invite code/i);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousCode === undefined) delete process.env.TEACHER_INVITE_CODE;
    else process.env.TEACHER_INVITE_CODE = previousCode;
  }
});

test('login rejects an unknown email with 401', async () => {
  setHandler(async () => ({ rows: [] }));
  const res = await request(base, 'POST', '/auth/login', {
    body: { email: 'nobody@example.com', password: 'secret1' },
  });
  assert.equal(res.status, 401);
  assert.match(res.body.error, /Invalid email or password/);
});

test('login rejects a wrong password with 401', async () => {
  const hash = await bcrypt.hash('correct-password', 4);
  setHandler(async (sql) => {
    if (/select \* from users/i.test(sql)) {
      return {
        rows: [
          {
            id: users.student.id,
            email: users.student.email,
            full_name: users.student.full_name,
            role: 'student',
            password_hash: hash,
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/auth/login', {
    body: { email: users.student.email, password: 'wrong-password' },
  });
  assert.equal(res.status, 401);
});

test('login returns a token and never returns the password hash', async () => {
  const hash = await bcrypt.hash('correct-password', 4);
  setHandler(async (sql) => {
    if (/select \* from users/i.test(sql)) {
      return {
        rows: [
          {
            id: users.student.id,
            email: users.student.email,
            full_name: users.student.full_name,
            role: 'student',
            password_hash: hash,
            created_at: new Date().toISOString(),
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'POST', '/auth/login', {
    body: { email: users.student.email, password: 'correct-password' },
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  assert.equal(res.body.user.password_hash, undefined);
  assert.equal(res.body.user.email, users.student.email);
});

test('/auth/me requires a token', async () => {
  const res = await request(base, 'GET', '/auth/me');
  assert.equal(res.status, 401);
});

test('/auth/me rejects a token signed with the wrong secret', async () => {
  const forged = jwt.sign({ id: 'attacker', role: 'teacher' }, 'wrong-secret');
  const res = await request(base, 'GET', '/auth/me', { token: forged });
  assert.equal(res.status, 403);
});

test('/auth/me returns the current user without sensitive fields', async () => {
  setHandler(async (sql) => {
    if (/from users where id/i.test(sql)) {
      return {
        rows: [
          {
            id: users.student.id,
            email: users.student.email,
            full_name: users.student.full_name,
            role: 'student',
            created_at: new Date().toISOString(),
          },
        ],
      };
    }
    return { rows: [] };
  });

  const res = await request(base, 'GET', '/auth/me', { token: makeToken() });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.id, users.student.id);
  assert.equal(res.body.user.password_hash, undefined);
});

test('role middleware blocks a student from a teacher-only endpoint', async () => {
  const res = await request(base, 'POST', '/sessions', {
    token: makeToken({ role: 'student' }),
    body: { classroom_id: '11111111-1111-4111-8111-111111111111' },
  });
  assert.equal(res.status, 403);
  assert.match(res.body.error, /teacher/);
});

test('role middleware blocks a teacher from the student-only scan endpoint', async () => {
  const res = await request(base, 'POST', '/attendance/scan', {
    token: makeToken(users.teacher),
    body: { session_id: 'x', tokens: [] },
  });
  assert.equal(res.status, 403);
  assert.match(res.body.error, /student/);
});
