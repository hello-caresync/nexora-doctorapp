import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export interface AuthenticatedUserPayload {
  id: string;
  hospital_id: string | null;
  hospital_name: string;
  full_name: string;
  staff_type: 'Doctor' | 'Nurse' | 'Receptionist' | 'Pharmacist' | 'Admin';
  department: string;
  email: string;
  temporary_passcode: string;
  phone?: string;
  portal_access: string;
}

const HOSPITAL_CODE_ALIASES: Record<string, string> = {
  'RH-BLR-01': 'HOSP-01',
};

const HOSPITAL_NAMES: Record<string, string> = {
  'HOSP-01': 'Regal Hospital Main',
  'RH-BLR-01': 'Regal Hospital Main',
};

const GLOBAL_HOSPITAL_PREFIXES = ['PLATFORM', 'GLOBAL', 'ROOT'];

function shouldNullHospitalId(hospitalId?: string | null): boolean {
  if (!hospitalId) return true;
  const upper = hospitalId.trim().toUpperCase();
  return GLOBAL_HOSPITAL_PREFIXES.some((prefix) => upper.startsWith(prefix));
}

export function resolveCredentialHospitalId(rawId: string | null | undefined): string | null {
  if (!rawId?.trim()) return null;
  const id = rawId.trim();
  if (shouldNullHospitalId(id)) return null;
  return HOSPITAL_CODE_ALIASES[id] ?? id;
}

export function resolveCredentialHospitalName(
  hospitalId: string | null,
  fallback = 'Regal Hospital Main',
): string {
  if (!hospitalId) return 'Regal Platform Root';
  return HOSPITAL_NAMES[hospitalId] ?? fallback;
}

export function resolveStaffPortalAccess(
  role: AuthenticatedUserPayload['staff_type'],
  department: string,
): string {
  const deptLower = department.toLowerCase();
  if (role === 'Doctor') return '/doctor';
  if (role === 'Receptionist' || deptLower.includes('front') || deptLower.includes('desk')) {
    return '/staff/reception';
  }
  if (role === 'Pharmacist' || deptLower.includes('pharm')) return '/staff/pharmacy';
  if (role === 'Nurse' || deptLower.includes('icu') || deptLower.includes('ward')) {
    return '/staff/nursing';
  }
  if (role === 'Admin') return '/dashboard';
  return '/staff';
}

export function mapMemberRoleToStaffType(
  role: string,
): AuthenticatedUserPayload['staff_type'] {
  switch (role) {
    case 'Doctor':
      return 'Doctor';
    case 'Nurse':
      return 'Nurse';
    case 'Receptionist':
      return 'Receptionist';
    case 'Pharmacist':
      return 'Pharmacist';
    case 'Admin':
    case 'Billing':
    default:
      return 'Admin';
  }
}

/** Non-blocking audit log — never throws; FK-safe for global/platform accounts. */
export async function recordRealStaffLogin(user: AuthenticatedUserPayload): Promise<void> {
  if (!supabase) {
    console.warn('Supabase client not initialized. Skipping staff credential audit log.');
    return;
  }

  try {
    const resolvedHospitalId = resolveCredentialHospitalId(user.hospital_id);

    const { error } = await supabase.from('hospital_staff_credentials').upsert(
      {
        id: user.id,
        hospital_id: resolvedHospitalId,
        hospital_name: user.hospital_name,
        full_name: user.full_name,
        staff_type: user.staff_type,
        department: user.department,
        email: user.email.toLowerCase().trim(),
        temporary_passcode: user.temporary_passcode,
        phone: user.phone || '+91 98450 00000',
        portal_access: user.portal_access,
        status: 'Active',
        is_logged_in: true,
        last_login: new Date().toISOString(),
      },
      { onConflict: 'email' },
    );

    if (error) {
      console.warn('Non-blocking staff credential log warning:', error.message);
    }
  } catch (err) {
    console.warn('Non-blocking staff credential log exception:', err);
  }
}
