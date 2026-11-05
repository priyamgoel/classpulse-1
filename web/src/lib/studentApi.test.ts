import { describe, expect, it } from 'vitest';
import { buildDoubtsPath } from './studentApi';

describe('buildDoubtsPath', () => {
  it('builds a regular doubt feed with filters', () => {
    const path = buildDoubtsPath({
      courseId: 'course-1',
      classroomId: 'class-1',
      scope: 'CLASSROOM',
      topicId: 'topic-1',
      status: 'OPEN',
      sortBy: 'recent',
    });

    expect(path.startsWith('/doubts?')).toBe(true);
    const params = new URLSearchParams(path.split('?')[1]);
    expect(params.get('course_id')).toBe('course-1');
    expect(params.get('classroom_id')).toBe('class-1');
    expect(params.get('scope')).toBe('CLASSROOM');
    expect(params.get('topic_id')).toBe('topic-1');
    expect(params.get('status')).toBe('OPEN');
    expect(params.get('sort_by')).toBe('recent');
    expect(params.get('q')).toBeNull();
  });

  it('uses the full-text search endpoint when a query is present', () => {
    const path = buildDoubtsPath({
      courseId: 'course-1',
      classroomId: 'class-1',
      search: '  virtual destructor  ',
      scope: 'COURSE',
    });

    expect(path.startsWith('/search?')).toBe(true);
    const params = new URLSearchParams(path.split('?')[1]);
    expect(params.get('q')).toBe('virtual destructor');
    expect(params.get('course_id')).toBe('course-1');
    expect(params.get('classroom_id')).toBe('class-1');
    expect(params.get('scope')).toBe('COURSE');
  });

  it('omits the ALL status and empty optional filters', () => {
    const path = buildDoubtsPath({
      courseId: 'course-1',
      status: 'ALL',
      topicId: null,
    });
    const params = new URLSearchParams(path.split('?')[1]);
    expect(params.get('status')).toBeNull();
    expect(params.get('topic_id')).toBeNull();
    expect(params.get('sort_by')).toBeNull();
  });
});
