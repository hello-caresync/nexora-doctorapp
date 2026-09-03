export type WhitelistedSuperAdminUser = {
  id: string;
  hospital_id: string;
  hospital_name: string;
  full_name: string;
  staff_type: string;
  department: string;
  email: string;
  temporary_passcode: string;
  phone?: string;
  portal_access: string;
  status?: string;
};

export const SUPER_ADMIN_WHITELIST = [
  'aishwaryaananya43@gmail.com',
  'superadmin@nexora.health',
  'superadmin@regalhealth.com',
  'admin@regalhealth.com',
] as const;

export const SUPER_ADMIN_VALID_PASSCODES = [
  'OPS-RH-AS26-A113',
  'SUPER-MASTER-2026',
  '123456',
  'ADMIN-REGAL-2026',
  'admin123',
] as const;

const normalizedWhitelist = SUPER_ADMIN_WHITELIST.map((email) => email.toLowerCase());

export function isWhitelistedSuperAdminEmail(email: string): boolean {
  return normalizedWhitelist.includes(email.trim().toLowerCase());
}

export function isValidSuperAdminPasscode(passcode: string): boolean {
  return (SUPER_ADMIN_VALID_PASSCODES as readonly string[]).includes(passcode.trim());
}

export function buildWhitelistedSuperAdminUser(
  email: string,
  passcode: string,
  existing?: WhitelistedSuperAdminUser | null,
): WhitelistedSuperAdminUser {
  const cleanEmail = email.trim().toLowerCase();
  const localPart = cleanEmail.split('@')[0] ?? 'admin';

  if (existing) {
    return {
      ...existing,
      email: cleanEmail,
      staff_type: 'SuperAdmin',
      hospital_id: existing.hospital_id.startsWith('PLATFORM')
        ? existing.hospital_id
        : 'PLATFORM-00',
      hospital_name: existing.hospital_name || 'Regal Platform Root',
      portal_access: '/super-vault-access',
      temporary_passcode: passcode.trim(),
    };
  }

  return {
    id: `PLATFORM-SA-${localPart.replace(/[^a-z0-9]/gi, '').slice(0, 12).toUpperCase() || 'ROOT'}`,
    hospital_id: 'PLATFORM-00',
    hospital_name: 'Regal Platform Root',
    full_name: localPart
      .split(/[._-]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' '),
    staff_type: 'SuperAdmin',
    department: 'Platform Operations',
    email: cleanEmail,
    temporary_passcode: passcode.trim(),
    portal_access: '/super-vault-access',
    status: 'Active',
  };
}

export function passesSuperAdminPasscodeCheck(
  passcode: string,
  dbPasscode?: string,
): boolean {
  const cleanPasscode = passcode.trim();
  if (isValidSuperAdminPasscode(cleanPasscode)) return true;
  if (dbPasscode && dbPasscode === cleanPasscode) return true;
  return false;
}
