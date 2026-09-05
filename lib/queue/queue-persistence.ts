import type { SupabaseClient } from '@supabase/supabase-js';

import type { QueueType } from '@/lib/queue/interleavingEngine';

export const QUEUE_STATE_TABLE = 'queue_interleaving_state';

function missingColumn(message: string | null | undefined): string | null {
  const text = String(message ?? '');
  const postgrest = text.match(/Could not find the '([^']+)' column/i);
  if (postgrest?.[1]) return postgrest[1];
  const postgres = text.match(/column (?:[\w]+\.)?([a-zA-Z0-9_]+) does not exist/i);
  return postgres?.[1] ?? null;
}

export async function patchRowSafe(
  supabase: SupabaseClient,
  table: string,
  match: { column: string; value: string },
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const row: Record<string, unknown> = { ...payload };
  delete row.id;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { error } = await supabase.from(table).update(row).eq(match.column, match.value);
    if (!error) return { ok: true };
    const column = missingColumn(error.message);
    if (!column || !(column in row)) {
      return { ok: false, error: error.message };
    }
    delete row[column];
  }

  return { ok: false, error: 'Unable to persist queue update' };
}

export async function persistAppointmentArrival(
  supabase: SupabaseClient,
  appointmentId: string,
  fields: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const timestamp = new Date().toISOString();
  const payload = { ...fields, updated_at: timestamp };

  const byId = await patchRowSafe(supabase, 'appointments', { column: 'id', value: appointmentId }, payload);
  if (byId.ok) {
    await patchRowSafe(supabase, 'patient_appointments', { column: 'id', value: appointmentId }, {
      ...payload,
      queue_status: fields.status ?? fields.check_in_status,
    });
    return byId;
  }

  const byAppointmentId = await patchRowSafe(
    supabase,
    'appointments',
    { column: 'appointment_id', value: appointmentId },
    payload,
  );
  await patchRowSafe(supabase, 'patient_appointments', { column: 'id', value: appointmentId }, {
    ...payload,
    queue_status: fields.status ?? fields.check_in_status,
  });
  return byAppointmentId;
}

export async function readLastServedType(
  supabase: SupabaseClient,
  doctorId: string,
): Promise<QueueType | undefined> {
  if (!doctorId) return undefined;
  const { data, error } = await supabase
    .from(QUEUE_STATE_TABLE)
    .select('last_served_type')
    .eq('doctor_id', doctorId)
    .maybeSingle();

  if (error || !data) return undefined;
  const value = String((data as { last_served_type?: string }).last_served_type ?? '');
  return value === 'appointment' || value === 'walk_in' ? value : undefined;
}

export async function persistLastServedType(
  supabase: SupabaseClient,
  input: {
    doctorId: string;
    hospitalId?: string;
    lastServedType: QueueType;
    lastServedPatientId?: string;
  },
): Promise<void> {
  if (!input.doctorId) return;
  const payload = {
    doctor_id: input.doctorId,
    hospital_id: input.hospitalId || null,
    last_served_type: input.lastServedType,
    last_served_patient_id: input.lastServedPatientId || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from(QUEUE_STATE_TABLE).upsert(payload, { onConflict: 'doctor_id' });
  if (error) {
    console.warn('[queue_interleaving_state] persist skipped:', error.message);
  }
}
