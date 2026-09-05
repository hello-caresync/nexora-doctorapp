import {
  currentTimeHHmm,
  extractScheduledTime,
  type CheckInStatus,
  type QueuePatient,
  type QueueType,
} from '@/lib/queue/interleavingEngine';

export function inferQueueType(row: Record<string, unknown>): QueueType {
  const explicit = String(row.queue_type ?? '').toLowerCase();
  if (explicit === 'walk_in' || explicit === 'appointment') return explicit;

  const source = String(row.source ?? '').toUpperCase().replace(/[\s-]+/g, '_');
  const token = String(row.uhid ?? row.token_number ?? row.token ?? '');
  if (
    source === 'WALK_IN' ||
    source === 'HOSPITAL_WALKIN' ||
    token.startsWith('NX-WLK') ||
    token.startsWith('NX-OPD')
  ) {
    return 'walk_in';
  }
  return 'appointment';
}

export function inferCheckInStatus(row: Record<string, unknown>): CheckInStatus {
  const explicit = String(row.check_in_status ?? '').toLowerCase();
  if (
    explicit === 'pending' ||
    explicit === 'arrived' ||
    explicit === 'in_consultation' ||
    explicit === 'completed'
  ) {
    return explicit;
  }

  const status = String(row.status ?? row.queue_status ?? '').toLowerCase();
  if (/consult|in.?progress/.test(status)) return 'in_consultation';
  if (/complete|done|closed|discharged/.test(status)) return 'completed';
  if (/arriv|check|wait|active|confirm/.test(status)) return 'arrived';
  return 'pending';
}

export function inferTriagePriority(row: Record<string, unknown>): number {
  const raw = row.triage_priority ?? row.priority;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const label = String(raw ?? '').toUpperCase();
  if (label === '1' || label === 'P1' || label === 'EMERGENCY') return 1;
  if (label === '2' || label === 'P2' || label === 'URGENT') return 2;
  return 3;
}

export function mapRecordToQueuePatient(row: Record<string, unknown>): QueuePatient {
  return {
    id: String(row.id ?? row.appointment_id ?? ''),
    patient_id: String(row.patient_id ?? row.uhid ?? ''),
    patient_name: String(row.patient_name ?? row.name ?? 'Patient'),
    doctor_id: String(row.doctor_id ?? row.doctor_code ?? row.doctor_employee_id ?? ''),
    queue_type: inferQueueType(row),
    scheduled_time: extractScheduledTime(
      row.scheduled_time ?? row.appointment_time ?? row.time_slot ?? row.slot_time ?? row.created_at,
    ),
    check_in_status: inferCheckInStatus(row),
    checked_in_at: row.checked_in_at ? String(row.checked_in_at) : undefined,
    estimated_duration_minutes: Number(row.estimated_duration_minutes ?? row.ml_duration_min ?? 15) || 15,
    triage_priority: inferTriagePriority(row),
  };
}

export function partitionQueuePatients(rows: QueuePatient[]): {
  appointments: QueuePatient[];
  walkIns: QueuePatient[];
} {
  const appointments: QueuePatient[] = [];
  const walkIns: QueuePatient[] = [];
  for (const row of rows) {
    if (row.queue_type === 'walk_in') walkIns.push(row);
    else appointments.push(row);
  }
  return { appointments, walkIns };
}

export function nowClockLabel(): string {
  return currentTimeHHmm();
}
