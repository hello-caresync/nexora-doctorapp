/** Client-side vault session storage key (UX gate only — run SQL migration for DB RLS). */
export const VAULT_SESSION_KEY = 'nexora_super_vault_unlocked_at';

/** Explicit master keys accepted by the vault gate (case-insensitive after trim). */
export const ACCEPTED_MASTER_KEYS = [
  'admin123',
  'NEXORA@SUPER2026',
  'curasync2026',
  'superadmin',
] as const;

/** @deprecated Use isValidVaultMasterPasscode — kept for env override compatibility */
export const VAULT_MASTER_PASSCODE =
  process.env.NEXT_PUBLIC_SUPER_VAULT_MASTER_KEY ?? 'admin123';

/**
 * Optional URL gate: when set, `/super-vault-access?secret_key=...` must match.
 * Leave unset in local dev to allow direct route access after master passcode.
 */
export const VAULT_SECRET_GATE = process.env.NEXT_PUBLIC_SUPER_VAULT_SECRET_KEY ?? '';

/** Vault session TTL — 30 minutes */
export const VAULT_SESSION_TTL_MS = 30 * 60 * 1000;

export function isValidVaultMasterPasscode(input: string): boolean {
  const clean = input.trim();
  if (!clean) return false;

  const normalized = clean.toLowerCase();
  const envKey = process.env.NEXT_PUBLIC_SUPER_VAULT_MASTER_KEY?.trim();

  const keys = envKey ? [...ACCEPTED_MASTER_KEYS, envKey] : [...ACCEPTED_MASTER_KEYS];

  return keys.some((key) => key.toLowerCase() === normalized);
}

export type VaultCredential = {
  id: string;
  portal_name: string;
  route_url: string;
  role_type: string;
  identifier: string;
  passcode: string;
  facility_code: string;
  environment: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export const EMPTY_CREDENTIAL_DRAFT: Omit<VaultCredential, 'id' | 'created_at' | 'updated_at'> = {
  portal_name: '',
  route_url: '',
  role_type: 'STAFF',
  identifier: '',
  passcode: '',
  facility_code: 'RH-BLR-01',
  environment: 'production',
  notes: '',
  is_active: true,
};
