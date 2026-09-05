'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, CalendarClock, Pill, Printer, Stethoscope } from 'lucide-react';

import {
  readStoredPatientIdentity,
  type StoredPatientIdentity,
} from '@/lib/patient/active-patient-node';
import {
  normalizePrescriptionRow,
  prescriptionMatchesPatient,
  queryPrescriptionsForPatient,
  type NormalizedPrescription,
} from '@/lib/patient/prescriptions-feed';
import { supabase } from '@/lib/supabaseClient';
import { CACHE_KEYS, readLocalJson, writeLocalJson } from '@/lib/persistence/local-cache';

function prependPrescription(
  current: NormalizedPrescription[],
  incoming: NormalizedPrescription,
): NormalizedPrescription[] {
  if (!incoming.id) return current;
  if (current.some((item) => item.id === incoming.id)) return current;
  return [incoming, ...current];
}

function formatIssuedAt(iso?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PatientPrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<NormalizedPrescription[]>(() => {
    const cached = readLocalJson<NormalizedPrescription[]>(CACHE_KEYS.patientPrescriptions);
    return Array.isArray(cached) ? cached : [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = readLocalJson<NormalizedPrescription[]>(CACHE_KEYS.patientPrescriptions);
    return !(Array.isArray(cached) && cached.length > 0);
  });
  const [currentPatientId, setCurrentPatientId] = useState(() => readStoredPatientIdentity().activePatientId);
  const [patientName, setPatientName] = useState(() => readStoredPatientIdentity().patientName);
  const identityRef = useRef<StoredPatientIdentity>(readStoredPatientIdentity());

  const fetchPrescriptions = useCallback(async () => {
    const identity = readStoredPatientIdentity();
    identityRef.current = identity;
    setCurrentPatientId(identity.activePatientId);
    setPatientName(identity.patientName);

    try {
      const rows = await queryPrescriptionsForPatient(identity);
      setPrescriptions(rows);
      writeLocalJson(CACHE_KEYS.patientPrescriptions, rows);
    } catch (err: unknown) {
      console.error('[Patient Prescriptions] unable to load live prescriptions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPrescriptions();

    const channel = supabase
      .channel('patient-prescriptions-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'prescriptions',
        },
        (payload: { eventType?: string; new?: Record<string, unknown> }) => {
          try {
            if (payload.eventType === 'INSERT' && payload.new) {
              const incoming = normalizePrescriptionRow(payload.new);
              if (!prescriptionMatchesPatient(incoming, identityRef.current)) return;
              setPrescriptions((prev) => prependPrescription(prev, incoming));
              return;
            }
            void fetchPrescriptions();
          } catch (err: unknown) {
            console.error('[Patient Prescriptions] realtime update failed:', err);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchPrescriptions]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6 print:max-w-none print:p-0">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live Sync
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading prescriptions...</div>
        ) : prescriptions.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500 shadow-xs">
            <Pill className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="font-semibold text-slate-700">No prescriptions found yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-slate-400">
              When your doctor completes a consultation, your prescription will appear here instantly
              for patient node {currentPatientId || '—'}.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {prescriptions.map((rx) => {
              const medicineList = rx.medicines.length > 0 ? rx.medicines : rx.medications;

              return (
                <article
                  key={rx.id}
                  className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs print:break-inside-avoid"
                >
                  <header className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-100 bg-teal-50">
                        <Stethoscope className="h-5 w-5 text-teal-700" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          {rx.doctor_name || 'Treating doctor'}
                        </h3>
                        <p className="text-[11px] font-medium text-slate-500">
                          {rx.department || 'Clinical'}
                          {rx.doctor_id ? ` • ${rx.doctor_id}` : ''}
                        </p>
                        <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                          <Building2 className="h-3 w-3" />
                          {rx.hospital_name || 'Regal Hospital • Main Branch'}
                        </p>
                      </div>
                    </div>
                    <time className="shrink-0 text-[11px] font-medium text-slate-400">
                      {formatIssuedAt(rx.issued_at || rx.created_at)}
                    </time>
                  </header>

                  <section className="space-y-2">
                    <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                      <Pill className="h-3.5 w-3.5 text-teal-600" />
                      Medicine list
                    </h4>
                    {medicineList.length === 0 ? (
                      <p className="py-2 text-xs italic text-slate-400">No medicines listed</p>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-slate-200">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            <tr>
                              <th className="px-3 py-2">Medicine</th>
                              <th className="px-3 py-2">Dose</th>
                              <th className="px-3 py-2">Frequency</th>
                              <th className="px-3 py-2">Duration</th>
                            </tr>
                          </thead>
                          <tbody>
                            {medicineList.map((med, idx) => (
                              <tr key={`${rx.id}-med-${idx}`} className="border-t border-slate-100">
                                <td className="px-3 py-2 font-bold text-slate-900">{med.name}</td>
                                <td className="px-3 py-2 text-slate-600">{med.dosage || '—'}</td>
                                <td className="px-3 py-2 text-slate-600">{med.frequency || '—'}</td>
                                <td className="px-3 py-2 text-slate-600">{med.duration || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  {rx.follow_up_date && (
                    <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                      <CalendarClock className="h-3 w-3" />
                      Follow-up: {rx.follow_up_date}
                    </p>
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
