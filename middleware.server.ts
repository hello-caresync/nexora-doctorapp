import { NextResponse, type NextRequest } from 'next/server';

/** Disabled for static export (`output: 'export'`). Restore as `middleware.ts` for Node/server deploys. */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/super-vault-access') ||
    pathname.startsWith('/doctor') ||
    pathname.startsWith('/patient')
  ) {
    return NextResponse.next();
  }

  const sessionToken =
    request.cookies.get('curasync_session')?.value ||
    request.cookies.get('sb-access-token')?.value ||
    request.cookies.get('auth-token')?.value;

  if (!sessionToken && pathname.startsWith('/dashboard')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', '/dashboard');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
