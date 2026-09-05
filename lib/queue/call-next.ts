import type { SupabaseClient } from '@supabase/supabase-js';

import {
  currentTimeHHmm,
  getNextPatient,
  type InterleaveSource,
  type QueuePatient,
  type QueueType,
} from '@/lib/queue/interleavingEngine';
import { mapRecordToQueuePatient, partitionQueuePatients } from '@/lib/queue/queue-mapper';
import {
  persistAppointmentArrival,
  persistLastServedType,
  readLastServedType,
} from '@/lib/queue/queue-persistence';

export type CallNextResult = {
  ok: boolean;
  source: InterleaveSource;
  nextPatient: QueuePatient | null;
  error?: string;
};

function matchesDoctor(row: Record<string, unknown>, doctorId?: string): boolean {
  if (!doctorId) return true;
  const candidates = [row.doctor_id, row.doctor_code, row.doctor_employee_id].map((value) =>
    String(value ?? '').trim().toUpperCase(),
  );
  return candidates.includes(doctorId.trim().toUpperCase()) || candidates.some((value) => !value);
}

export async function loadActiveQueuePatients(
  supabase: SupabaseClient,
  input: { doctorId?: string; hospitalId?: string },
): Promise<QueuePatient[]> {
  let query = supabase.from('appointments').select('*').order('created_at', { ascending: true });
  if (input.hospitalId) {
    query = query.eq('hospital_id', input.hospitalId);
  }

  const { data, error } = await query;
  if (error || !Array.isArray(data)) return [];

  return (data as Record<string, unknown>[])
    .filter((row) => matchesDoctor(row, input.doctorId))
    .map((row) => mapRecordToQueuePatient(row))
    .filter((patient) => patient.id && patient.check_in_status !== 'completed');
}

export async function callNextInterleavedPatient(
  supabase: SupabaseClient,
  input: {
    doctorId?: string;
    hospitalId?: string;
    currentTimeStr?: string;
    lastServedType?: QueueType;
  },
): Promise<CallNextResult> {
  const patients = await loadActiveQueuePatients(supabase, input);
  const { appointments, walkIns } = partitionQueuePatients(patients);
  const lastServedType = input.lastServedType ?? (input.doctorId ? await readLastServedType(supabase, input.doctorId) : undefined);
  const currentTimeStr = input.currentTimeStr || currentTimeHHmm();
  const selection = getNextPatient(appointments, walkIns, currentTimeStr, 10, lastServedType);

  if (!selection.nextPatient) {
    return { ok: true, source: 'none', nextPatient: null };
  }

  const persist = await persistAppointmentArrival(supabase, selection.nextPatient.id, {
    status: 'IN_CONSULTATION',
    check_in_status: 'in_consultation',
  });

  if (!persist.ok) {
    return {
      ok: false,
      source: selection.source,
      nextPatient: selection.nextPatient,
      error: persist.error || 'Failed to promote next patient',
    };
  }

  const servedType: QueueType = selection.nextPatient.queue_type;
  if (input.doctorId) {
    await persistLastServedType(supabase, {
      doctorId: input.doctorId,
      hospitalId: input.hospitalId,
      lastServedType: servedType,
      lastServedPatientId: selection.nextPatient.id,
    });
  }

  return {
    ok: true,
    source: selection.source,
    nextPatient: {
      ...selection.nextPatient,
      check_in_status: 'in_consultation',
    },
  };
}

export function previewNextInterleavedPatient(
  rows: Record<string, unknown>[],
  currentTimeStr = currentTimeHHmm(),
  lastServedType?: QueueType,
): CallNextResult {
  const patients = rows.map((row) => mapRecordToQueuePatient(row));
  const { appointments, walkIns } = partitionQueuePatients(patients);
  const selection = getNextPatient(appointments, walkIns, currentTimeStr, 10, lastServedType);
  return {
    ok: true,
    source: selection.source,
    nextPatient: selection.nextPatient,
  };
}
