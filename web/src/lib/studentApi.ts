import { apiFetch, readJson } from '@/lib/api';
import {
  asArray,
  asNumber,
  asRecord,
  asString,
  normalizeAttendance,
  normalizeClassroom,
  type ActiveActivityResponse,
  type AttendanceOverview,
  type Classroom,
  type CreateDoubtPayload,
  type DoubtDetailResponse,
  type DoubtPost,
  type DoubtReply,
  type DoubtsQuery,
  type QuizResults,
  type StudentUser,
  type Topic,
} from '@/lib/studentTypes';

const REQUEST_TIMEOUT_MS = 10_000;

export class StudentApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'StudentApiError';
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await apiFetch(path, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const data = (await readJson<Record<string, unknown>>(response)) ?? {};

  if (!response.ok) {
    throw new StudentApiError(
      asString(data.error, `Request failed (HTTP ${response.status})`),
      response.status
    );
  }

  return data as T;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function buildDoubtsPath(query: DoubtsQuery): string {
  const params = new URLSearchParams();

  if (query.courseId) params.set('course_id', query.courseId);
  if (query.classroomId) params.set('classroom_id', query.classroomId);
  if (query.scope) params.set('scope', query.scope);
  if (query.topicId) params.set('topic_id', query.topicId);
  if (query.status && query.status !== 'ALL') {
    params.set('status', query.status);
  }
  if (query.limit) params.set('limit', String(query.limit));
  if (query.offset) params.set('offset', String(query.offset));

  const search = query.search?.trim();
  if (search) {
    params.set('q', search);
    return `/search?${params.toString()}`;
  }

  if (query.sortBy) params.set('sort_by', query.sortBy);
  return `/doubts?${params.toString()}`;
}

export async function getMe(): Promise<StudentUser> {
  const data = await request<{ user: StudentUser }>('/auth/me');
  return data.user;
}

export async function getClassrooms(): Promise<Classroom[]> {
  const data = await request<{ classrooms?: unknown[] }>('/classrooms/mine');
  return asArray(data.classrooms).map(normalizeClassroom);
}

export async function joinClassroom(
  joinCode: string
): Promise<{ message: string }> {
  return request<{ message: string }>(
    '/classrooms/join',
    jsonInit('POST', { join_code: joinCode.trim().toUpperCase() })
  );
}

export async function leaveClassroom(
  classroomId: string
): Promise<{ message: string }> {
  return request<{ message: string }>(
    `/classrooms/${encodeURIComponent(classroomId)}/leave`,
    { method: 'DELETE' }
  );
}

export async function getActiveActivity(
  classroomId: string
): Promise<ActiveActivityResponse> {
  return request<ActiveActivityResponse>(
    `/live-activities/active?classroom_id=${encodeURIComponent(classroomId)}`
  );
}

export async function respondToPulseMeter(
  activityId: string,
  responseValue: string | number
): Promise<{ message?: string }> {
  return request<{ message?: string }>(
    `/live-activities/${encodeURIComponent(activityId)}/respond`,
    jsonInit('POST', { response_value: responseValue })
  );
}

export async function submitQuizAnswer(
  activityId: string,
  questionId: string,
  selectedOptionId: string
): Promise<{ is_correct?: boolean; score_awarded?: number }> {
  return request<{ is_correct?: boolean; score_awarded?: number }>(
    `/live-activities/${encodeURIComponent(activityId)}/quiz/answer`,
    jsonInit('POST', {
      question_id: questionId,
      selected_option_id: selectedOptionId,
    })
  );
}

export async function getQuizResults(
  activityId: string
): Promise<QuizResults> {
  const data = await request<Record<string, unknown>>(
    `/live-activities/${encodeURIComponent(activityId)}/quiz/my-results`
  );

  return {
    title: data.title ? asString(data.title) : undefined,
    score: asNumber(data.score),
    correct_count: asNumber(data.correct_count),
    answered_count: asNumber(data.answered_count),
    total_questions: asNumber(data.total_questions),
    rank: asNumber(data.rank),
    participants: asNumber(data.participants),
    questions: asArray(data.questions) as QuizResults['questions'],
  };
}

export interface AttendanceScanResult {
  message?: string;
  acl_ms?: number;
  record?: {
    status?: string;
    validated_at?: string;
  };
}

export async function submitAttendanceScan(payload: {
  session_id: string;
  tokens: unknown[];
  scan_started_at: string | null;
}): Promise<AttendanceScanResult> {
  return request<AttendanceScanResult>(
    '/attendance/scan',
    jsonInit('POST', payload)
  );
}

export async function getAttendance(): Promise<AttendanceOverview> {
  const data = await request<Record<string, unknown>>('/attendance/me');
  return normalizeAttendance(data);
}

export async function getTopics(courseId: string): Promise<Topic[]> {
  const data = await request<{ topics?: unknown[] }>(
    `/courses/${encodeURIComponent(courseId)}/topics`
  );
  return asArray(data.topics).map((entry) => {
    const item = asRecord(entry);
    return { id: asString(item.id), name: asString(item.name) };
  });
}

export async function createTopic(
  courseId: string,
  name: string
): Promise<Topic> {
  const data = await request<{ topic?: unknown }>(
    `/courses/${encodeURIComponent(courseId)}/topics`,
    jsonInit('POST', { name: name.trim() })
  );
  const topic = asRecord(data.topic);
  return { id: asString(topic.id), name: asString(topic.name) };
}

export async function getDoubts(query: DoubtsQuery): Promise<DoubtPost[]> {
  const data = await request<Record<string, unknown>>(buildDoubtsPath(query));
  const list = data.results ?? data.posts;
  return asArray<DoubtPost>(list);
}

export async function getDoubt(id: string): Promise<DoubtDetailResponse> {
  const data = await request<Record<string, unknown>>(
    `/doubts/${encodeURIComponent(id)}`
  );
  return {
    post: asRecord(data.post) as unknown as DoubtPost,
    replies: asArray<DoubtReply>(data.replies),
  };
}

export async function createDoubt(
  payload: CreateDoubtPayload
): Promise<DoubtPost> {
  const data = await request<{ post?: unknown }>(
    '/doubts',
    jsonInit('POST', payload)
  );
  return (data.post ?? {}) as DoubtPost;
}

export async function updateDoubt(
  id: string,
  updates: { title: string; body: string }
): Promise<{ message?: string }> {
  return request<{ message?: string }>(
    `/doubts/${encodeURIComponent(id)}`,
    jsonInit('PUT', updates)
  );
}

export async function deleteDoubt(id: string): Promise<{ message?: string }> {
  return request<{ message?: string }>(
    `/doubts/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
}

export async function createReply(
  doubtId: string,
  body: string,
  isAnonymous: boolean
): Promise<DoubtReply> {
  const data = await request<{ reply?: unknown }>(
    `/doubts/${encodeURIComponent(doubtId)}/replies`,
    jsonInit('POST', { body: body.trim(), is_anonymous: isAnonymous })
  );
  return (data.reply ?? {}) as DoubtReply;
}

export async function updateReply(
  replyId: string,
  body: string
): Promise<{ message?: string }> {
  return request<{ message?: string }>(
    `/doubts/replies/${encodeURIComponent(replyId)}`,
    jsonInit('PUT', { body: body.trim() })
  );
}

export async function deleteReply(
  replyId: string
): Promise<{ message?: string }> {
  return request<{ message?: string }>(
    `/doubts/replies/${encodeURIComponent(replyId)}`,
    { method: 'DELETE' }
  );
}

export async function acceptSolution(
  replyId: string
): Promise<{ message?: string; post_status?: string }> {
  return request<{ message?: string; post_status?: string }>(
    `/doubts/replies/${encodeURIComponent(replyId)}/accept-solution`,
    { method: 'POST' }
  );
}

export async function toggleHelpful(
  targetType: 'POST' | 'REPLY',
  targetId: string
): Promise<{ marked: boolean; helpful_count: number }> {
  return request<{ marked: boolean; helpful_count: number }>(
    '/doubts/helpful',
    jsonInit('POST', { target_type: targetType, target_id: targetId })
  );
}
