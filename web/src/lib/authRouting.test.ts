import { describe, expect, it } from 'vitest';
import {
  isAuthPage,
  isStudentArea,
  loginPathForPath,
  roleHomePath,
} from './authRouting';

describe('authRouting', () => {
  it('recognizes the student area', () => {
    expect(isStudentArea('/student')).toBe(true);
    expect(isStudentArea('/student/')).toBe(true);
    expect(isStudentArea('/student/scan')).toBe(true);
    expect(isStudentArea('/students')).toBe(false);
    expect(isStudentArea('/')).toBe(false);
  });

  it('sends each surface to its own login page', () => {
    expect(loginPathForPath('/student')).toBe('/student/login');
    expect(loginPathForPath('/student/doubts/123')).toBe('/student/login');
    expect(loginPathForPath('/')).toBe('/login');
    expect(loginPathForPath('/login')).toBe('/login');
  });

  it('detects auth pages to avoid redirect loops', () => {
    expect(isAuthPage('/login')).toBe(true);
    expect(isAuthPage('/signup')).toBe(true);
    expect(isAuthPage('/student/login')).toBe(true);
    expect(isAuthPage('/student/signup')).toBe(true);
    expect(isAuthPage('/student')).toBe(false);
    expect(isAuthPage('/student/scan')).toBe(false);
  });

  it('maps roles to their home surface', () => {
    expect(roleHomePath('student')).toBe('/student');
    expect(roleHomePath('teacher')).toBe('/');
    expect(roleHomePath(null)).toBe('/');
    expect(roleHomePath(undefined)).toBe('/');
  });
});
