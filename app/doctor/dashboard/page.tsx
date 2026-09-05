'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  appointmentBelongsToDoctor,
  getDoctorSession,
  resolveDoctorSessionIdentity,
  type DoctorSession,
} from '@/lib/doctor/session';
import { CACHE_KEYS, readLocalJson, writeLocalJson } from '@/lib/persistence/local-cache';
import { dedupeEncounterList } from '@/lib/queue/dedupe-encounters';
import { dispatchDigitalPrescription } from '@/lib/doctor/dispatch-prescription';
import { toast } from 'sonner';
import {
  Clock,
  Plus,
  RefreshCw,
  Search,
  Stethoscope,
  Trash2,
  User,
  CheckCircle2,
  Siren,
  Pill,
  FileText,
  LogOut,
  AlertCircle,
} from 'lucide-react';

interface ActiveDoctorSession {
  doctorId: string;
  doctorName: string;
  department: string;
  specialization?: string;
  email: string;
  portalRoute?: string;
}

type QueueAppointment = {
  id: string;
  appointment_id?: string;
  patient_id?: string | null;
  patient_name?: string;
  name?: string;
  uhid?: string;
  age?: number | string;
  gender?: string;
  chief_complaint?: string;
  reason_for_visit?: string;
  status?: string;
  queue_status?: string;
  token_number?: string | number;
  appointment_time?: string;
  time_slot?: string;
  vitals_summary?: string;
  doctor_id?: string;
  doctor_code?: string;
  doctor_employee_id?: string;
  doctor_name?: string;
  created_at?: string;
  _source_table?: string;
};

type MedicationRow = {
  name: string;
  dosage: string;
  timing: string;
  duration: string;
  qty: number;
  price: number;
};

type HistoryItem = {
  type: string;
  created_at: string;
  diagnosis?: string;
  clinical_notes?: string;
  medications?: MedicationRow[];
};

type EmergencyRecord = {
  patient_name: string;
  bed_number?: string;
  chief_complaint?: string;
  reason_for_visit?: string;
  admitted_at: string;
  status?: string;
};

type DoctorQueueCache = {
  doctorId: string;
  appointments: QueueAppointment[];
  activePatientId?: string | null;
};

function readDoctorSessionFromStorage(): ActiveDoctorSession | null {
  const stored = getDoctorSession();
  if (!stored?.doctorId || !stored.doctorName) return null;
  return {
    doctorId: stored.doctorId,
    doctorName: stored.doctorName,
    department: stored.department || 'Clinical',
    specialization: stored.specialization,
    email: stored.email || '',
    portalRoute: stored.portalRoute,
  };
}

function readDoctorQueueCache(doctorId: string): DoctorQueueCache | null {
  const cached = readLocalJson<DoctorQueueCache>(CACHE_KEYS.doctorQueue);
  if (!cached || cached.doctorId !== doctorId || !Array.isArray(cached.appointments)) return null;
  return cached;
}

function formatToken(token?: string | number | null): string {
  if (token === undefined || token === null || String(token).trim() === '') return '—';
  return `#${String(token).replace(/^#/, '')}`;
}

