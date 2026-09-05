import { readStoredPatientIdentity, type StoredPatientIdentity } from '@/lib/patient/active-patient-node';
import { supabase } from '@/lib/supabaseClient';

export type PrescriptionMedicineItem = {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
};

export type NormalizedPrescription = {
  id: string;
  appointment_id?: string;
  patient_id?: string;
  patient_name?: string;
  uhid?: string;
  email?: string;
  doctor_name?: string;
  doctor_id?: string;
  department?: string;
  hospital_name?: string;
  diagnosis?: string;
  clinical_notes?: string;
  dietary_instructions?: string;
  medicines: PrescriptionMedicineItem[];
  medications: PrescriptionMedicineItem[];
  instructions?: string;
  follow_up_date?: string;
  status?: string;
  issued_at?: string;
  created_at?: string;
};

function isMissingColumn(message: string, column: string): boolean {
  const msg = message.toLowerCase();
  return (
    msg.includes(`column prescriptions.${column} does not exist`) ||
    msg.includes(`column ${column} does not exist`) ||
    msg.includes(`'${column}' column`) ||
    msg.includes(`.${column} does not exist`)
  );
}

export function parseMedicinesField(raw: unknown): PrescriptionMedicineItem[] {
  if (!raw) return [];

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  const medicines: PrescriptionMedicineItem[] = [];
  for (const med of parsed) {
    const item = med as Record<string, unknown>;
    const name = String(item.name || item.medicine || item.drug || '').trim();
    if (!name) continue;
    medicines.push({
      name,
      dosage: item.dosage
        ? String(item.dosage)
        : item.dose
          ? String(item.dose)
          : undefined,
      frequency: item.frequency
        ? String(item.frequency)
        : item.timing
          ? String(item.timing)
          : undefined,
      duration: item.duration ? String(item.duration) : undefined,
      instructions: item.instructions ? String(item.instructions) : undefined,
    });
  }
  return medicines;
}

export function normalizePrescriptionRow(raw: Record<string, unknown>): NormalizedPrescription {
  const medicines = parseMedicinesField(raw.medicines);
  const medications = parseMedicinesField(raw.medications);
  const list = medicines.length > 0 ? medicines : medications;
  const notes = raw.clinical_notes
    ? String(raw.clinical_notes)
    : raw.examination_findings
      ? String(raw.examination_findings)
      : undefined;
  const advice = raw.dietary_instructions
    ? String(raw.dietary_instructions)
    : raw.instructions
      ? String(raw.instructions)
      : raw.doctor_instructions
        ? String(raw.doctor_instructions)
        : undefined;

  return {
    id: String(raw.id ?? `${raw.appointment_id ?? 'rx'}-${raw.created_at ?? Date.now()}`),
    appointment_id: raw.appointment_id ? String(raw.appointment_id) : undefined,
    patient_id: raw.patient_id ? String(raw.patient_id) : undefined,
    patient_name: raw.patient_name ? String(raw.patient_name) : undefined,
    uhid: raw.uhid ? String(raw.uhid) : undefined,
    email: raw.email ? String(raw.email) : undefined,
    doctor_name: raw.doctor_name ? String(raw.doctor_name) : undefined,
    doctor_id: raw.doctor_id ? String(raw.doctor_id) : undefined,
    department: raw.department ? String(raw.department) : undefined,
    hospital_name: raw.hospital_name
      ? String(raw.hospital_name)
      : 'Regal Hospital • Main Branch',
    diagnosis: raw.diagnosis ? String(raw.diagnosis) : undefined,
    clinical_notes: notes,
    dietary_instructions: advice,
    instructions: advice,
    follow_up_date: raw.follow_up_date ? String(raw.follow_up_date) : undefined,
    status: raw.status ? String(raw.status) : undefined,
    issued_at: raw.issued_at
      ? String(raw.issued_at)
      : raw.dispatched_at
        ? String(raw.dispatched_at)
        : raw.created_at
          ? String(raw.created_at)
          : undefined,
    created_at: raw.created_at ? String(raw.created_at) : undefined,
    medicines: list,
    medications: list,
  };
}

export function prescriptionMatchesPatient(
  row: NormalizedPrescription,
  identity: StoredPatientIdentity,
): boolean {
  const candidates = new Set(identity.identifiers.map((id) => id.toLowerCase()));
  const pid = (row.patient_id || '').trim();
  const uhid = (row.uhid || '').trim();
  const email = (row.email || '').trim();

  if (pid && candidates.has(pid.toLowerCase())) return true;
  if (uhid && candidates.has(uhid.toLowerCase())) return true;
  if (email && candidates.has(email.toLowerCase())) return true;

  const name = (row.patient_name || '').trim().toLowerCase();
  if (identity.patientName && name === identity.patientName.toLowerCase()) return true;
  return false;
}

function buildOrFilter(
  identity: StoredPatientIdentity,
  includeUhid: boolean,
  includeName: boolean,
): string {
  const parts: string[] = [];
  const ids = identity.identifiers.length > 0 ? identity.identifiers : [identity.activePatientId];

  for (const id of ids) {
    if (!id || id.includes(',')) continue;
    parts.push(`patient_id.eq.${id}`);
    if (includeUhid) parts.push(`uhid.eq.${id}`);
  }

  if (includeName && identity.patientName) {
    const safeName = identity.patientName.replace(/,/g, ' ').trim();
    if (safeName) parts.push(`patient_name.ilike.%${safeName}%`);
  }

  return parts.join(',');
}

export async function queryPrescriptionsForPatient(
  identity: StoredPatientIdentity = readStoredPatientIdentity(),
): Promise<NormalizedPrescription[]> {
  const run = async (includeUhid: boolean, includeName: boolean) => {
    let query = supabase.from('prescriptions').select('*').order('created_at', { ascending: false });
    const orFilter = buildOrFilter(identity, includeUhid, includeName);
    if (orFilter) query = query.or(orFilter);
    return query;
  };

  try {
    let { data, error } = await run(true, true);

    if (error && isMissingColumn(error.message, 'uhid')) {
      const retry = await run(false, true);
      data = retry.data;
      error = retry.error;
    }

    if (error && isMissingColumn(error.message, 'patient_name')) {
      const retry = await run(false, false);
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('[Patient Prescriptions] fetch failed:', error.message);
      return [];
    }

    return ((data ?? []) as Record<string, unknown>[]).map((row) => normalizePrescriptionRow(row));
  } catch (err: unknown) {
    console.error('[Patient Prescriptions] fetch crashed:', err);
    return [];
  }
}
