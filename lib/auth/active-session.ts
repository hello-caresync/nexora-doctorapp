import { setNexoraRoleCookie } from './role-cookies';

export const CURASYNC_ACTIVE_SESSION_KEY = 'curasync_active_session';
export const ADMIN_PROVISIONING_PATH = '/dashboard/staff-credentials';

export type ActiveStaffSession = {
  id: string;
  hospital_id: string;
  hospital_name: string;
  full_name: string;
  staff_type: string;
  department: string;
  email: string;
  portal_access: string;
};

export function parseActiveSession(raw: string | null): ActiveStaffSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ActiveStaffSession>;
    if (parsed?.email && parsed?.portal_access && parsed?.id) {
      return parsed as ActiveStaffSession;
    }
  } catch {
    // invalid session payload
  }
  return null;
}

/** Hospital Admins land on staff provisioning first; all other roles use their portal route. */
export function resolvePostLoginRoute(staffType: string, portalAccess: string): string {
  if (staffType === 'Admin') return ADMIN_PROVISIONING_PATH;
  return portalAccess || '/dashboard';
}

/** Operational staff never route to the admin credential provisioning screen. */
export function resolveOperationalStaffRoute(portalAccess: string): string {
  const route = portalAccess || '/dashboard';
  if (route === ADMIN_PROVISIONING_PATH) return '/dashboard';
  return route;
}

export function persistActiveSession(session: ActiveStaffSession): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(CURASYNC_ACTIVE_SESSION_KEY, JSON.stringify(session));
  setNexoraRoleCookie('admin');

  const cookiePayload = encodeURIComponent(
    JSON.stringify({
      email: session.email,
      role: session.staff_type,
      loggedInAt: new Date().toISOString(),
    }),
  );
  const attrs = 'path=/; max-age=86400; SameSite=Lax';
  document.cookie = `curasync_session=${cookiePayload}; ${attrs}`;
  document.cookie = `auth-token=authenticated; ${attrs}`;
  document.cookie = `sb-access-token=authenticated; ${attrs}`;
}

export function clearStaleAuthArtifacts(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem('admin_authenticated');
  localStorage.removeItem('user_role');
  localStorage.removeItem('nexora_admin_session');
}

export function clearActiveSession(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(CURASYNC_ACTIVE_SESSION_KEY);
  const attrs = 'path=/; max-age=0; SameSite=Lax';
  document.cookie = `curasync_session=; ${attrs}`;
  document.cookie = `auth-token=; ${attrs}`;
  document.cookie = `sb-access-token=; ${attrs}`;
}
