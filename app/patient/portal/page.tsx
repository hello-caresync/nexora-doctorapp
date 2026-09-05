'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  fetchActiveHospitalDoctors,
  formatConsultationFee,
  type DoctorStaffRecord,
} from '@/lib/hospital/hospital-staff-roster';
import { HOSPITAL_TENANT_ID } from '@/lib/regal/constants';
import { mintPatientUhid, readPatientPortalSession } from '@/lib/patient/portal-session';
import { supabase } from '@/lib/supabaseClient';

export default function PatientPortalPage() {
  const router = useRouter();
  const [doctorList, setDoctorList] = useState<DoctorStaffRecord[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorStaffRecord | null>(null);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(true);
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [isBookingAppointment, setIsBookingAppointment] = useState(false);

  useEffect(() => {
    const session = readPatientPortalSession();
    if (session) {
      setPatientName(session.patient_name);
      setPatientPhone(session.phone.replace(/^\+91\s*/, ''));
    }

    let cancelled = false;
    const loadDoctors = () =>
      fetchActiveHospitalDoctors(supabase, HOSPITAL_TENANT_ID).then((rows) => {
        if (cancelled) return;
        setDoctorList(rows);
        setSelectedDoctor((prev) => rows.find((row) => row.id === prev?.id) ?? rows[0] ?? null);
        setIsLoadingDoctors(false);
      });

    void loadDoctors();
    const channel = supabase
      ?.channel('patient_booking_doctors')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hospital_staff', filter: `hospital_id=eq.${HOSPITAL_TENANT_ID}` },
        () => void loadDoctors(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) void supabase?.removeChannel(channel);
    };
  }, []);

  const handleBookAppointment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isBookingAppointment) return;

    const name = patientName.trim();
    const phone = patientPhone.trim();
    if (!name || !phone) {
      toast.error('Patient name and contact number are required');
      return;
    }
    if (!selectedDoctor) {
      toast.error('Select a consulting doctor');
      return;
    }

    setIsBookingAppointment(true);
    try {
      const session = readPatientPortalSession();
      const uhid = session?.uhid || mintPatientUhid();
      const payload: Record<string, unknown> = {
        hospital_id: HOSPITAL_TENANT_ID,
        uhid,
        patient_name: name,
        patient_phone: phone,
        phone,
        doctor_id: selectedDoctor.id,
        doctor_name: selectedDoctor.full_name,
        department: selectedDoctor.department,
        consultation_fee: selectedDoctor.consultation_fee,
        status: 'waiting',
        billing_status: 'pending_checkout',
        source: 'patient_app',
        appointment_date: new Date().toISOString().split('T')[0],
      };

      let { error } = await supabase.from('appointments').insert([payload]).select().maybeSingle();
      if (error) {
        delete payload.billing_status;
        const retry = await supabase.from('appointments').insert([payload]).select().maybeSingle();
        error = retry.error;
      }
      if (error) throw error;

      toast.success(
        `Booked ${selectedDoctor.full_name} · ${formatConsultationFee(selectedDoctor.consultation_fee)}`,
      );
      setPatientName(session?.patient_name || '');
      setPatientPhone(session?.phone.replace(/^\+91\s*/, '') || '');
      router.push('/patient/appointments');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not book appointment');
    } finally {
      setIsBookingAppointment(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-[#0E2924]">SmartQ Patient Booking</h1>
        <p className="text-xs font-bold text-[#227B6B]">Regal Hospital · Node HOSP-01 · {doctorList.length} specialists</p>
      </div>

      <form
        onSubmit={(event) => void handleBookAppointment(event)}
        className="rounded-3xl border border-[#D5E8E3] bg-white p-6 space-y-4"
      >
        <label className="block text-[10px] font-black uppercase text-[#227B6B]">
          Patient full name
          <input
            required
            disabled={isBookingAppointment}
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            className="mt-1 w-full rounded-2xl border border-[#D5E8E3] p-3 text-xs font-bold text-[#0E2924]"
          />
        </label>
        <label className="block text-[10px] font-black uppercase text-[#227B6B]">
          Contact number
          <input
            required
            disabled={isBookingAppointment}
            value={patientPhone}
            onChange={(e) => setPatientPhone(e.target.value)}
            className="mt-1 w-full rounded-2xl border border-[#D5E8E3] p-3 text-xs font-bold text-[#0E2924]"
          />
        </label>
        <label className="block text-[10px] font-black uppercase text-[#227B6B]">
          Consulting specialist
          <select
            required
            disabled={isLoadingDoctors || isBookingAppointment}
            value={selectedDoctor?.id ?? ''}
            onChange={(e) => {
              const next = doctorList.find((doc) => doc.id === e.target.value) ?? null;
              setSelectedDoctor(next);
            }}
            className="mt-1 w-full rounded-2xl border border-[#D5E8E3] p-3 text-xs font-black text-[#113831]"
          >
            {isLoadingDoctors ? (
              <option value="">Loading specialists…</option>
            ) : doctorList.length === 0 ? (
              <option value="">No active doctors published yet</option>
            ) : (
              doctorList.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.full_name} — {doc.department} ({formatConsultationFee(doc.consultation_fee)})
                </option>
              ))
            )}
          </select>
        </label>
        {selectedDoctor && (
          <div className="rounded-xl border border-[#D5E8E3] bg-[#EAF5F2]/70 px-3 py-2 text-[11px] font-semibold text-[#113831]">
            {selectedDoctor.department}
            {selectedDoctor.qualification ? ` · ${selectedDoctor.qualification}` : ''}
            {' · '}
            {formatConsultationFee(selectedDoctor.consultation_fee)}
          </div>
        )}
        <button
          type="submit"
          disabled={isBookingAppointment || isLoadingDoctors || !selectedDoctor}
          className="w-full rounded-2xl bg-[#113831] py-3 text-xs font-black text-white disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isBookingAppointment ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Booking…
            </>
          ) : (
            'Confirm appointment'
          )}
        </button>
      </form>
    </div>
  );
}
