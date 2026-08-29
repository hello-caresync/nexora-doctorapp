'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
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
  patient_id?: string | null;
  patient_name?: string;
  name?: string;
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
  doctor_name?: string;
  created_at?: string;
  _source_table?: string;
};

type MedicationRow = {
  name: string;
  dosage: string;
  timing: string;
  duration: string;
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

function formatToken(token?: string | number | null): string {
  if (token === undefined || token === null || String(token).trim() === '') return '—';
  return `#${String(token).replace(/^#/, '')}`;
}

export default function DoctorWorkstation() {
  const router = useRouter();

  const [session, setSession] = useState<ActiveDoctorSession | null>(null);
  const [appointments, setAppointments] = useState<QueueAppointment[]>([]);
  const [activePatient, setActivePatient] = useState<QueueAppointment | null>(null);
  const [queueTab, setQueueTab] = useState<'waiting' | 'done'>('waiting');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [diagnosis, setDiagnosis] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [doctorAdvice, setDoctorAdvice] = useState('');
  const [medications, setMedications] = useState<MedicationRow[]>([]);
  const [drugInput, setDrugInput] = useState('');
  const [dosageInput, setDosageInput] = useState('1-0-1');
  const [durationInput, setDurationInput] = useState('3 Days');
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const [rightTab, setRightTab] = useState<'history' | 'emergency'>('history');
  const [patientHistory, setPatientHistory] = useState<HistoryItem[]>([]);
  const [activeEmergencies, setActiveEmergencies] = useState<EmergencyRecord[]>([]);
  const [emergencyArchive, setEmergencyArchive] = useState<EmergencyRecord[]>([]);

  useEffect(() => {
    const raw =
      typeof window !== 'undefined'
        ? localStorage.getItem('active_doctor_session') || sessionStorage.getItem('active_doctor_session')
        : null;

    if (!raw) {
      router.replace('/doctor/login');
      return;
    }

    try {
      const parsed = JSON.parse(raw) as ActiveDoctorSession;
      if (!parsed.doctorId || !parsed.doctorName) {
        router.replace('/doctor/login');
        return;
      }
      setSession(parsed);
    } catch {
      router.replace('/doctor/login');
    }
  }, [router]);

  const fetchCockpitData = useCallback(async () => {
    if (!session?.doctorId || !session?.doctorName) return;

    try {
      setIsLoading(true);
      const currentDocId = session.doctorId.trim().toLowerCase();
      const currentDocName = session.doctorName.replace(/^Dr\.?\s*/i, '').trim().toLowerCase();

      const [res1, res2] = await Promise.all([
        supabase.from('patient_appointments').select('*').order('created_at', { ascending: false }),
        supabase.from('appointments').select('*').order('created_at', { ascending: false }),
      ]);

      const isForCurrentDoctor = (item: QueueAppointment) => {
        const itemDocId = (item.doctor_id || item.doctor_code || '').trim().toLowerCase();
        const itemDocName = (item.doctor_name || '').replace(/^Dr\.?\s*/i, '').trim().toLowerCase();

        const idMatches = Boolean(itemDocId && currentDocId && itemDocId === currentDocId);
        const nameMatches = Boolean(
          itemDocName &&
            currentDocName &&
            (itemDocName.includes(currentDocName) || currentDocName.includes(itemDocName)),
        );

        return idMatches || nameMatches;
      };

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

      const map = new Map<string, QueueAppointment>();
      [...list1, ...list2].forEach((item) => {
        const key = item.id ? String(item.id) : `${item.patient_name}_${item.token_number}_${item.created_at}`;
        if (!map.has(key)) map.set(key, item);
      });

      const merged = Array.from(map.values()).sort((a, b) => {
        const tokenA = parseInt(String(a.token_number || '').replace(/\D/g, ''), 10) || 999;
        const tokenB = parseInt(String(b.token_number || '').replace(/\D/g, ''), 10) || 999;
        return tokenA - tokenB;
      });

      setAppointments(merged);

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
    fetchCockpitData();

    const channel = supabase
      .channel(`doc_node_${session.doctorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_appointments' }, () =>
        fetchCockpitData(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () =>
        fetchCockpitData(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_admissions' }, () =>
        fetchCockpitData(),
      )
      .subscribe();

    const interval = setInterval(fetchCockpitData, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchCockpitData, session]);

  const handleSelectPatient = async (patient: QueueAppointment) => {
    setActivePatient(patient);
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
      { name: drugInput.trim(), dosage: dosageInput, timing: 'After Food', duration: durationInput },
    ]);
    setDrugInput('');
  };

  const handleDoneAndDispatch = async () => {
    if (!activePatient || !session) return;

    setIsFinalizing(true);
    setStatusMessage(null);

    const targetId = String(activePatient.id);
    const pName = activePatient.patient_name || activePatient.name || '';
    const pId = activePatient.patient_id ? String(activePatient.patient_id) : null;
    const complaint = activePatient.chief_complaint || activePatient.reason_for_visit || '';

    if (!pId) {
      setStatusMessage({
        type: 'error',
        text: 'Cannot dispatch prescription without a verified patient_id on the appointment record.',
      });
      setIsFinalizing(false);
      return;
    }

    if (!pName) {
      setStatusMessage({ type: 'error', text: 'Cannot dispatch prescription without a verified patient name.' });
      setIsFinalizing(false);
      return;
    }

    try {
      const { error: rxError } = await supabase.from('prescriptions').insert([
        {
          appointment_id: targetId,
          patient_id: pId,
          patient_name: pName,
          doctor_name: session.doctorName,
          doctor_id: session.doctorId,
          diagnosis: diagnosis.trim() || complaint,
          medications,
          instructions: doctorAdvice.trim() || '',
          status: 'DISPATCHED',
          created_at: new Date().toISOString(),
        },
      ]);

      if (rxError) throw rxError;

      await Promise.allSettled([
        supabase
          .from('patient_appointments')
          .update({ status: 'COMPLETED', queue_status: 'COMPLETED' })
          .eq('id', targetId),
        supabase
          .from('appointments')
          .update({ status: 'COMPLETED', queue_status: 'COMPLETED' })
          .eq('id', targetId),
      ]);

      await supabase.from('consultations').insert([
        {
          appointment_id: targetId,
          patient_id: pId,
          patient_name: pName,
          doctor_name: session.doctorName,
          doctor_id: session.doctorId,
          chief_complaint: complaint,
          diagnosis: diagnosis.trim() || complaint,
          clinical_notes: clinicalNotes.trim() || '',
          status: 'COMPLETED',
          created_at: new Date().toISOString(),
        },
      ]);

      setStatusMessage({ type: 'success', text: `Prescription dispatched successfully for ${pName}.` });
      setDiagnosis('');
      setClinicalNotes('');
      setDoctorAdvice('');
      setMedications([]);
      fetchCockpitData();
    } catch (err: unknown) {
      console.error('Dispatch failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to dispatch prescription to patient app.';
      setStatusMessage({ type: 'error', text: message });
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('active_doctor_session');
    sessionStorage.removeItem('active_doctor_session');
    router.replace('/doctor/login');
  };

  if (!session) {
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
            onClick={fetchCockpitData}
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
