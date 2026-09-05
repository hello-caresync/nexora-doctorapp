export type QueueType = 'appointment' | 'walk_in';
export type CheckInStatus = 'pending' | 'arrived' | 'in_consultation' | 'completed';
export type InterleaveSource = 'emergency' | 'appointment' | 'walk_in' | 'none';

export interface QueuePatient {
  id: string;
  patient_id: string;
  patient_name: string;
  doctor_id: string;
  queue_type: QueueType;
  scheduled_time: string; // "HH:MM" 24hr format
  check_in_status: CheckInStatus;
  checked_in_at?: string;
  estimated_duration_minutes: number;
  triage_priority: number; // 1 = Emergency, 2 = Urgent, 3 = Standard
}

export const DEFAULT_THRESHOLD_MINUTES = 10;
export const APPOINTMENT_GRACE_MINUTES = 15;

export function parseTimeToMinutes(timeStr: string): number {
  const match = String(timeStr ?? '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

export function currentTimeHHmm(date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function extractScheduledTime(value: unknown, fallback = currentTimeHHmm()): string {
  const raw = String(value ?? '').trim();
  const match = raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) {
    if (raw.includes('T')) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) return currentTimeHHmm(parsed);
    }
    return fallback;
  }

  let hours = Number(match[1]);
  const minutes = match[2];
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

export function isArrived(patient: QueuePatient): boolean {
  return patient.check_in_status === 'arrived';
}

export function isLateArrival(
  patient: QueuePatient,
  currentTimeStr: string,
  graceMinutes = APPOINTMENT_GRACE_MINUTES,
): boolean {
  if (patient.queue_type !== 'appointment') return false;
  return parseTimeToMinutes(currentTimeStr) > parseTimeToMinutes(patient.scheduled_time) + graceMinutes;
}

export function isInsideAppointmentWindow(
  patient: QueuePatient,
  currentTimeStr: string,
  thresholdMinutes = DEFAULT_THRESHOLD_MINUTES,
  graceMinutes = APPOINTMENT_GRACE_MINUTES,
): boolean {
  const currentMinutes = parseTimeToMinutes(currentTimeStr);
  const scheduledMinutes = parseTimeToMinutes(patient.scheduled_time);
  const windowStart = scheduledMinutes - thresholdMinutes;
  return currentMinutes >= windowStart && currentMinutes <= scheduledMinutes + graceMinutes;
}

function sortByScheduledTime(left: QueuePatient, right: QueuePatient): number {
  return parseTimeToMinutes(left.scheduled_time) - parseTimeToMinutes(right.scheduled_time);
}

export function getNextPatient(
  activeAppointments: QueuePatient[],
  activeWalkIns: QueuePatient[],
  currentTimeStr: string,
  thresholdMinutes: number = DEFAULT_THRESHOLD_MINUTES,
  lastServedType?: QueueType,
): { nextPatient: QueuePatient | null; source: InterleaveSource } {
  const currentMinutes = parseTimeToMinutes(currentTimeStr);

  // 1. Emergency Acuity Override
  const emergencyPatient = [...activeAppointments, ...activeWalkIns]
    .filter((p) => p.check_in_status === 'arrived' && p.triage_priority === 1)
    .sort(sortByScheduledTime)[0];

  if (emergencyPatient) {
    return { nextPatient: emergencyPatient, source: 'emergency' };
  }

  // 2. Buffer Window Calculation: t_current >= t_scheduled - delta
  const eligibleAppointments = activeAppointments
    .filter((a) => {
      if (a.check_in_status !== 'arrived') return false;
      const scheduledMinutes = parseTimeToMinutes(a.scheduled_time);
      const windowStart = scheduledMinutes - thresholdMinutes;
      return currentMinutes >= windowStart && currentMinutes <= scheduledMinutes + APPOINTMENT_GRACE_MINUTES;
    })
    .sort(sortByScheduledTime);

  // Late appointments lose slot priority and join the walk-in order.
  const lateAppointments = activeAppointments.filter(
    (a) => a.check_in_status === 'arrived' && isLateArrival(a, currentTimeStr),
  );

  const eligibleWalkIns = [...lateAppointments, ...activeWalkIns.filter((w) => w.check_in_status === 'arrived')].sort(
    sortByScheduledTime,
  );

  const candidateAppt = eligibleAppointments[0] || null;
  const candidateWalkIn = eligibleWalkIns[0] || null;

  // 3. Consecutive Clustering Prevention (Alternate)
  if (candidateAppt && candidateWalkIn && lastServedType === 'appointment') {
    return { nextPatient: candidateWalkIn, source: 'walk_in' };
  }

  // 4. Default Interleaving
  if (candidateAppt) {
    return { nextPatient: candidateAppt, source: 'appointment' };
  }

  if (candidateWalkIn) {
    return { nextPatient: candidateWalkIn, source: 'walk_in' };
  }

  return { nextPatient: null, source: 'none' };
}
