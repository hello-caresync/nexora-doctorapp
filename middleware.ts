import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/admin/login',
  '/doctor/login',
  '/staff/login',
  '/patient/login',
  '/patient/auth/login',
  '/vendor/login',
  '/ops/platform-root',
  '/super-admin/login',
  '/favicon.ico',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function isPublicAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  );
}

function hasStaffAuth(request: NextRequest): boolean {
  return Boolean(
    request.cookies.get('curasync_staff_session')?.value ||
      request.cookies.get('nexora_role')?.value === 'staff',
  );
}

function hasAdminAuth(request: NextRequest): boolean {
  return Boolean(
    request.cookies.get('curasync_admin_session')?.value ||
      request.cookies.get('curasync_active_session')?.value ||
      request.cookies.get('nexora_role')?.value === 'admin',
  );
}

function hasDoctorAuth(request: NextRequest): boolean {
  return Boolean(
    request.cookies.get('curasync_doctor_session')?.value ||
      request.cookies.get('active_doctor_session')?.value ||
      request.cookies.get('nexora_role')?.value === 'doctor',
  );
}

function hasPatientAuth(request: NextRequest): boolean {
  return Boolean(
    request.cookies.get('curasync_patient_session')?.value ||
      request.cookies.get('nexora_role')?.value === 'patient',
  );
}

function hasVendorAuth(request: NextRequest): boolean {
  return Boolean(
    request.cookies.get('curasync_vendor_session')?.value ||
      request.cookies.get('nexora_role')?.value === 'vendor',
  );
}

function hasSuperAdminAuth(request: NextRequest): boolean {
  return Boolean(
    request.cookies.get('nexora_superadmin_session')?.value ||
      request.cookies.get('nexora_role')?.value === 'super_admin',
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicAsset(pathname) || isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/staff')) {
    if (!hasStaffAuth(request)) {
      const loginUrl = new URL('/staff/login', request.url);
      if (pathname !== '/staff/login') {
        loginUrl.searchParams.set('redirect', pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
    if (!hasAdminAuth(request)) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith('/doctor')) {
    if (!hasDoctorAuth(request)) {
      const loginUrl = new URL('/doctor/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith('/patient')) {
    if (!hasPatientAuth(request)) {
      const loginUrl = new URL('/patient/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith('/vendor')) {
    if (!hasVendorAuth(request)) {
      const loginUrl = new URL('/vendor/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith('/super-admin')) {
    if (!hasSuperAdminAuth(request)) {
      const loginUrl = new URL('/ops/platform-root', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/doctor/:path*',
    '/staff/:path*',
    '/patient/:path*',
    '/vendor/:path*',
    '/super-admin/:path*',
  ],
};
