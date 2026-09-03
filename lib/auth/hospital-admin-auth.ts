import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export type HospitalAdminRecord = {
  id: string;
  hospital_id: string;
  hospital_name: string;
  full_name: string;
  email: string;
  department: string;
  temporary_passcode: string;
  portal_access: string;
  phone?: string;
};

export type HospitalAdminAuthResult =
  | { ok: true; admin: HospitalAdminRecord }
  | { ok: false; error: string };

function readPasscode(row: Record<string, unknown>): string {
  for (const key of ['passcode', 'temporary_passcode', 'password']) {
    const value = row[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return '';
}

function normalizeAdmin(row: Record<string, unknown>, email: string): HospitalAdminRecord {
  return {
    id: String(row.id ?? ''),
    hospital_id: String(row.hospital_id ?? ''),
    hospital_name: String(row.hospital_name ?? 'Regal Hospital Main'),
    full_name: String(row.full_name ?? row.name ?? 'Hospital Administrator'),
    email: String(row.email ?? email).toLowerCase(),
    department: String(row.department ?? 'Hospital Administration'),
    temporary_passcode: readPasscode(row),
    portal_access: String(row.portal_access ?? '/dashboard/staff-credentials'),
    phone: typeof row.phone === 'string' ? row.phone : undefined,
  };
}

export async function authenticateHospitalAdmin(
  email: string,
  passcode: string,
  hospitalId?: string,
): Promise<HospitalAdminAuthResult> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPasscode = passcode.trim();

  if (!cleanEmail || !cleanPasscode) {
    return {
      ok: false,
      error: 'Invalid administrator credentials or unauthorized hospital node.',
    };
  }

  if (!supabase) {
    return { ok: false, error: 'Authentication service unavailable.' };
  }

  const { data, error } = await supabase
    .from('hospital_staff_credentials')
    .select('*')
    .eq('email', cleanEmail)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      error: 'Invalid administrator credentials or unauthorized hospital node.',
    };
  }

  const row = data as Record<string, unknown>;
  const staffType = String(row.staff_type ?? row.role ?? '');
  if (staffType !== 'Admin') {
    return {
      ok: false,
      error: 'Invalid administrator credentials or unauthorized hospital node.',
    };
  }

  const storedPasscode = readPasscode(row);
  if (storedPasscode !== cleanPasscode) {
    return {
      ok: false,
      error: 'Invalid administrator credentials or passcode.',
    };
  }

  const admin = normalizeAdmin(row, cleanEmail);

  if (hospitalId && admin.hospital_id && admin.hospital_id !== hospitalId) {
    return {
      ok: false,
      error: 'Invalid administrator credentials or unauthorized hospital node.',
    };
  }

  return { ok: true, admin };
}
