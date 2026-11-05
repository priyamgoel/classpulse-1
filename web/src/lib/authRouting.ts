export type UserRole = 'teacher' | 'student';

/** True for `/student` and everything below it. */
export function isStudentArea(pathname: string): boolean {
  return pathname === '/student' || pathname.startsWith('/student/');
}

/** The login page that belongs to the current surface. */
export function loginPathForPath(pathname: string): string {
  return isStudentArea(pathname) ? '/student/login' : '/login';
}

/** Pages where a 401 must not trigger a redirect loop. */
export function isAuthPage(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/student/login' ||
    pathname === '/student/signup' ||
    pathname.startsWith('/login/') ||
    pathname.startsWith('/signup/') ||
    pathname.startsWith('/student/login/') ||
    pathname.startsWith('/student/signup/')
  );
}

/** Where a freshly authenticated user belongs. */
export function roleHomePath(role: UserRole | string | null | undefined): string {
  return role === 'student' ? '/student' : '/';
}
