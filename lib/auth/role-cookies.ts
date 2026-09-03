export type NexoraRole = 'super_admin' | 'admin' | 'doctor' | 'staff' | 'patient' | 'vendor';

export const NEXORA_ROLE_COOKIE = 'nexora_role';

const COOKIE_ATTRS = 'path=/; max-age=86400; SameSite=Lax';

export function setNexoraRoleCookie(role: NexoraRole): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${NEXORA_ROLE_COOKIE}=${role}; ${COOKIE_ATTRS}`;
}

export function clearNexoraRoleCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${NEXORA_ROLE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