export default function DoctorWorkstation() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isMounted, setIsMounted] = useState(false);

  const [session, setSession] = useState<ActiveDoctorSession | null>(() => readDoctorSessionFromStorage());
  const [appointments, setAppointments] = useState<QueueAppointment[]>(() => {
    const stored = readDoctorSessionFromStorage();
    return stored ? readDoctorQueueCache(stored.doctorId)?.appointments ?? [] : [];
  });
  const [activePatient, setActivePatient] = useState<QueueAppointment | null>(() => {
    const stored = readDoctorSessionFromStorage();
    if (!stored) return null;
    const cached = readDoctorQueueCache(stored.doctorId);
    if (!cached?.appointments.length) return null;
    return cached.appointments.find((row) => row.id === cached.activePatientId) || cached.appointments[0] || null;
  });
  const [queueTab, setQueueTab] = useState<'waiting' | 'done'>('waiting');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(() => {
    const stored = readDoctorSessionFromStorage();
    return !(stored && (readDoctorQueueCache(stored.doctorId)?.appointments.length ?? 0) > 0);
  });

  const [diagnosis, setDiagnosis] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [doctorAdvice, setDoctorAdvice] = useState('');
  const [medications, setMedications] = useState<MedicationRow[]>([]);
  const [drugInput, setDrugInput] = useState('');
  const [dosageInput, setDosageInput] = useState('1-0-1');
  const [durationInput, setDurationInput] = useState('3 Days');
  const [qtyInput, setQtyInput] = useState(1);
  const [priceInput, setPriceInput] = useState(150);
  const [consultationFee, setConsultationFee] = useState(500);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const [rightTab, setRightTab] = useState<'history' | 'emergency'>('history');
  const [patientHistory, setPatientHistory] = useState<HistoryItem[]>([]);
  const [activeEmergencies, setActiveEmergencies] = useState<EmergencyRecord[]>([]);
  const [emergencyArchive, setEmergencyArchive] = useState<EmergencyRecord[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    const stored = readDoctorSessionFromStorage();
    if (!stored) {
      router.replace('/doctor/login');
      return;
    }
    setSession(stored);
  }, [isMounted, router]);

  const fetchCockpitData = useCallback(async (options?: { showLoader?: boolean }) => {
    if (!session?.doctorId || !session?.doctorName) return;

    try {
      if (options?.showLoader) {
        setIsLoading(true);
      }

      const [res1, res2] = await Promise.all([
        supabase.from('patient_appointments').select('*').order('created_at', { ascending: false }),
        supabase.from('appointments').select('*').order('created_at', { ascending: false }),
      ]);

      const doctorSession: DoctorSession = {
        doctorId: session.doctorId,
        doctorName: session.doctorName,
        department: session.department,
        employeeId: session.doctorId,
      };

      const isForCurrentDoctor = (item: QueueAppointment) =>
        appointmentBelongsToDoctor(item as Record<string, unknown>, doctorSession);

      const rows1 = (res1.data ?? []) as QueueAppointment[];
      const rows2 = (res2.data ?? []) as QueueAppointment[];

      const list1 = rows1.filter((item: QueueAppointment) => isForCurrentDoctor(item)).map((item: QueueAppointment) => ({
        ...item,
        _source_table: 'patient_appointments',
        patient_name: item.patient_name || item.name || '',
        chief_complaint: item.reason_for_visit || item.chief_complaint || '',
        status: item.queue_status || item.status || 'WAITING',
      }));

      const list2 = rows2.filter((item: QueueAppointment) => isForCurrentDoctor(item)).map((item: QueueAppointment) => ({
        ...item,
        _source_table: 'appointments',
        patient_name: item.patient_name || item.name || '',
        chief_complaint: item.chief_complaint || item.reason_for_visit || '',
        status: item.status || item.queue_status || 'WAITING',
      }));

      const merged = dedupeEncounterList([...list1, ...list2]).sort((a, b) => {
        const tokenA = parseInt(String(a.token_number || '').replace(/\D/g, ''), 10) || 999;
        const tokenB = parseInt(String(b.token_number || '').replace(/\D/g, ''), 10) || 999;
        return tokenA - tokenB;
      });

      setAppointments(merged);
      writeLocalJson(CACHE_KEYS.doctorQueue, {
        doctorId: session.doctorId,
        appointments: merged,
        activePatientId: merged[0]?.id ?? null,
      });

      const isCompletedStatus = (s?: string) => {
        const st = (s || '').trim().toUpperCase();
        return st === 'COMPLETED' || st === 'DONE';
      };

      const waiting = merged.filter((a) => !isCompletedStatus(a.status));

      setActivePatient((prev) => {
        if (!prev && waiting.length > 0) return waiting[0];
        if (prev) {
          const updated = merged.find((a) => a.id === prev.id);
          if (updated && isCompletedStatus(updated.status)) return waiting[0] || null;
          return updated || prev;
        }
        return null;
      });

      const { data: emgActive } = await supabase
        .from('emergency_admissions')
        .select('*')
        .eq('status', 'EMERGENCY_ACTIVE')
        .order('admitted_at', { ascending: false });
      setActiveEmergencies((emgActive as EmergencyRecord[]) || []);

      const { data: emgAll } = await supabase
        .from('emergency_admissions')
        .select('*')
        .order('admitted_at', { ascending: false })
        .limit(10);
      setEmergencyArchive((emgAll as EmergencyRecord[]) || []);
    } catch (err) {
      console.error('Data fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    void fetchCockpitData({ showLoader: true });

    const channel = supabase
      .channel(`doc_node_${session.doctorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_appointments' }, () => {
        void fetchCockpitData({ showLoader: false });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        void fetchCockpitData({ showLoader: false });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_admissions' }, () => {
        void fetchCockpitData({ showLoader: false });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchCockpitData, session]);

  const handleSelectPatient = async (patient: QueueAppointment) => {
    setActivePatient(patient);
    if (session?.doctorId) {
      writeLocalJson(CACHE_KEYS.doctorQueue, {
        doctorId: session.doctorId,
        appointments,
        activePatientId: patient.id,
      });
    }
    setDiagnosis(patient.chief_complaint || patient.reason_for_visit || '');
    setClinicalNotes('');
    setDoctorAdvice('');
    setMedications([]);
    setStatusMessage(null);

    try {
      const pName = (patient.patient_name || patient.name || '').trim();
      const pId = patient.patient_id ? String(patient.patient_id) : null;

      if (!pName && !pId) {
        setPatientHistory([]);
        return;
      }

      let qConsult = supabase.from('consultations').select('*').order('created_at', { ascending: false });
      let qPrescript = supabase.from('prescriptions').select('*').order('created_at', { ascending: false });

      if (pId) {
        qConsult = qConsult.or(`patient_id.eq.${pId},patient_name.ilike.%${pName}%`);
        qPrescript = qPrescript.or(`patient_id.eq.${pId},patient_name.ilike.%${pName}%`);
      } else {
        qConsult = qConsult.ilike('patient_name', `%${pName}%`);
        qPrescript = qPrescript.ilike('patient_name', `%${pName}%`);
      }

      const [cRes, pRes] = await Promise.all([qConsult, qPrescript]);

      const consultRows = (cRes.data ?? []) as Record<string, unknown>[];
      const prescriptionRows = (pRes.data ?? []) as Record<string, unknown>[];

      const timeline: HistoryItem[] = [
        ...consultRows.map((c: Record<string, unknown>) => ({
          ...(c as HistoryItem),
          type: 'CONSULTATION',
        })),
        ...prescriptionRows.map((p: Record<string, unknown>) => ({
          ...(p as HistoryItem),
          type: 'PRESCRIPTION',
        })),
      ].sort((a: HistoryItem, b: HistoryItem) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      setPatientHistory(timeline);
    } catch {
      setPatientHistory([]);
    }
  };

  const handleAddMedication = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!drugInput.trim()) return;
    setMedications((prev) => [
      ...prev,
      {
        name: drugInput.trim(),
        dosage: dosageInput,
        timing: 'After Food',
        duration: durationInput,
        qty: Math.max(1, Number(qtyInput) || 1),
        price: Math.max(0, Number(priceInput) || 0),
      },
    ]);
    setDrugInput('');
  };

  const handleDoneAndDispatch = async () => {
    if (!activePatient) {
      toast.error('Please select an active patient encounter first.');
      return;
    }

    if (!session) {
      toast.error('Doctor session is missing. Please sign in again.');
      return;
    }

    const activeAppointmentId = String(activePatient.appointment_id || activePatient.id || '').trim();
    const patientId = String(activePatient.patient_id || activePatient.uhid || '').trim();
    const patientName = (activePatient.patient_name || activePatient.name || '').trim();
    const complaint = activePatient.chief_complaint || activePatient.reason_for_visit || '';

    if (!patientId && !patientName) {
      toast.error('Please select an active patient encounter first.');
      return;
    }

    const doctor = resolveDoctorSessionIdentity(
      getDoctorSession() ?? {
        doctorId: session.doctorId,
        doctorName: session.doctorName,
        department: session.department,
        employeeId: session.doctorId,
      },
    );

    setIsFinalizing(true);
    setStatusMessage(null);

    try {
      const result = await dispatchDigitalPrescription(supabase, {
        appointmentId: activeAppointmentId,
        sourceTable: activePatient._source_table,
        patientId: patientId || null,
        patientName: patientName || 'Patient',
        uhid: activePatient.uhid || patientId || null,
        doctorId: doctor.employeeId || doctor.doctorId,
        doctorName: doctor.doctorName,
        department: doctor.department || session.department,
        diagnosis: diagnosis.trim() || complaint || 'General Consultation',
        clinicalNotes: clinicalNotes.trim(),
        doctorInstructions: doctorAdvice.trim(),
        medications,
        vitals: activePatient.vitals_summary || null,
        consultationFee,
        hospitalId: 'HOSP-01',
      });

      if (!result.ok) {
        throw new Error(result.error || 'Failed to write prescription to the patient app.');
      }

      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['doctor-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['doctor-records'] }),
        queryClient.invalidateQueries({ queryKey: ['patient-prescriptions'] }),
      ]);

      toast.success('Consultation billed and prescription dispatched to patient + hospital cashier.');
      setStatusMessage({
        type: 'success',
        text: 'Pending invoice posted to Hospital Billing & Checkout Queue.',
      });
      setDiagnosis('');
      setClinicalNotes('');
      setDoctorAdvice('');
      setMedications([]);
      setDrugInput('');
      await fetchCockpitData({ showLoader: false });
    } catch (err: unknown) {
      console.error('Error dispatching prescription:', err);
      const message = err instanceof Error ? err.message : 'Unknown database error';
      setStatusMessage({ type: 'error', text: `Dispatch failed: ${message}` });
      toast.error(`Dispatch failed: ${message}`);
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('active_doctor_session');
    sessionStorage.removeItem('active_doctor_session');
    router.replace('/doctor/login');
  };

  if (!isMounted || !session) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
          Authenticating Clinician Node...
        </div>
      </div>
    );
  }

  const isCompleted = (status?: string) => {
    const s = (status || '').trim().toUpperCase();
    return s === 'COMPLETED' || s === 'DONE';
  };

  const waitingList = appointments.filter((a) => !isCompleted(a.status));
  const completedList = appointments.filter((a) => isCompleted(a.status));

  const filteredQueue = (queueTab === 'waiting' ? waitingList : completedList).filter((item) => {
    const name = item.patient_name || '';
    const token = String(item.token_number || '');
    const q = searchQuery.toLowerCase().trim();
    return name.toLowerCase().includes(q) || token.toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F8FAFC] text-slate-800 font-sans">
      <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-teal-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base text-slate-900">Regal Clinical Workstation</h1>
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Node Sync
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {session.department} • Isolated Clinician Environment
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-teal-600" />
            <span className="font-bold text-slate-800">{session.doctorName}</span>
            <span className="text-[10px] text-teal-700 font-mono font-bold">({session.doctorId})</span>
          </div>

          <button
            type="button"
            onClick={() => void fetchCockpitData({ showLoader: true })}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 transition-all cursor-pointer"
            title="Refresh Live Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {activeEmergencies.length > 0 && (
        <div className="bg-rose-50 border-b border-rose-200 text-rose-900 px-6 py-2 flex items-center justify-between text-xs shrink-0 animate-pulse">
          <div className="flex items-center gap-2 font-semibold">
            <Siren className="w-4 h-4 text-rose-600" />
            <span>
              <strong>CODE RED ALERT:</strong> Patient{' '}
              <span className="underline font-bold">{activeEmergencies[0].patient_name}</span> in Bed{' '}
              {activeEmergencies[0].bed_number || '—'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setRightTab('emergency')}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1 rounded-lg text-[11px] cursor-pointer"
          >
            Open ER Status →
          </button>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3.5 p-3.5 overflow-hidden">
        <section className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl flex flex-col h-full overflow-hidden shadow-xs">
          <div className="p-3.5 border-b border-slate-100 bg-slate-50/70 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black tracking-wider uppercase text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-600" />
                1. Patient Queue
              </span>
              <div className="flex bg-slate-200/80 p-0.5 rounded-xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setQueueTab('waiting')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    queueTab === 'waiting' ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Waiting ({waitingList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setQueueTab('done')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    queueTab === 'done' ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Done ({completedList.length})
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Filter patient name or token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 min-h-0">
            {isLoading ? (
              <div className="text-center py-12 text-xs text-slate-400">Loading queue...</div>
            ) : filteredQueue.length === 0 ? (
              <div className="text-center py-16 text-xs text-slate-400">
                No assigned patients found for {session.doctorName}.
              </div>
            ) : (
              filteredQueue.map((patient) => {
                const isSelected = activePatient?.id === patient.id;
                const done = isCompleted(patient.status);

                return (
                  <div
                    key={patient.id}
                    onClick={() => handleSelectPatient(patient)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer shrink-0 relative ${
                      isSelected
                        ? 'bg-teal-50/70 border-teal-500 shadow-xs ring-1 ring-teal-500'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-teal-600 rounded-l-xl" />
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-8 h-8 rounded-xl bg-slate-900 text-teal-300 text-xs font-black flex items-center justify-center font-mono shrink-0">
                          {formatToken(patient.token_number)}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate">
                            {patient.patient_name || '—'}
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            {patient.age ? `${patient.age} Yrs` : '—'} • {patient.gender || '—'}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md shrink-0 ${
                          done
                            ? 'bg-slate-100 text-slate-600 border border-slate-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {patient.status || 'WAITING'}
                      </span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="truncate max-w-[140px] text-slate-600">
                        {patient.chief_complaint || '—'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {patient.appointment_time || patient.time_slot || '—'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl flex flex-col h-full overflow-hidden shadow-xs">
          {activePatient ? (
            <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 gap-3.5">
              {statusMessage && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 shrink-0 ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{statusMessage.text}</span>
                </div>
              )}

              <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between shadow-xs shrink-0">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-teal-800 border border-teal-600 text-teal-200 flex items-center justify-center font-black text-sm font-mono">
                    {formatToken(activePatient.token_number)}
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-white">
                      {activePatient.patient_name || '—'}
                    </h2>
                    <p className="text-xs text-slate-300">
                      {activePatient.age ? `${activePatient.age} Yrs` : '—'} •{' '}
                      {activePatient.gender || '—'} • Slot:{' '}
                      {activePatient.appointment_time || activePatient.time_slot || '—'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Intake Vitals
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {activePatient.vitals_summary || '—'}
                  </span>
                </div>
              </div>

              <div className="bg-teal-50/70 border border-teal-200/80 rounded-xl p-3 flex items-start gap-2.5 shrink-0">
                <FileText className="w-4 h-4 text-teal-700 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <span className="text-[10px] font-black uppercase text-teal-900 tracking-wider block">
                    Reported Chief Complaint
                  </span>
                  <p className="text-xs font-bold text-teal-950 mt-0.5">
                    {activePatient.chief_complaint || activePatient.reason_for_visit || '—'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 shrink-0">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                    Diagnosis
                  </label>
                  <input
                    type="text"
                    placeholder="Enter confirmed diagnosis..."
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-teal-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                    Examination Findings
                  </label>
                  <input
                    type="text"
                    placeholder="Clinical findings / notes..."
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-teal-600 outline-none"
                  />
                </div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 flex-1 flex flex-col min-h-[220px]">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2 shrink-0">
                  <Pill className="w-3.5 h-3.5 text-teal-700" />
                  Prescription Pad ({medications.length} Prescribed)
                </span>

                <div className="mb-2.5 grid grid-cols-2 gap-2 shrink-0">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                    Consultation fee (₹)
                    <input
                      type="number"
                      min={0}
                      value={consultationFee}
                      onChange={(e) => setConsultationFee(Number(e.target.value) || 0)}
                      className="mt-1 w-full text-xs font-mono font-bold p-2 bg-white border border-slate-200 rounded-xl outline-none"
                    />
                  </label>
                  <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2">
                    <div className="text-[10px] font-black uppercase text-teal-800">Bill preview</div>
                    <div className="text-sm font-black text-teal-950 font-mono">
                      ₹
                      {consultationFee +
                        medications.reduce((sum, med) => sum + med.qty * med.price, 0)}
                    </div>
                    <div className="text-[10px] text-teal-700">Consult + medicines → cashier</div>
                  </div>
                </div>

                <form onSubmit={handleAddMedication} className="flex flex-wrap items-center gap-2 mb-2.5 shrink-0">
                  <input
                    type="text"
                    placeholder="Enter medicine name..."
                    value={drugInput}
                    onChange={(e) => setDrugInput(e.target.value)}
                    className="flex-1 min-w-[140px] text-xs p-2 bg-white border border-slate-200 rounded-xl outline-none"
                  />
                  <select
                    value={dosageInput}
                    onChange={(e) => setDosageInput(e.target.value)}
                    className="text-xs p-2 bg-white border border-slate-200 rounded-xl"
                  >
                    <option value="1-0-1">1-0-1 (BID)</option>
                    <option value="1-1-1">1-1-1 (TID)</option>
                    <option value="1-0-0">1-0-0 (Morning)</option>
                    <option value="0-0-1">0-0-1 (Night)</option>
                    <option value="STAT">1 STAT (Immediate)</option>
                  </select>
                  <select
                    value={durationInput}
                    onChange={(e) => setDurationInput(e.target.value)}
                    className="text-xs p-2 bg-white border border-slate-200 rounded-xl"
                  >
                    <option value="3 Days">3 Days</option>
                    <option value="5 Days">5 Days</option>
                    <option value="7 Days">7 Days</option>
                    <option value="15 Days">15 Days</option>
                    <option value="30 Days">30 Days</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={qtyInput}
                    onChange={(e) => setQtyInput(Number(e.target.value) || 1)}
                    className="w-16 text-xs p-2 bg-white border border-slate-200 rounded-xl font-mono"
                    title="Quantity"
                  />
                  <input
                    type="number"
                    min={0}
                    value={priceInput}
                    onChange={(e) => setPriceInput(Number(e.target.value) || 0)}
                    className="w-20 text-xs p-2 bg-white border border-slate-200 rounded-xl font-mono"
                    title="Unit price"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </form>

                <div className="flex-1 overflow-y-auto max-h-[140px] flex flex-col gap-1.5 pr-1">
                  {medications.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400 italic">
                      No drugs added yet. Type medication above.
                    </div>
                  ) : (
                    medications.map((med, i) => (
                      <div
                        key={i}
                        className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex items-center justify-between text-xs shrink-0"
                      >
                        <span className="font-bold text-slate-900">{med.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded font-mono text-[10px] font-bold">
                            {med.dosage}
                          </span>
                          <span className="text-slate-600 text-[11px]">{med.duration}</span>
                          <span className="font-mono text-[10px] font-bold text-slate-700">
                            {med.qty} × ₹{med.price}
                          </span>
                          <button
                            type="button"
                            onClick={() => setMedications((prev) => prev.filter((_, idx) => idx !== i))}
                            className="text-rose-500 hover:text-rose-700 ml-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <input
                  type="text"
                  placeholder="Doctor's Instructions / Dietary Advice..."
                  value={doctorAdvice}
                  onChange={(e) => setDoctorAdvice(e.target.value)}
                  className="mt-2.5 w-full text-xs p-2 bg-white border border-slate-200 rounded-xl text-slate-800 outline-none shrink-0"
                />
              </div>

              <button
                type="button"
                disabled={isFinalizing}
                onClick={handleDoneAndDispatch}
                className="w-full py-4 bg-teal-800 hover:bg-teal-900 active:bg-teal-950 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                {isFinalizing ? 'DISPATCHING TO PATIENT APP...' : '✓ DONE & DISPATCH DIGITAL PRESCRIPTION'}
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                <User className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-slate-700 text-sm">No Patient Selected</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Select an appointment from Section 1 to begin encounter.
              </p>
            </div>
          )}
        </section>

        <section className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl flex flex-col h-full overflow-hidden shadow-xs">
          <div className="p-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between shrink-0">
            <span className="text-xs font-black tracking-wider uppercase text-slate-600">3. Records & SOS</span>
            <div className="flex bg-slate-200/80 p-0.5 rounded-xl text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setRightTab('history')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  rightTab === 'history' ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                360 History
              </button>
              <button
                type="button"
                onClick={() => setRightTab('emergency')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  rightTab === 'emergency' ? 'bg-white text-rose-800 shadow-xs' : 'text-slate-600'
                }`}
              >
                SOS Archive
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 min-h-0">
            {rightTab === 'history' ? (
              patientHistory.length === 0 ? (
                <div className="text-center py-16 text-xs text-slate-400">No prior consultation records.</div>
              ) : (
                patientHistory.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs shrink-0">
                    <div className="flex items-center justify-between text-[10px] font-bold mb-1.5">
                      <span className="text-teal-800 uppercase font-black">{item.type}</span>
                      <span className="text-slate-500">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {item.diagnosis && (
                      <p className="font-extrabold text-slate-900 text-xs mb-1">{item.diagnosis}</p>
                    )}
                    {item.clinical_notes && (
                      <p className="text-slate-600 text-[11px] leading-relaxed mb-1.5">{item.clinical_notes}</p>
                    )}
                    {item.medications && Array.isArray(item.medications) && (
                      <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-800">
                        <span className="font-bold text-teal-800">Rx: </span>
                        {item.medications.map((m) => m.name).join(', ')}
                      </div>
                    )}
                  </div>
                ))
              )
            ) : emergencyArchive.length === 0 ? (
              <div className="text-center py-16 text-xs text-slate-400">No emergency records logged.</div>
            ) : (
              emergencyArchive.map((emg, idx) => (
                <div key={idx} className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl text-xs shrink-0">
                  <div className="flex items-center justify-between text-[10px] font-black mb-1">
                    <span className="text-rose-800">BED {emg.bed_number || '—'}</span>
                    <span className="text-slate-500">
                      {new Date(emg.admitted_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <h5 className="font-bold text-slate-900 text-xs">{emg.patient_name}</h5>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    {emg.chief_complaint || emg.reason_for_visit || '—'}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
