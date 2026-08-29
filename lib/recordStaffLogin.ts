import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export interface AuthenticatedUserPayload {
  id: string;
  hospital_id: string;
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

export function resolveCredentialHospitalId(rawId: string | null | undefined): string {
  const id = (rawId ?? 'HOSP-01').trim();
  return HOSPITAL_CODE_ALIASES[id] ?? id;
}

export function resolveCredentialHospitalName(
  hospitalId: string,
  fallback = 'Regal Hospital Main',
): string {
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

export async function recordRealStaffLogin(user: AuthenticatedUserPayload) {
  if (!supabase) {
    console.warn('Supabase client not initialized. Skipping DB record.');
    return null;
  }

  const { data, error } = await supabase
    .from('hospital_staff_credentials')
    .upsert(
      {
        id: user.id,
        hospital_id: user.hospital_id,
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
    console.error('Failed to log live staff credential to database:', error.message);
    throw error;
  }

  return data;
}
