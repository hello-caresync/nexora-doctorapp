'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import {
  CURASYNC_ACTIVE_SESSION_KEY,
  parseActiveSession,
} from '@/lib/auth/active-session';
import {
  getStaffPortalSession,
  getVendorSession,
  parseJsonSession,
  SESSION_KEYS,
} from '@/lib/auth/ecosystem-sessions';
import { parseSuperAdminSession, SUPER_ADMIN_SESSION_KEY } from '@/lib/auth/super-admin-session';

type GuardRole = 'admin' | 'staff' | 'vendor' | 'patient' | 'superadmin' | 'doctor';

type RouteGuardProps = {
  role: GuardRole;
  children: ReactNode;
  loginPath: string;
};

function hasPatientSession(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    localStorage.getItem(SESSION_KEYS.patient) ||
      localStorage.getItem('curasync_patient_logged_in') === 'true',
  );
}

function hasDoctorSession(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem(SESSION_KEYS.doctor));
}

function hasSuperAdminSession(): boolean {
  if (typeof window === 'undefined') return false;
  const nexora = parseJsonSession<{ role?: string }>(
    localStorage.getItem('nexora_superadmin_session'),
  );
  if (nexora?.role === 'super_admin') return true;
  return parseSuperAdminSession(localStorage.getItem(SUPER_ADMIN_SESSION_KEY)) !== null;
}

export function EcosystemRouteGuard({ role, children, loginPath }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let ok = false;

    switch (role) {
      case 'admin': {
        const session = parseActiveSession(localStorage.getItem(CURASYNC_ACTIVE_SESSION_KEY));
        ok = Boolean(session && session.staff_type === 'Admin');
        break;
      }
      case 'staff':
        ok = Boolean(getStaffPortalSession());
        break;
      case 'vendor':
        ok = Boolean(getVendorSession());
        break;
      case 'patient':
        ok = hasPatientSession();
        break;
      case 'superadmin':
        ok = hasSuperAdminSession();
        break;
      case 'doctor':
        ok = hasDoctorSession();
        break;
    }

    if (!ok) {
      const next = pathname ? `?redirect=${encodeURIComponent(pathname)}` : '';
      router.replace(`${loginPath}${next}`);
      return;
    }

    setAllowed(true);
  }, [role, loginPath, pathname, router]);

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return <>{children}</>;
}
