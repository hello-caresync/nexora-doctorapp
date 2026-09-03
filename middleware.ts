import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_LOGIN_ROUTES = [
  '/admin/login',
  '/doctor/login',
  '/staff/login',
  '/patient/login',
  '/patient/auth/login',
  '/vendor/login',
  '/super-admin/login',
  '/ops/platform-root',
  '/login',
];

function isPublicLoginRoute(pathname: string): boolean {
  return PUBLIC_LOGIN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. ALWAYS allow the root gateway page and public assets
  if (
    pathname === '/' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 2. Allow all public login routes without redirection
  if (isPublicLoginRoute(pathname)) {
    return NextResponse.next();
  }

  // 3. Only apply auth redirects for strictly protected paths
  const staffSession = request.cookies.get('curasync_staff_session')?.value;
  const adminSession =
    request.cookies.get('curasync_admin_session')?.value ||
    request.cookies.get('curasync_active_session')?.value ||
    (request.cookies.get('nexora_role')?.value === 'admin' ? 'authenticated' : undefined);
  const doctorSession =
    request.cookies.get('curasync_doctor_session')?.value ||
    request.cookies.get('active_doctor_session')?.value ||
    (request.cookies.get('nexora_role')?.value === 'doctor' ? 'authenticated' : undefined);
  const patientSession =
    request.cookies.get('curasync_patient_session')?.value ||
    (request.cookies.get('nexora_role')?.value === 'patient' ? 'authenticated' : undefined);
  const vendorSession =
    request.cookies.get('curasync_vendor_session')?.value ||
    (request.cookies.get('nexora_role')?.value === 'vendor' ? 'authenticated' : undefined);
  const superAdminSession =
    request.cookies.get('nexora_superadmin_session')?.value ||
    (request.cookies.get('nexora_role')?.value === 'super_admin' ? 'authenticated' : undefined);

  if (pathname.startsWith('/dashboard') && !adminSession) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  if (pathname.startsWith('/admin') && !adminSession) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  if (pathname.startsWith('/doctor') && !doctorSession) {
    return NextResponse.redirect(new URL('/doctor/login', request.url));
  }

  if (pathname.startsWith('/staff') && !staffSession) {
    return NextResponse.redirect(new URL('/staff/login', request.url));
  }

  if (pathname.startsWith('/patient/dashboard') && !patientSession) {
    return NextResponse.redirect(new URL('/patient/login', request.url));
  }

  if (pathname.startsWith('/vendor') && !vendorSession) {
    return NextResponse.redirect(new URL('/vendor/login', request.url));
  }

  if (pathname.startsWith('/super-admin') && !superAdminSession) {
    return NextResponse.redirect(new URL('/ops/platform-root', request.url));
  }

  return NextResponse.next();
}

// Matcher excludes bare root '/' — gateway always renders without middleware interception
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/doctor/:path*',
    '/staff/:path*',
    '/patient/dashboard/:path*',
    '/vendor/:path*',
    '/super-admin/:path*',
  ],
};
