import { createClient } from '@supabase/supabase-js';
import type { VendorSession } from './ecosystem-sessions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export type VendorAuthResult =
  | { ok: true; vendor: VendorSession }
  | { ok: false; error: string };

function readPasscode(row: Record<string, unknown>): string {
  for (const key of ['passcode', 'temporary_passcode', 'password']) {
    const value = row[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return '';
}

function readEmail(row: Record<string, unknown>): string {
  return String(row.email ?? row.rep_email ?? '').toLowerCase();
}

export async function authenticateVendorCredential(
  email: string,
  passcode: string,
): Promise<VendorAuthResult> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPasscode = passcode.trim();

  if (!cleanEmail || !cleanPasscode) {
    return { ok: false, error: 'Enter vendor email and security passcode.' };
  }

  if (!supabase) {
    return { ok: false, error: 'Vendor authentication service unavailable.' };
  }

  const { data: byEmail } = await supabase
    .from('hospital_vendors')
    .select('*')
    .eq('email', cleanEmail)
    .maybeSingle();

  const { data: byRepEmail } = byEmail
    ? { data: byEmail }
    : await supabase.from('hospital_vendors').select('*').eq('rep_email', cleanEmail).maybeSingle();

  const data = byRepEmail;
  if (!data) {
    return { ok: false, error: 'No vendor account found for this email.' };
  }

  const row = data as Record<string, unknown>;
  const stored = readPasscode(row);
  const status = String(row.status ?? 'active').toLowerCase();

  if (status === 'suspended') {
    return { ok: false, error: 'This vendor account has been suspended.' };
  }

  if (stored !== cleanPasscode) {
    return { ok: false, error: 'Invalid vendor passcode.' };
  }

  return {
    ok: true,
    vendor: {
      id: String(row.id ?? ''),
      company_name: String(row.vendor_name ?? row.company_name ?? row.name ?? 'Vendor Partner'),
      vendor_name: String(row.vendor_name ?? row.company_name ?? 'Vendor Partner'),
      rep_email: readEmail(row),
      email: readEmail(row),
      category: String(row.category ?? 'Pharmaceuticals'),
      hospital_id: row.hospital_id ? String(row.hospital_id) : undefined,
    },
  };
}
