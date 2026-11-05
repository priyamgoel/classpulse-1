export interface StudentUser {
  id: string;
  email: string;
  full_name: string;
  role: 'student' | 'teacher';
  created_at?: string;
}

export interface Classroom {
  id: string;
  course_id: string;
  course_code: string;
  course_name: string;
  section_name: string;
  teacher_name: string;
  join_code?: string;
  student_count: number;
  attendance_avg_rate?: number | null;
  quiz_count?: number;
  pulsemeter_count?: number;
  open_doubts_count?: number;
  resolved_doubts_count?: number;
}

export interface Topic {
  id: string;
  name: string;
}

export type PulseMeterType = 'WORD_CLOUD' | 'MCQ' | 'RATING_SCALE';

export interface PulseMeterConfig {
  prompt?: string;
  options?: Array<{ id: string; text: string }>;
  min?: number;
  max?: number;
  low_label?: string;
  high_label?: string;
}

export interface PulseMeterDetails {
  title: string;
  type: PulseMeterType;
  config: PulseMeterConfig;
}

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  question_text: string;
  options: QuizOption[];
  order_index?: number;
  time_limit_seconds?: number;
}

export interface QuizCurrentQuestion {
  question_id: string;
  question_index: number | null;
  start_time_ms: number;
  end_time_ms: number;
  revealed: boolean;
  correct_option_id?: string | null;
}

export interface QuizDetails {
  title: string;
  scoring_mode: 'WIDE' | 'NARROW' | string;
  question_count: number;
  questions: QuizQuestion[];
}

export interface QuizAnswer {
  question_id: string;
  selected_option_id: string;
  is_correct?: boolean;
  score_awarded?: number;
}

export interface ActivityUserResponse {
  has_responded?: boolean;
  response_value?: unknown;
  answered_count?: number;
  answered_questions?: QuizAnswer[];
  cumulative_score?: number;
}

export interface ActiveActivity {
  id: string;
  classroom_id: string;
  activity_type: 'PULSEMETER' | 'QUIZ';
  activity_ref_id?: string;
  status: string;
  started_at?: string;
  pulsemeter?: PulseMeterDetails | null;
  quiz?: QuizDetails | null;
  current_question?: QuizCurrentQuestion | null;
  user_response?: ActivityUserResponse | null;
  user_answers?: QuizAnswer[];
  score_so_far?: number;
}

export interface ActiveActivityResponse {
  active: boolean;
  activity: ActiveActivity | null;
  user_answers?: QuizAnswer[];
  score_so_far?: number;
}

export interface QuizReviewItem {
  question_id: string;
  question_text: string;
  selected_option_id?: string | null;
  correct_option_id?: string | null;
  is_correct?: boolean;
  score_awarded?: number;
}

export interface QuizResults {
  title?: string;
  score: number;
  correct_count: number;
  answered_count: number;
  total_questions: number;
  rank: number;
  participants: number;
  questions?: QuizReviewItem[];
}

export interface AttendanceOverall {
  total_sessions: number;
  attended_sessions: number;
  attendance_percentage: number;
}

export interface AttendanceSummary {
  classroom_id: string;
  course_code: string;
  course_name: string;
  section_name: string;
  teacher_name: string;
  total_sessions: number;
  attended_sessions: number;
  attendance_percentage: number;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  status: string;
  validated_at?: string | null;
  scan_started_at?: string | null;
  session_started_at?: string | null;
  session_ended_at?: string | null;
  classroom_id: string;
  section_name?: string;
  course_code?: string;
  course_name?: string;
  teacher_name?: string;
  acl_ms?: number | null;
}

export interface AttendanceOverview {
  overall: AttendanceOverall;
  summary: AttendanceSummary[];
  records: AttendanceRecord[];
}

export type DoubtScope = 'CLASSROOM' | 'COURSE' | 'APP';
export type DoubtStatus = 'OPEN' | 'RESOLVED' | string;

