import { createClient } from '@supabase/supabase-js';
import { ADMIN_PROVISIONING_PATH } from './active-session';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const STAFF_TABLES = ['staff_members', 'hospital_staff_credentials'] as const;

export async function isHospitalSetupCompleted(hospitalId: string): Promise<boolean> {
  if (typeof window !== 'undefined') {
    const localFlag = localStorage.getItem(`setup_completed_${hospitalId}`);
    if (localFlag === 'true') return true;
  }

  if (!supabase || !hospitalId) return false;

  for (const table of ['hospitals', 'hospital_tenants'] as const) {
    const { data } = await supabase
      .from(table)
      .select('setup_completed, hospital_id, id')
      .or(`hospital_id.eq.${hospitalId},id.eq.${hospitalId}`)
      .maybeSingle();

    if (data && (data as { setup_completed?: boolean }).setup_completed === true) {
      return true;
    }
  }

  for (const table of STAFF_TABLES) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('hospital_id', hospitalId)
      .neq('staff_type', 'Admin');

    if (!error && count && count > 0) return true;
  }

  return false;
}

export async function markHospitalSetupCompleted(hospitalId: string): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`setup_completed_${hospitalId}`, 'true');
  }

  if (!supabase || !hospitalId) return;

  for (const table of ['hospitals', 'hospital_tenants'] as const) {
    const { error } = await supabase
      .from(table)
      .update({ setup_completed: true })
      .or(`hospital_id.eq.${hospitalId},id.eq.${hospitalId}`);

    if (!error) return;
  }
}

export async function resolveAdminPostLoginRoute(hospitalId: string): Promise<string> {
  const completed = await isHospitalSetupCompleted(hospitalId);
  return completed
    ? '/dashboard'
    : `${ADMIN_PROVISIONING_PATH}?hospitalId=${encodeURIComponent(hospitalId)}`;
}
