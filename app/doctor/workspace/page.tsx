'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { completeConsultationWithInvoice } from '@/lib/billing/post-consultation-invoice';
import { postConsultationPharmacyBridge } from '@/lib/hospital/records-pharmacy';
import {
  appointmentBelongsToDoctor,
  clearDoctorSession,
  getDoctorSession,
  type DoctorSession,
} from '@/lib/doctor/session';
import { HOSPITAL_TENANT_ID } from '@/lib/regal/constants';
import { dedupeEncounterList } from '@/lib/queue/dedupe-encounters';
import { supabase } from '@/lib/supabase';

type WorkspaceAppointment = {
  id: string;
  appointment_id?: string;
  patient_id?: string;
  patient_name: string;
  uhid?: string;
  doctor_id?: string;
  doctor_name?: string;
  hospital_id?: string;
  department?: string;
  status?: string;
  token_number?: string | number;
  appointment_time?: string;
  time_slot?: string;
  chief_complaint?: string;
};

interface PrescribedMedicine {
  name: string;
  qty: number;
  price: number;
}

const EMPTY_MED: PrescribedMedicine = { name: '', qty: 1, price: 0 };

function isOpenEncounter(status?: string): boolean {
  const value = String(status ?? '').toLowerCase();
  return !/complete|done|paid|cancel|closed/.test(value);
}

