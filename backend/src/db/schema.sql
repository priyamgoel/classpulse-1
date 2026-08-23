CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code  TEXT UNIQUE NOT NULL,
  course_name  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classrooms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  teacher_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_name TEXT NOT NULL,
  join_code    TEXT UNIQUE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enrollments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id  UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (classroom_id, student_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id  UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scan_started_at   TIMESTAMPTZ NOT NULL,
  validated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  status            TEXT NOT NULL DEFAULT 'PRESENT',
  UNIQUE (session_id, student_id)
);

-- Seed predefined course catalog if empty (Spec requirement: course-code catalog)
INSERT INTO courses (course_code, course_name)
VALUES 
  ('UCS503P', 'Software Engineering Lab'),
  ('UCS405', 'Discrete Mathematical Structures'),
  ('UCS301', 'Data Structures & Algorithms'),
  ('UCS507', 'Computer Networks')
ON CONFLICT (course_code) DO NOTHING;
