import { describe, expect, it } from 'vitest';
import {
  formatAcl,
  formatPercent,
  recordsForClassroom,
} from './attendanceFormat';
import type { AttendanceRecord } from './studentTypes';

describe('attendance formatting', () => {
  it('formats percentages and missing values', () => {
    expect(formatPercent(100)).toBe('100%');
    expect(formatPercent(66.666)).toBe('66.7%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(Number.NaN)).toBe('—');
  });

  it('formats ACL values', () => {
    expect(formatAcl(0)).toBe('0 ms');
    expect(formatAcl(850)).toBe('850 ms');
    expect(formatAcl(1500)).toBe('1.50 s');
    expect(formatAcl(null)).toBe('—');
    expect(formatAcl(-1)).toBe('—');
  });

  it('groups records by classroom', () => {
    const records = [
      { classroom_id: 'a' },
      { classroom_id: 'b' },
      { classroom_id: 'a' },
    ] as AttendanceRecord[];
    expect(recordsForClassroom(records, 'a')).toHaveLength(2);
    expect(recordsForClassroom(records, 'missing')).toHaveLength(0);
  });
});