export default function DoctorWorkspacePage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [doctorSession, setDoctorSession] = useState<DoctorSession | null>(null);
  const [appointments, setAppointments] = useState<WorkspaceAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeConsultation, setActiveConsultation] = useState<WorkspaceAppointment | null>(null);
  const [consultationFee, setConsultationFee] = useState(500);
  const [prescribedMedicines, setPrescribedMedicines] = useState<PrescribedMedicine[]>([{ ...EMPTY_MED }]);
  const [isSubmittingBill, setIsSubmittingBill] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    const session = getDoctorSession();
    if (!session?.doctorId) {
      router.replace('/doctor/login');
      return;
    }
    setDoctorSession(session);
  }, [isMounted, router]);

  const fetchDoctorAppointments = useCallback(async () => {
    if (!doctorSession?.doctorId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = dedupeEncounterList((data ?? []) as Record<string, unknown>[])
        .filter((row) => appointmentBelongsToDoctor(row, doctorSession))
        .map((row) => ({
          id: String(row.id ?? row.appointment_id ?? ''),
          appointment_id: row.appointment_id ? String(row.appointment_id) : undefined,
          patient_id: row.patient_id ? String(row.patient_id) : undefined,
          patient_name: String(row.patient_name ?? row.name ?? 'Patient'),
          uhid: row.uhid ? String(row.uhid) : undefined,
          doctor_id: row.doctor_id ? String(row.doctor_id) : undefined,
          doctor_name: row.doctor_name ? String(row.doctor_name) : undefined,
          hospital_id: row.hospital_id ? String(row.hospital_id) : HOSPITAL_TENANT_ID,
          department: row.department ? String(row.department) : undefined,
          status: row.status ? String(row.status) : 'WAITING',
          token_number: row.token_number as string | number | undefined,
          appointment_time: row.appointment_time ? String(row.appointment_time) : undefined,
          time_slot: row.time_slot ? String(row.time_slot) : undefined,
          chief_complaint: String(row.chief_complaint ?? row.reason_for_visit ?? ''),
        }));

      setAppointments(rows);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to load appointments';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [doctorSession]);

  useEffect(() => {
    if (!doctorSession) return;
    void fetchDoctorAppointments();

    const channel = supabase
      .channel(`doctor_workspace_queue_${doctorSession.doctorId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          void fetchDoctorAppointments();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [doctorSession, fetchDoctorAppointments]);

  const waitingRoom = useMemo(
    () => appointments.filter((row) => isOpenEncounter(row.status)),
    [appointments],
  );

  const medicinesTotal = prescribedMedicines.reduce(
    (sum, med) => sum + (med.name.trim() ? Number(med.qty) * Number(med.price) : 0),
    0,
  );
  const grandTotal = Number(consultationFee) + medicinesTotal;

  const handleAddMedicineRow = () => {
    setPrescribedMedicines((prev) => [...prev, { ...EMPTY_MED }]);
  };

  const handleMedicineChange = (index: number, field: keyof PrescribedMedicine, value: string) => {
    setPrescribedMedicines((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: field === 'name' ? value : Number(value) || 0,
      };
      return updated;
    });
  };

  const handleRemoveMedicineRow = (index: number) => {
    setPrescribedMedicines((prev) => (prev.length === 1 ? [{ ...EMPTY_MED }] : prev.filter((_, i) => i !== index)));
  };

  const closeConsultation = () => {
    setActiveConsultation(null);
    setPrescribedMedicines([{ ...EMPTY_MED }]);
    setConsultationFee(500);
  };

  const handleCompleteConsultation = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!activeConsultation || isSubmittingBill) return;

    setIsSubmittingBill(true);
    try {
      const validMedicines = prescribedMedicines.filter((med) => med.name.trim() !== '');
      const result = await completeConsultationWithInvoice(supabase, {
        appointmentId: activeConsultation.appointment_id || activeConsultation.id,
        hospitalId: doctorSession?.hospitalCode || activeConsultation.hospital_id || HOSPITAL_TENANT_ID,
        uhid: activeConsultation.uhid || `UHID-${activeConsultation.id.slice(0, 6)}`,
        patientName: activeConsultation.patient_name,
        doctorId: doctorSession?.doctorId || activeConsultation.doctor_id,
        doctorName: doctorSession?.doctorName || doctorSession?.fullName || activeConsultation.doctor_name,
        consultationFee,
        medicines: validMedicines,
      });

      if (!result.ok) {
        throw new Error(result.error || 'Error processing consultation and invoice.');
      }

      void postConsultationPharmacyBridge(supabase, {
        hospitalId: doctorSession?.hospitalCode || activeConsultation.hospital_id || HOSPITAL_TENANT_ID,
        appointmentId: activeConsultation.appointment_id || activeConsultation.id,
        uhid: activeConsultation.uhid || `UHID-${activeConsultation.id.slice(0, 6)}`,
        patientName: activeConsultation.patient_name,
        doctorId: doctorSession?.doctorId || activeConsultation.doctor_id,
        doctorName: doctorSession?.doctorName || doctorSession?.fullName || activeConsultation.doctor_name,
        medicines: validMedicines.map((med) => ({
          name: med.name,
          qty: med.qty,
        })),
      });

      toast.success(`Consultation completed! Bill of ₹${result.totalAmount} routed to Hospital Billing Desk.`);
      closeConsultation();
      await fetchDoctorAppointments();
    } catch (err: unknown) {
      console.error('Failed to complete consultation:', err);
      const message = err instanceof Error ? err.message : 'Error processing consultation and invoice.';
      toast.error(message);
    } finally {
      setIsSubmittingBill(false);
    }
  };

  if (!isMounted || !doctorSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-teal-700" />
          Opening clinical workspace…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans">
      <header className="h-16 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center shrink-0 aspect-square overflow-hidden">
            <img
              src="/regal-logo-transparent.png"
              alt="Regal Hospital"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="h-6 w-px bg-gray-200 dark:bg-zinc-800 hidden sm:block" />
          <div>
            <h1 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
              Doctor Clinical Workspace
            </h1>
            <p className="text-[11px] text-gray-500 dark:text-zinc-400">
              OPD Consultation &amp; Pharmacy Routing · Node HOSP-01
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-gray-900 dark:text-white">
              {doctorSession.fullName || doctorSession.doctorName || 'Dr. Suriraju V'}
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              {doctorSession.department || 'Consultant Specialist'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void fetchDoctorAppointments()}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              clearDoctorSession();
              router.replace('/doctor/login');
            }}
            className="p-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <Clock className="w-3.5 h-3.5" />
          {waitingRoom.length} patient{waitingRoom.length === 1 ? '' : 's'} in the active waiting room
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading appointments…
          </div>
        ) : waitingRoom.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            Waiting room is clear. New bookings and walk-ins appear here.
          </div>
        ) : (
          <div className="space-y-2">
            {waitingRoom.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-black text-slate-900">{item.patient_name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {item.token_number || item.uhid || item.id.slice(0, 8)} · {item.appointment_time || item.time_slot || 'Walk-in'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveConsultation(item)}
                  className="px-3 py-2 rounded-xl bg-teal-800 text-white text-xs font-bold"
                >
                  Complete & Bill
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {activeConsultation && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form
            onSubmit={(event) => void handleCompleteConsultation(event)}
            className="w-full max-w-lg rounded-3xl bg-white p-5 space-y-4 border border-slate-200 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900">Complete consultation</h2>
                <p className="text-xs text-slate-500">{activeConsultation.patient_name}</p>
              </div>
              <button type="button" onClick={closeConsultation} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <label className="block text-[11px] font-bold uppercase text-slate-600">
              Consultation fee (₹)
              <input
                type="number"
                min={0}
                value={consultationFee}
                onChange={(e) => setConsultationFee(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
              />
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-600">Prescribed medicines</span>
                <button type="button" onClick={handleAddMedicineRow} className="text-[11px] font-bold text-teal-800 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add row
                </button>
              </div>
              {prescribedMedicines.map((med, index) => (
                <div key={`med-${index}`} className="grid grid-cols-12 gap-2">
                  <input
                    value={med.name}
                    onChange={(e) => handleMedicineChange(index, 'name', e.target.value)}
                    placeholder="Medicine"
                    className="col-span-6 rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                  <input
                    type="number"
                    min={1}
                    value={med.qty}
                    onChange={(e) => handleMedicineChange(index, 'qty', e.target.value)}
                    className="col-span-2 rounded-xl border border-slate-200 px-2 py-2 text-xs font-mono"
                  />
                  <input
                    type="number"
                    min={0}
                    value={med.price}
                    onChange={(e) => handleMedicineChange(index, 'price', e.target.value)}
                    className="col-span-3 rounded-xl border border-slate-200 px-2 py-2 text-xs font-mono"
                  />
                  <button type="button" onClick={() => handleRemoveMedicineRow(index)} className="col-span-1 text-rose-500">
                    <Trash2 className="w-4 h-4 mx-auto" />
                  </button>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs flex justify-between font-bold">
              <span>Medicines ₹{medicinesTotal} · Grand total</span>
              <span className="font-mono">₹{grandTotal}</span>
            </div>

            <button
              type="submit"
              disabled={isSubmittingBill}
              className="w-full py-3 rounded-xl bg-teal-800 text-white text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmittingBill ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {isSubmittingBill ? 'Posting invoice…' : 'Complete & send to billing desk'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
