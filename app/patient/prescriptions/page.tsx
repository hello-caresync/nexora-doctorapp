'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getActivePatientId, getActivePatientName } from '@/lib/patient/active-patient-node';
import { Pill, Stethoscope, Building2, CalendarClock, Printer } from 'lucide-react';

interface PrescriptionMedication {
  name: string;
  dosage?: string;
  frequency?: string;
  timing?: string;
  duration?: string;
}

interface PrescriptionRecord {
  id: string;
  appointment_id?: string;
  patient_id?: string;
  patient_name?: string;
  doctor_name?: string;
  doctor_code?: string;
  doctor_id?: string;
  department?: string;
  hospital_name?: string;
  diagnosis?: string;
  medicines?: PrescriptionMedication[];
  medications?: PrescriptionMedication[];
  instructions?: string;
  follow_up_date?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

function parseMedicinesField(raw: unknown): PrescriptionMedication[] {
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

  return parsed.map((med) => {
    const item = med as Record<string, unknown>;
    return {
      name: String(item.name || item.medicine || '').trim(),
      dosage: item.dosage ? String(item.dosage) : undefined,
      frequency: item.frequency ? String(item.frequency) : undefined,
      timing: item.timing ? String(item.timing) : undefined,
      duration: item.duration ? String(item.duration) : undefined,
    };
  });
}

function normalizePrescriptionRow(raw: Record<string, unknown>): PrescriptionRecord {
  const medicines = parseMedicinesField(raw.medicines);
  const medications = parseMedicinesField(raw.medications);

  return {
    id: String(raw.id ?? ''),
    appointment_id: raw.appointment_id ? String(raw.appointment_id) : undefined,
    patient_id: raw.patient_id ? String(raw.patient_id) : undefined,
    patient_name: raw.patient_name ? String(raw.patient_name) : undefined,
    doctor_name: raw.doctor_name ? String(raw.doctor_name) : undefined,
    doctor_code: raw.doctor_code ? String(raw.doctor_code) : undefined,
    doctor_id: raw.doctor_id ? String(raw.doctor_id) : undefined,
    department: raw.department ? String(raw.department) : undefined,
    hospital_name: raw.hospital_name ? String(raw.hospital_name) : undefined,
    diagnosis: raw.diagnosis ? String(raw.diagnosis) : undefined,
    instructions: raw.instructions ? String(raw.instructions) : undefined,
    follow_up_date: raw.follow_up_date ? String(raw.follow_up_date) : undefined,
    status: raw.status ? String(raw.status) : undefined,
    created_at: raw.created_at ? String(raw.created_at) : undefined,
    updated_at: raw.updated_at ? String(raw.updated_at) : undefined,
    medicines: medicines.length > 0 ? medicines : medications,
    medications: medications.length > 0 ? medications : medicines,
  };
}

function getMedicineList(rx: PrescriptionRecord): PrescriptionMedication[] {
  const fromMedicines = parseMedicinesField(rx.medicines);
  if (fromMedicines.length > 0) return fromMedicines;
  return parseMedicinesField(rx.medications);
}

export default function PatientPrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<PrescriptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPatientId, setCurrentPatientId] = useState('');
  const [patientName, setPatientName] = useState('');

  const fetchPrescriptions = useCallback(async () => {
    const activeId = getActivePatientId();
    setCurrentPatientId(activeId);
    setPatientName(getActivePatientName());

    setLoading(true);
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('patient_id', activeId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading prescriptions:', error);
      setPrescriptions([]);
    } else if (data) {
      setPrescriptions(
        data.map((row: Record<string, unknown>) => normalizePrescriptionRow(row)),
      );
    } else {
      setPrescriptions([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const activeId = getActivePatientId();
    setCurrentPatientId(activeId);
    setPatientName(getActivePatientName());
    void fetchPrescriptions();

    const rxChannel = supabase
      .channel(`rx_node_${activeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'prescriptions',
          filter: `patient_id=eq.${activeId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const newRecord = normalizePrescriptionRow(payload.new);
          if (newRecord?.id) {
            setPrescriptions((prev) => [
              newRecord,
              ...prev.filter((p) => p.id !== newRecord.id),
            ]);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(rxChannel);
    };
  }, [fetchPrescriptions]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4 print:p-0 print:max-w-none">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .rx-print-root,
          .rx-print-root * {
            visibility: visible;
          }
          .rx-print-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          .rx-card {
            break-inside: avoid;
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
          }
        }
      `}</style>

      <div className="rx-print-root space-y-4">
        <div className="flex items-center justify-between border-b pb-4 no-print">
          <div>
            <h1 className="text-xl font-bold text-slate-900">My Digital Prescriptions</h1>
            <p className="text-xs text-slate-500">
              Node: {currentPatientId || '—'}
              {patientName ? ` • ${patientName}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync
            </span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-xs text-slate-400">Loading prescriptions...</div>
        ) : prescriptions.length === 0 ? (
          <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl text-slate-500 text-sm shadow-xs">
            <Pill className="w-8 h-8 mx-auto mb-3 text-slate-300" />
            <p className="font-semibold text-slate-700">No Prescriptions Issued Yet</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              When your doctor completes a consultation, your prescription will appear here instantly
              for patient node {currentPatientId || '—'}.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {prescriptions.map((rx) => {
              const medicineList = getMedicineList(rx);

              return (
                <article
                  key={rx.id}
                  className="rx-card bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3"
                >
                  <header className="flex items-start justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center">
                        <Stethoscope className="w-5 h-5 text-teal-700" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">
                          {rx.doctor_name || '—'}
                        </h3>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {(rx.doctor_code || rx.doctor_id) && `${rx.doctor_code || rx.doctor_id} • `}
                          {rx.department || '—'}
                        </p>
                        {rx.diagnosis && (
                          <p className="text-xs text-teal-700 font-medium mt-0.5">
                            Diagnosis: {rx.diagnosis}
                          </p>
                        )}
                        {rx.status && (
                          <p className="text-[10px] font-bold uppercase text-slate-500 mt-0.5">
                            Status: {rx.status}
                          </p>
                        )}
                      </div>
                    </div>
                    <time className="text-[10px] font-mono text-slate-400">
                      {rx.created_at ? new Date(rx.created_at).toLocaleString() : '—'}
                    </time>
                  </header>

                  {(rx.hospital_name || rx.follow_up_date) && (
                    <div className="flex flex-wrap gap-2 text-[10px]">
                      {rx.hospital_name && (
                        <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-600 font-semibold">
                          <Building2 className="w-3 h-3" />
                          {rx.hospital_name}
                        </span>
                      )}
                      {rx.follow_up_date && (
                        <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 text-amber-800 font-semibold">
                          <CalendarClock className="w-3 h-3" />
                          Follow-up: {rx.follow_up_date}
                        </span>
                      )}
                    </div>
                  )}

                  <section className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                      <Pill className="w-3.5 h-3.5 text-teal-600" />
                      Prescribed Medicines
                    </h4>
                    <div className="grid gap-2">
                      {medicineList.length === 0 ? (
                        <div className="text-xs text-slate-400 italic py-2">—</div>
                      ) : (
                        medicineList.map((med, idx) => (
                          <div
                            key={`${rx.id}-med-${idx}`}
                            className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs"
                          >
                            <span className="font-bold text-slate-900">{med.name}</span>
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                              {(med.dosage || med.frequency) && (
                                <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-mono font-bold text-[10px]">
                                  {med.dosage || med.frequency}
                                </span>
                              )}
                              {med.timing && (
                                <span className="text-slate-500 text-[10px]">{med.timing}</span>
                              )}
                              {med.duration && (
                                <span className="text-slate-600">{med.duration}</span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  {rx.instructions && (
                    <footer className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900">
                      <span className="font-bold">Advice: </span>
                      {rx.instructions}
                    </footer>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
