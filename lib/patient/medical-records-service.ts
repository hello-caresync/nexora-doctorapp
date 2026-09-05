import { supabase } from '@/lib/supabaseClient';
import { readStoredPatientIdentity } from '@/lib/patient/active-patient-node';
import { readPatientPortalSession } from '@/lib/patient/portal-session';
import {
  parseMedicinesField,
  queryPrescriptionsForPatient,
} from '@/lib/patient/prescriptions-feed';

export type MedicalRecordRow = {
  id: string;
  patient_id: string;
  doctor_id?: string;
  consultation_id?: string;
  appointment_id?: string;
  record_type: string;
  summary: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  doctor_name?: string;
};

function identityOrFilter(identifiers: string[]): string {
  return identifiers
    .filter((id) => id && !id.includes(','))
    .map((id) => `patient_id.eq.${id}`)
    .join(',');
}

export async function fetchPatientMedicalRecords(
  sessionPatientId?: string | null,
): Promise<MedicalRecordRow[]> {
  const identity = readStoredPatientIdentity();
  const session = typeof window !== 'undefined' ? readPatientPortalSession() : null;
  const identifiers = Array.from(
    new Set(
      [sessionPatientId, identity.activePatientId, session?.patient_id, identity.uhid, ...identity.identifiers]
        .map((value) => String(value ?? '').trim())
        .filter((value) => Boolean(value) && !value.includes(',')),
    ),
  );

  const records: MedicalRecordRow[] = [];

  try {
    let query = supabase
      .from('medical_records')
      .select('*, doctors(full_name)')
      .order('created_at', { ascending: false });

    const orFilter = identityOrFilter(identifiers);
    if (orFilter) query = query.or(orFilter);

    const { data, error } = await query;

    if (!error && data?.length) {
      records.push(
        ...data.map((row: Record<string, unknown>) => {
          const doctor = Array.isArray(row.doctors) ? row.doctors[0] : row.doctors;
          const doctorRecord = doctor as { full_name?: string } | null;
          return {
            id: String(row.id),
            patient_id: String(row.patient_id ?? identity.activePatientId),
            doctor_id: row.doctor_id ? String(row.doctor_id) : undefined,
            consultation_id: row.consultation_id ? String(row.consultation_id) : undefined,
            appointment_id: row.appointment_id ? String(row.appointment_id) : undefined,
            record_type: String(row.record_type ?? 'consultation_summary'),
            summary: String(row.summary ?? ''),
            metadata: (row.metadata as Record<string, unknown>) ?? {},
            created_at: row.created_at ? String(row.created_at) : undefined,
            doctor_name: doctorRecord?.full_name
              ? String(doctorRecord.full_name)
              : row.doctor_name
                ? String(row.doctor_name)
                : undefined,
          };
        }),
      );
    } else if (error) {
      console.error('[Patient Medical Records] fetch failed:', error.message);
    }
  } catch (err: unknown) {
    console.error('[Patient Medical Records] fetch crashed:', err);
  }

  try {
    const prescriptions = await queryPrescriptionsForPatient(identity);
    for (const row of prescriptions) {
      const id = `rx-${row.id}`;
      if (records.some((item) => item.id === id || item.id === row.id)) continue;
      const medicines = parseMedicinesField(row.medicines);
      records.push({
        id,
        patient_id: row.patient_id || identity.activePatientId,
        doctor_id: row.doctor_id,
        appointment_id: row.appointment_id,
        record_type: 'digital_prescription',
        summary: [
          row.diagnosis ? `Diagnosis: ${row.diagnosis}` : '',
          row.clinical_notes ? `Findings: ${row.clinical_notes}` : '',
          medicines.length
            ? `Medicines: ${medicines
                .map((med) => `${med.name}${med.dosage ? ` (${med.dosage})` : ''}`)
                .join(', ')}`
            : '',
          row.instructions ? `Instructions: ${row.instructions}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        created_at: row.issued_at || row.created_at,
        doctor_name: row.doctor_name,
      });
    }
  } catch (err: unknown) {
    console.error('[Patient Medical Records] prescription mapping failed:', err);
  }

  return records.sort((left, right) => {
    const leftTs = Date.parse(String(left.created_at ?? '')) || 0;
    const rightTs = Date.parse(String(right.created_at ?? '')) || 0;
    return rightTs - leftTs;
  });
}
