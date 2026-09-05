import type { SupabaseClient } from '@supabase/supabase-js';

import { HOSPITAL_TENANT_ID } from '@/lib/regal/constants';

export type StaffRole = 'doctor' | 'staff' | 'admin';

export type HospitalStaffMember = {
  id: string;
  hospital_id: string;
  staff_id_code: string;
  full_name: string;
  email: string;
  passcode_key: string;
  role: StaffRole;
  department: string;
  qualification: string;
  consultation_fee: number;
  is_active: boolean;
  created_at?: string;
};

export type StaffDirectoryDraft = {
  staff_id_code: string;
  full_name: string;
  email: string;
  passcode_key: string;
  role: StaffRole;
  department: string;
  qualification: string;
  consultation_fee: number;
  is_active: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function normalizeStaffRole(raw?: string | null): StaffRole {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'admin') return 'admin';
  if (value === 'staff' || value === 'nurse' || value === 'receptionist' || value === 'pharmacist') {
    return 'staff';
  }
  return 'doctor';
}

export function mapHospitalStaffMember(row: Record<string, unknown>, hospitalId: string): HospitalStaffMember {
  const role = normalizeStaffRole(String(row.role ?? row.staff_type ?? 'doctor'));
  return {
    id: String(row.id ?? ''),
    hospital_id: String(row.hospital_id ?? hospitalId),
    staff_id_code: String(row.staff_id_code ?? row.employee_id ?? ''),
    full_name: String(row.full_name ?? '').trim(),
    email: String(row.email ?? '').trim(),
    passcode_key: String(row.passcode_key ?? row.temporary_passcode ?? row.passcode ?? ''),
    role,
    department: String(row.department ?? ''),
    qualification: String(row.qualification ?? ''),
    consultation_fee: Number(row.consultation_fee ?? (role === 'doctor' ? 500 : 0)) || 0,
    is_active: row.is_active !== false && String(row.status ?? 'active').toLowerCase() !== 'restricted',
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

export async function fetchHospitalStaffDirectory(
  supabase: SupabaseClient,
  hospitalId: string,
): Promise<HospitalStaffMember[]> {
  const { data, error } = await supabase
    .from('hospital_staff')
    .select('*')
    .eq('hospital_id', hospitalId)
    .order('created_at', { ascending: false });

  if (error || !Array.isArray(data)) return [];
  return data
    .map((row) => mapHospitalStaffMember(asRecord(row), hospitalId))
    .filter((row) => row.full_name);
}

function nextStaffCode(role: StaffRole): string {
  const prefix = role === 'admin' ? 'RH-A' : role === 'staff' ? 'RH-S' : 'RH-D';
  return `${prefix}${Date.now().toString().slice(-4)}`;
}

function staffPayload(hospitalId: string, draft: StaffDirectoryDraft): Record<string, unknown> {
  const role = normalizeStaffRole(draft.role);
  const fee = role === 'doctor' ? Math.max(0, Number(draft.consultation_fee) || 500) : 0;
  return {
    hospital_id: hospitalId,
    staff_id_code: draft.staff_id_code.trim() || nextStaffCode(role),
    full_name: draft.full_name.trim(),
    email: draft.email.trim() || null,
    passcode_key: draft.passcode_key.trim() || null,
    role,
    department: draft.department.trim() || (role === 'doctor' ? 'General Medicine' : 'Operations'),
    qualification: draft.qualification.trim() || null,
    consultation_fee: fee,
    is_active: draft.is_active,
    updated_at: new Date().toISOString(),
  };
}

export async function createHospitalStaffMember(
  supabase: SupabaseClient,
  hospitalId: string,
  draft: StaffDirectoryDraft,
): Promise<{ ok: boolean; member?: HospitalStaffMember; error?: string }> {
  if (!draft.full_name.trim()) return { ok: false, error: 'Full name is required' };
  if (draft.role === 'doctor' && Number(draft.consultation_fee) < 0) {
    return { ok: false, error: 'Consultation fee cannot be negative' };
  }

  const { data, error } = await supabase
    .from('hospital_staff')
    .insert([staffPayload(hospitalId, draft)])
    .select()
    .maybeSingle();

  if (error) {
    const message = error.message || 'Could not add staff member';
    if (/duplicate|unique|already exists/i.test(message)) {
      return { ok: false, error: 'That email is already assigned to another staff record' };
    }
    return { ok: false, error: message };
  }

  return { ok: true, member: mapHospitalStaffMember(asRecord(data), hospitalId) };
}

export async function updateHospitalStaffMember(
  supabase: SupabaseClient,
  hospitalId: string,
  id: string,
  draft: StaffDirectoryDraft,
): Promise<{ ok: boolean; member?: HospitalStaffMember; error?: string }> {
  if (!draft.full_name.trim()) return { ok: false, error: 'Full name is required' };

  const { data, error } = await supabase
    .from('hospital_staff')
    .update(staffPayload(hospitalId, draft))
    .eq('id', id)
    .eq('hospital_id', hospitalId)
    .select()
    .maybeSingle();

  if (error) {
    const message = error.message || 'Could not update staff member';
    if (/duplicate|unique|already exists/i.test(message)) {
      return { ok: false, error: 'That email is already assigned to another staff record' };
    }
    return { ok: false, error: message };
  }

  return { ok: true, member: mapHospitalStaffMember(asRecord(data), hospitalId) };
}

export async function deleteHospitalStaffMember(
  supabase: SupabaseClient,
  hospitalId: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('hospital_staff').delete().eq('id', id).eq('hospital_id', hospitalId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function toDashboardStaffRow(member: HospitalStaffMember) {
  return {
    id: member.staff_id_code || member.id,
    full_name: member.full_name,
    staff_type: member.role === 'doctor' ? 'Doctor' : member.role === 'admin' ? 'Admin' : 'Staff',
    department: member.department,
    email: member.email,
    temporary_passcode: member.passcode_key,
    portal_access: member.role === 'doctor' ? '/doctor/workspace' : '/dashboard',
    status: member.is_active ? 'Active' : 'Restricted',
  };
}

export const HOSPITAL_STAFF_DEFAULT_HOSPITAL = HOSPITAL_TENANT_ID;
