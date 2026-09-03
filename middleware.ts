import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_LOGIN_PATHS = [
  '/',
  '/ops/platform-root',
  '/super-admin/login',
  '/admin/login',
  '/doctor/login',
  '/staff/login',
  '/patient/login',
  '/vendor/login',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_LOGIN_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function isSuperAdminSession(request: NextRequest): boolean {
  const roleCookie = request.cookies.get('nexora_role')?.value;
  if (roleCookie === 'super_admin') return true;

  const vaultSession = request.cookies.get('nexora_superadmin_session')?.value;
  if (vaultSession) return true;

  const legacySession = request.cookies.get('curasync_superadmin_session')?.value;
  return Boolean(legacySession);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Always pass public static assets, api routes, and designated login gates
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') ||
    isPublicPath(pathname)
  ) {
    return NextResponse.next();
  }

  // 2. Guard Super Admin Vault and dashboard
  if (
    pathname.startsWith('/super-vault-access') ||
    pathname.startsWith('/super-admin/dashboard')
  ) {
    if (!isSuperAdminSession(request)) {
      const loginUrl = new URL('/ops/platform-root', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/super-vault-access/:path*',
    '/super-admin/:path*',
    '/dashboard/:path*',
    '/doctor/:path*',
    '/staff/:path*',
    '/patient/:path*',
    '/vendor/:path*',
  ],
};
