import { supabase } from '@/lib/supabase/client';

export type VerifiedPatientIdentity = {
  id: string;
  email: string;
  fullName: string;
  uhid?: string;
  hospitalId?: string;
  hospitalName?: string;
  authSource: 'supabase_auth' | 'patient_users';
};

export type PatientAuthResult =
  | { ok: true; patient: VerifiedPatientIdentity }
  | { ok: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validatePatientEmail(email: string): string | null {
  const clean = email.trim().toLowerCase();
  if (!clean) return 'Email address is required.';
  if (!EMAIL_PATTERN.test(clean)) return 'Enter a valid registered email address.';
  return null;
}

function readPasswordFromRow(row: Record<string, unknown>): string {
  const candidates = ['password', 'passcode', 'temporary_passcode', 'password_hash'];
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return '';
}

function normalizePatientRow(
  row: Record<string, unknown>,
  email: string,
): VerifiedPatientIdentity {
  return {
    id: String(row.id ?? row.patient_id ?? row.user_id ?? ''),
    email: String(row.email ?? email).toLowerCase(),
    fullName: String(row.full_name ?? row.fullName ?? row.name ?? 'Verified Patient'),
    uhid: row.uhid ? String(row.uhid) : row.mrn ? String(row.mrn) : undefined,
    hospitalId: row.hospital_id ? String(row.hospital_id) : undefined,
    hospitalName: row.hospital_name ? String(row.hospital_name) : undefined,
    authSource: 'patient_users',
  };
}

async function authenticateViaPatientUsersTable(
  email: string,
  password: string,
): Promise<VerifiedPatientIdentity | null> {
  const { data, error } = await supabase
    .from('patient_users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  const storedPassword = readPasswordFromRow(row);
  if (!storedPassword || storedPassword !== password) return null;

  if (row.status === 'Restricted' || row.is_active === false) {
    throw new Error('This patient account has been restricted. Contact hospital registration.');
  }

  return normalizePatientRow(row, email);
}

async function authenticateViaSupabaseAuth(
  email: string,
  password: string,
): Promise<VerifiedPatientIdentity | null> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data?.user) return null;

  const user = data.user;
  const meta = user.user_metadata ?? {};

  return {
    id: user.id,
    email: user.email?.toLowerCase() ?? email,
    fullName: String(meta.full_name ?? meta.fullName ?? meta.name ?? 'Verified Patient'),
    uhid: meta.uhid ? String(meta.uhid) : meta.mrn ? String(meta.mrn) : undefined,
    hospitalId: meta.hospital_id ? String(meta.hospital_id) : undefined,
    hospitalName: meta.hospital_name ? String(meta.hospital_name) : undefined,
    authSource: 'supabase_auth',
  };
}

export async function authenticatePatientCredential(
  email: string,
  password: string,
): Promise<PatientAuthResult> {
  const emailError = validatePatientEmail(email);
  if (emailError) return { ok: false, error: emailError };

  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();

  if (!cleanPassword) {
    return { ok: false, error: 'Security password is required.' };
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      error: 'Authentication service unavailable. Supabase is not configured.',
    };
  }

  try {
    const fromAuth = await authenticateViaSupabaseAuth(cleanEmail, cleanPassword);
    if (fromAuth) return { ok: true, patient: fromAuth };

    const fromTable = await authenticateViaPatientUsersTable(cleanEmail, cleanPassword);
    if (fromTable) return { ok: true, patient: fromTable };

    return {
      ok: false,
      error: 'Invalid email or password. Access restricted to verified patients only.',
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Authentication failed. Please try again.',
    };
  }
}

export function persistPatientSession(
  patient: VerifiedPatientIdentity,
  selectedHospital: string,
): void {
  if (typeof window === 'undefined') return;

  const patientId =
    patient.id && /^[0-9a-f-]{36}$/i.test(patient.id)
      ? patient.id
      : patient.uhid
        ? `PT-${patient.uhid}`
        : `PT-${Date.now()}`;

  const loginTime = new Date().toISOString();

  localStorage.setItem('curasync_active_patient_id', patientId);
  localStorage.setItem('curasync_patient_id', patientId);
  localStorage.setItem('curasync_patient_name', patient.fullName);
  localStorage.setItem('patient_full_name', patient.fullName);
  localStorage.setItem('curasync_patient_email', patient.email);
  localStorage.setItem('curasync_selected_hospital', selectedHospital);
  localStorage.setItem('selected_hospital_name', selectedHospital);
  localStorage.setItem('curasync_patient_logged_in', 'true');

  localStorage.setItem(
    'curasync_patient_session',
    JSON.stringify({
      email: patient.email,
      patient_id: patientId,
      full_name: patient.fullName,
      hospital: selectedHospital,
      hospital_id: patient.hospitalId,
      authenticated: true,
      auth_source: patient.authSource,
      login_time: loginTime,
    }),
  );

  localStorage.setItem(
    'nexora_patient_v0_session',
    JSON.stringify({
      patientId,
      email: patient.email,
      fullName: patient.fullName,
      mrn: patient.uhid ?? patientId,
      signedInAt: loginTime,
      rememberMe: true,
    }),
  );
}
