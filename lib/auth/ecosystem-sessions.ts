export const SESSION_KEYS = {
  admin: 'curasync_active_session',
  staff: 'curasync_staff_session',
  vendor: 'curasync_vendor_session',
  patient: 'curasync_patient_session',
  superAdmin: 'nexora_superadmin_session',
  doctor: 'active_doctor_session',
} as const;

export type StaffPortalSession = {
  id: string;
  hospital_id: string;
  hospital_name: string;
  full_name: string;
  staff_type: string;
  department: string;
  email: string;
  portal_access: string;
};

export type VendorSession = {
  id: string;
  company_name: string;
  vendor_name?: string;
  rep_email: string;
  email?: string;
  category: string;
  hospital_id?: string;
};

export function parseJsonSession<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

import { setNexoraRoleCookie } from '@/lib/auth/role-cookies';

const COOKIE_ATTRS = 'path=/; max-age=86400; SameSite=Lax';

function mirrorSessionCookie(name: string, payload: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(payload)}; ${COOKIE_ATTRS}`;
}

export function persistStaffPortalSession(session: StaffPortalSession): void {
  if (typeof window === 'undefined') return;

  const hospitalSession = {
    ...session,
    role: session.staff_type,
    hospitalId: session.hospital_id,
    hospitalName: session.hospital_name,
    portal_access: session.portal_access || '/dashboard',
  };
  const payload = JSON.stringify(hospitalSession);

  localStorage.setItem(SESSION_KEYS.staff, payload);
  localStorage.setItem('curasync_admin_session', payload);
  localStorage.setItem(SESSION_KEYS.admin, payload);
  setNexoraRoleCookie('staff');
  document.cookie = `${SESSION_KEYS.staff}=${encodeURIComponent(session.hospital_id)}; ${COOKIE_ATTRS}`;
}

export function getStaffPortalSession(): StaffPortalSession | null {
  if (typeof window === 'undefined') return null;
  return parseJsonSession<StaffPortalSession>(localStorage.getItem(SESSION_KEYS.staff));
}

const HOSPITAL_APP_ROLES = ['Admin', 'Nurse', 'Receptionist', 'Pharmacist'] as const;

export function isHospitalAppRole(role?: string | null): boolean {
  return Boolean(role && (HOSPITAL_APP_ROLES as readonly string[]).includes(role));
}

export function readHospitalAppSession(): StaffPortalSession | null {
  if (typeof window === 'undefined') return null;

  const keys = [SESSION_KEYS.admin, 'curasync_admin_session', SESSION_KEYS.staff];
  for (const key of keys) {
    const parsed = parseJsonSession<
      StaffPortalSession & { role?: string; hospitalId?: string; hospitalName?: string }
    >(localStorage.getItem(key));
    const hospitalId = parsed?.hospital_id || parsed?.hospitalId;
    if (!parsed || !hospitalId) continue;

    const staffType = parsed.staff_type || parsed.role || 'Staff';
    return {
      id: parsed.id || '',
      hospital_id: hospitalId,
      hospital_name: parsed.hospital_name || parsed.hospitalName || 'Hospital Node',
      full_name: parsed.full_name || 'Hospital User',
      staff_type: staffType,
      department: parsed.department || '',
      email: parsed.email || '',
      portal_access: parsed.portal_access || '/dashboard',
    };
  }

  return null;
}

export function persistVendorSession(session: VendorSession): void {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify(session);
  localStorage.setItem(SESSION_KEYS.vendor, payload);
  setNexoraRoleCookie('vendor');
  mirrorSessionCookie(SESSION_KEYS.vendor, payload);
}

export function getVendorSession(): VendorSession | null {
  if (typeof window === 'undefined') return null;
  return parseJsonSession<VendorSession>(localStorage.getItem(SESSION_KEYS.vendor));
}

export function resolveStaffDepartmentRoute(staffType: string): string {
  const role = staffType.trim();
  if (role === 'Admin') return '/admin/login';
  if (['Nurse', 'Pharmacist', 'Receptionist'].includes(role)) return '/dashboard';
  return '/staff/login';
}
