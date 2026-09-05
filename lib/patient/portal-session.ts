import { canonicalHospitalId, HOSPITAL_TENANT_ID } from '@/lib/hospital/hospital-node';
import { SESSION_KEYS } from '@/lib/auth/ecosystem-sessions';

export type PatientPortalSession = {
  patient_id: string;
  uhid: string;
  patient_name: string;
  phone: string;
  hospital_id: string;
  hospital_name: string;
  email?: string;
};

export function mintPatientUhid(): string {
  return `NX-PAT-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function readPatientPortalSession(): PatientPortalSession | null {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem(SESSION_KEYS.patient);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const patientName = String(
      parsed.patient_name ?? parsed.full_name ?? parsed.name ?? '',
    ).trim();
    const uhid = String(parsed.uhid ?? parsed.patient_uhid ?? '').trim();
    const hospitalId = canonicalHospitalId(
      String(parsed.hospital_id ?? parsed.hospitalId ?? HOSPITAL_TENANT_ID),
    );

    return {
      patient_id: String(parsed.patient_id ?? parsed.id ?? ''),
      uhid: uhid || '',
      patient_name: patientName || 'Verified Patient',
      phone: String(parsed.phone ?? parsed.mobile ?? '+91 98450 12345'),
      hospital_id: hospitalId || HOSPITAL_TENANT_ID,
      hospital_name: String(parsed.hospital_name ?? parsed.hospital ?? 'Regal Hospital'),
      email: parsed.email ? String(parsed.email) : undefined,
    };
  } catch {
    return null;
  }
}

export function persistPatientPortalSession(session: PatientPortalSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEYS.patient, JSON.stringify(session));
  localStorage.setItem('curasync_active_patient_id', session.patient_id);
  localStorage.setItem('curasync_patient_id', session.patient_id);
  localStorage.setItem('curasync_patient_name', session.patient_name);
  localStorage.setItem('patient_full_name', session.patient_name);
  if (session.email) localStorage.setItem('curasync_patient_email', session.email);
  localStorage.setItem('curasync_patient_logged_in', 'true');
}
