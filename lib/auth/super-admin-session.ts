export const SUPER_ADMIN_SESSION_KEY = 'nexora_superadmin_session';

export type SuperAdminSession = {
  id: string;
  email: string;
  full_name: string;
  portal_access: string;
};

export function parseSuperAdminSession(raw: string | null): SuperAdminSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SuperAdminSession>;
    if (parsed?.email && parsed?.id) {
      return parsed as SuperAdminSession;
    }
  } catch {
    // invalid session payload
  }
  return null;
}

export function persistSuperAdminSession(session: SuperAdminSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SUPER_ADMIN_SESSION_KEY, JSON.stringify(session));
}

export function clearSuperAdminSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
}
