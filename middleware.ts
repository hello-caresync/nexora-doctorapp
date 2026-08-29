import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Static assets & internal routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // 2. Allow /login and public routes unconditionally
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/super-vault-access') ||
    pathname.startsWith('/doctor') ||
    pathname.startsWith('/patient')
  ) {
    return NextResponse.next();
  }

  // 3. Check for session tokens
  const sessionToken =
    request.cookies.get('curasync_session')?.value ||
    request.cookies.get('sb-access-token')?.value ||
    request.cookies.get('auth-token')?.value;

  // 4. Protect /dashboard: Redirect unauthenticated requests to /login
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
