import type { SupabaseClient } from '@supabase/supabase-js';

import {
  APPOINTMENT_GRACE_MINUTES,
  currentTimeHHmm,
  extractScheduledTime,
  isLateArrival,
  type QueuePatient,
} from '@/lib/queue/interleavingEngine';
import { inferQueueType, mapRecordToQueuePatient } from '@/lib/queue/queue-mapper';
import { persistAppointmentArrival } from '@/lib/queue/queue-persistence';

export type ArrivalVerificationResult = {
  ok: boolean;
  appointmentId: string;
  patientName: string;
  queueType: QueuePatient['queue_type'];
  late: boolean;
  scheduledTime: string;
  checkedInAt: string;
  status: 'arrived';
  error?: string;
};

async function loadAppointmentRow(
  supabase: SupabaseClient,
  appointmentId: string,
): Promise<Record<string, unknown> | null> {
  const byId = await supabase.from('appointments').select('*').eq('id', appointmentId).maybeSingle();
  if (!byId.error && byId.data) return byId.data as Record<string, unknown>;

  const byAppointmentId = await supabase
    .from('appointments')
    .select('*')
    .eq('appointment_id', appointmentId)
    .maybeSingle();
  if (!byAppointmentId.error && byAppointmentId.data) {
    return byAppointmentId.data as Record<string, unknown>;
  }

  const patientRow = await supabase
    .from('patient_appointments')
    .select('*')
    .eq('id', appointmentId)
    .maybeSingle();
  return patientRow.data ? (patientRow.data as Record<string, unknown>) : null;
}

export async function verifyAppointmentArrival(
  supabase: SupabaseClient,
  input: { appointmentId: string; currentTimeStr?: string },
): Promise<ArrivalVerificationResult> {
  const appointmentId = input.appointmentId.trim();
  if (!appointmentId) {
    return {
      ok: false,
      appointmentId: '',
      patientName: '',
      queueType: 'appointment',
      late: false,
      scheduledTime: currentTimeHHmm(),
      checkedInAt: '',
      status: 'arrived',
      error: 'appointmentId is required',
    };
  }

  const row = await loadAppointmentRow(supabase, appointmentId);
  if (!row) {
    return {
      ok: false,
      appointmentId,
      patientName: '',
      queueType: 'appointment',
      late: false,
      scheduledTime: currentTimeHHmm(),
      checkedInAt: '',
      status: 'arrived',
      error: 'Appointment not found',
    };
  }

  const patient = mapRecordToQueuePatient({ ...row, id: appointmentId });
  const currentTimeStr = input.currentTimeStr || currentTimeHHmm();
  const scheduledTime = extractScheduledTime(
    row.scheduled_time ?? row.appointment_time ?? row.time_slot ?? row.slot_time,
  );
  const late = patient.queue_type === 'appointment' && isLateArrival(
    { ...patient, scheduled_time: scheduledTime },
    currentTimeStr,
    APPOINTMENT_GRACE_MINUTES,
  );
  const checkedInAt = new Date().toISOString();
  const queueType = inferQueueType(row);

  const persist = await persistAppointmentArrival(supabase, appointmentId, {
    status: 'WAITING',
    check_in_status: 'arrived',
    checked_in_at: checkedInAt,
    queue_type: queueType,
    triage_priority: patient.triage_priority,
    estimated_duration_minutes: patient.estimated_duration_minutes,
  });

  if (!persist.ok) {
    return {
      ok: false,
      appointmentId,
      patientName: patient.patient_name,
      queueType,
      late,
      scheduledTime,
      checkedInAt,
      status: 'arrived',
      error: persist.error || 'Failed to persist arrival',
    };
  }

  return {
    ok: true,
    appointmentId,
    patientName: patient.patient_name,
    queueType,
    late,
    scheduledTime,
    checkedInAt,
    status: 'arrived',
  };
}
