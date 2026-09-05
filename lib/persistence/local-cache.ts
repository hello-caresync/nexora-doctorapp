export const CACHE_KEYS = {
  hospitalInfo: 'curasync_hospital_info',
  opdQueue: 'curasync_cached_opd_queue',
  hospitalPlatform: 'curasync_cached_hospital_platform',
  staffSession: 'curasync_staff_session',
  patientSession: 'curasync_patient_session',
  patientAppointments: 'curasync_appointments',
  patientAppointmentsAlt: 'curasync_cached_patient_appointments',
  patientPrescriptions: 'curasync_cached_patient_prescriptions',
  doctorQueue: 'curasync_cached_doctor_queue',
  doctorSession: 'active_doctor_session',
} as const;

export function readLocalJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeLocalJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

export function removeLocalJson(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}