export interface DoubtPost {
  id: string;
  course_id: string;
  classroom_id?: string | null;
  topic_id?: string | null;
  author_id?: string | null;
  audience_scope: DoubtScope;
  title: string;
  body: string;
  is_anonymous: boolean;
  pseudonym?: string | null;
  status: DoubtStatus;
  helpful_count: number;
  created_at: string;
  updated_at?: string;
  topic_name?: string | null;
  course_code?: string;
  course_name?: string;
  author_display_name?: string;
  author_real_name?: string | null;
  author_role?: string;
  reply_count?: number;
  has_accepted_solution?: boolean;
  user_has_marked_helpful?: boolean;
  headline?: string;
}

export interface DoubtReply {
  id: string;
  doubt_post_id?: string;
  author_id?: string | null;
  body: string;
  is_anonymous: boolean;
  pseudonym?: string | null;
  is_solution: boolean;
  is_teacher_endorsed: boolean;
  helpful_count: number;
  created_at: string;
  updated_at?: string;
  author_display_name?: string;
  user_has_marked_helpful?: boolean;
}

export interface DoubtDetailResponse {
  post: DoubtPost;
  replies: DoubtReply[];
}

export interface DoubtsQuery {
  courseId?: string;
  classroomId?: string;
  scope?: string;
  topicId?: string | null;
  status?: string;
  sortBy?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateDoubtPayload {
  course_id: string;
  classroom_id: string | null;
  topic_id: string | null;
  audience_scope: DoubtScope;
  title: string;
  body: string;
  is_anonymous: boolean;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function asString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = asNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeClassroom(raw: unknown): Classroom {
  const item = asRecord(raw);
  return {
    id: asString(item.id),
    course_id: asString(item.course_id),
    course_code: asString(item.course_code),
    course_name: asString(item.course_name),
    section_name: asString(item.section_name),
    teacher_name: asString(item.teacher_name),
    join_code: item.join_code ? asString(item.join_code) : undefined,
    student_count: asNumber(item.student_count),
    attendance_avg_rate: asNullableNumber(item.attendance_avg_rate),
    quiz_count: asNumber(item.quiz_count),
    pulsemeter_count: asNumber(item.pulsemeter_count),
    open_doubts_count: asNumber(item.open_doubts_count),
    resolved_doubts_count: asNumber(item.resolved_doubts_count),
  };
}

export function normalizeAttendance(raw: unknown): AttendanceOverview {
  const data = asRecord(raw);
  const overall = asRecord(data.overall);
  return {
    overall: {
      total_sessions: asNumber(overall.total_sessions),
      attended_sessions: asNumber(overall.attended_sessions),
      attendance_percentage: asNumber(overall.attendance_percentage),
    },
    summary: asArray(data.summary).map((entry) => {
      const item = asRecord(entry);
      return {
        classroom_id: asString(item.classroom_id),
        course_code: asString(item.course_code),
        course_name: asString(item.course_name),
        section_name: asString(item.section_name),
        teacher_name: asString(item.teacher_name),
        total_sessions: asNumber(item.total_sessions),
        attended_sessions: asNumber(item.attended_sessions),
        attendance_percentage: asNumber(item.attendance_percentage),
      };
    }),
    records: asArray(data.records).map((entry) => {
      const item = asRecord(entry);
      return {
        id: asString(item.id),
        session_id: asString(item.session_id),
        status: asString(item.status, 'ABSENT'),
        validated_at: item.validated_at ? asString(item.validated_at) : null,
        scan_started_at: item.scan_started_at
          ? asString(item.scan_started_at)
          : null,
        session_started_at: item.session_started_at
          ? asString(item.session_started_at)
          : null,
        session_ended_at: item.session_ended_at
          ? asString(item.session_ended_at)
          : null,
        classroom_id: asString(item.classroom_id),
        section_name: asString(item.section_name),
        course_code: asString(item.course_code),
        course_name: asString(item.course_name),
        teacher_name: asString(item.teacher_name),
        acl_ms: asNullableNumber(item.acl_ms),
      };
    }),
  };
}
