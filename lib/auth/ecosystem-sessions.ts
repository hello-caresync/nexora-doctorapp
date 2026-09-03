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
  const payload = JSON.stringify(session);
  localStorage.setItem(SESSION_KEYS.staff, payload);
  setNexoraRoleCookie('staff');
  mirrorSessionCookie(SESSION_KEYS.staff, payload);
}

export function getStaffPortalSession(): StaffPortalSession | null {
  if (typeof window === 'undefined') return null;
  return parseJsonSession<StaffPortalSession>(localStorage.getItem(SESSION_KEYS.staff));
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
  if (role === 'Nurse') return '/staff/nursing';
  if (role === 'Pharmacist') return '/staff/pharmacy';
  if (role === 'Receptionist') return '/staff/reception';
  if (role === 'Admin') return '/admin/login';
  return '/staff/login';
}
