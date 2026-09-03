import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const NEXORA_ROLE_COOKIE = 'nexora_role';

type GuardRule = {
  prefix: string;
  requiredRole: string;
  loginPath: string;
  publicPaths: string[];
};

const GUARD_RULES: GuardRule[] = [
  {
    prefix: '/dashboard',
    requiredRole: 'admin',
    loginPath: '/admin/login',
    publicPaths: [],
  },
  {
    prefix: '/doctor',
    requiredRole: 'doctor',
    loginPath: '/doctor/login',
    publicPaths: ['/doctor/login'],
  },
  {
    prefix: '/staff',
    requiredRole: 'staff',
    loginPath: '/staff/login',
    publicPaths: ['/staff/login'],
  },
  {
    prefix: '/patient',
    requiredRole: 'patient',
    loginPath: '/patient/login',
    publicPaths: ['/patient/login', '/patient/auth/login'],
  },
  {
    prefix: '/vendor',
    requiredRole: 'vendor',
    loginPath: '/vendor/login',
    publicPaths: ['/vendor/login'],
  },
  {
    prefix: '/super-admin',
    requiredRole: 'super_admin',
    loginPath: '/ops/platform-root',
    publicPaths: [],
  },
];

function isPublicAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    pathname.includes('.')
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicAsset(pathname)) {
    return NextResponse.next();
  }

  const role = request.cookies.get(NEXORA_ROLE_COOKIE)?.value;

  for (const rule of GUARD_RULES) {
    if (!pathname.startsWith(rule.prefix)) continue;
    if (rule.publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return NextResponse.next();
    }

    if (role !== rule.requiredRole) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = rule.loginPath;
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/doctor/:path*',
    '/staff/:path*',
    '/patient/:path*',
    '/vendor/:path*',
    '/super-admin/:path*',
  ],
};
