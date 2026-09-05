'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import {
  calculateNextOpdTokenNumber,
} from '@/lib/hospital/operations/appointment-sync';
import {
  HOSPITAL_TENANT_ID,
  REGAL_FACILITY_CODE,
  REGAL_HOSPITAL_ID,
} from '@/lib/regal/constants';
import { isUuidColumnError, isUuidValue } from '@/lib/hospital/hospital-node';
import { readPatientPortalSession, mintPatientUhid } from '@/lib/patient/portal-session';
import {
  getActivePatientId,
  getActivePatientName,
  persistActivePatientNode,
} from '@/lib/patient/active-patient-node';
import {
  Stethoscope,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  ArrowRight,
  Loader2,
  FileText,
  Users,
  Building2,
  AlertCircle,
} from 'lucide-react';

interface DoctorDirectoryItem {
  id: string;
  name: string;
  department: string;
  fee: string;
}

interface FamilyMemberOption {
  id: string;
  name: string;
  relation: string;
}

// COMPLETE 41 REGAL HOSPITAL CONSULTANTS
const ALL_41_DOCTORS: DoctorDirectoryItem[] = [
  { id: 'RH-D01', name: 'Dr. Suriraju V', department: 'Urology', fee: '₹700' },
  { id: 'RH-D02', name: 'Dr. Chandrakanth S. Kesari', department: 'General Surgery', fee: '₹800' },
  { id: 'RH-D03', name: 'Dr. Ananya R', department: 'General Medicine', fee: '₹600' },
  { id: 'RH-D04', name: 'Dr. Vikramaditya Rao', department: 'Cardiology', fee: '₹900' },
  { id: 'RH-D05', name: 'Dr. Meera Nambiar', department: 'Cardiology', fee: '₹850' },
  { id: 'RH-D06', name: 'Dr. Rajesh Kumar Hegde', department: 'Orthopedics', fee: '₹850' },
  { id: 'RH-D07', name: 'Dr. Shalini Deshmukh', department: 'Orthopedics', fee: '₹750' },
  { id: 'RH-D08', name: 'Dr. Arvind Swamy', department: 'Neurology', fee: '₹950' },
  { id: 'RH-D09', name: 'Dr. Kavitha Reddy', department: 'Neurosurgery', fee: '₹1200' },
  { id: 'RH-D10', name: 'Dr. Pradeep Verma', department: 'Gastroenterology', fee: '₹800' },
  { id: 'RH-D11', name: 'Dr. Sunitha Gopal', department: 'Gastroenterology', fee: '₹750' },
  { id: 'RH-D12', name: 'Dr. Anand Kulkarni', department: 'Nephrology', fee: '₹850' },
  { id: 'RH-D13', name: 'Dr. Archana Bhat', department: 'Pediatrics', fee: '₹650' },
  { id: 'RH-D14', name: 'Dr. Rohan D’Souza', department: 'Pediatrics', fee: '₹650' },
  { id: 'RH-D15', name: 'Dr. Deepa Shankar', department: 'Obstetrics & Gynecology', fee: '₹800' },
  { id: 'RH-D16', name: 'Dr. Priyanka Murthy', department: 'Obstetrics & Gynecology', fee: '₹750' },
  { id: 'RH-D17', name: 'Dr. Harish Prasad', department: 'Pulmonology', fee: '₹700' },
  { id: 'RH-D18', name: 'Dr. Nandini Sen', department: 'Dermatology', fee: '₹600' },
  { id: 'RH-D19', name: 'Dr. Karthik Subramanian', department: 'ENT', fee: '₹650' },
  { id: 'RH-D20', name: 'Dr. Smita Joshi', department: 'Ophthalmology', fee: '₹700' },
  { id: 'RH-D21', name: 'Dr. Manoj Kumar', department: 'Ophthalmology', fee: '₹700' },
  { id: 'RH-D22', name: 'Dr. Sangeetha Iyengar', department: 'Endocrinology', fee: '₹800' },
  { id: 'RH-D23', name: 'Dr. Rakesh Nair', department: 'Oncology', fee: '₹1000' },
  { id: 'RH-D24', name: 'Dr. Gautham Pai', department: 'Oncology', fee: '₹1000' },
  { id: 'RH-D25', name: 'Dr. Vani S. Rao', department: 'Psychiatry', fee: '₹750' },
  { id: 'RH-D26', name: 'Dr. Ashok Patel', department: 'Rheumatology', fee: '₹800' },
  { id: 'RH-D27', name: 'Dr. Varun Sundaram', department: 'Vascular Surgery', fee: '₹900' },
  { id: 'RH-D28', name: 'Dr. Rashmi Kulkarni', department: 'Anaesthesiology', fee: '₹700' },
  { id: 'RH-D29', name: 'Dr. Sumeet Bhalla', department: 'Plastic Surgery', fee: '₹1100' },
  { id: 'RH-D30', name: 'Dr. Nithya Srinivas', department: 'Pathology', fee: '₹500' },
  { id: 'RH-D31', name: 'Dr. Jayakrishnan Nair', department: 'Radiology', fee: '₹600' },
  { id: 'RH-D32', name: 'Dr. Bhavana Shah', department: 'Radiology', fee: '₹600' },
  { id: 'RH-D33', name: 'Dr. Santosh Shetty', department: 'Emergency Medicine', fee: '₹800' },
  { id: 'RH-D34', name: 'Dr. Madhavi Latha', department: 'Nuclear Medicine', fee: '₹900' },
  { id: 'RH-D35', name: 'Dr. Chethan Gowda', department: 'Physical Medicine & Rehab', fee: '₹650' },
  { id: 'RH-D36', name: 'Dr. Anushree Roy', department: 'Clinical Immunology', fee: '₹750' },
  { id: 'RH-D37', name: 'Dr. Girish Menon', department: 'Cardiothoracic Surgery', fee: '₹1300' },
  { id: 'RH-D38', name: 'Dr. Lavanya Krishnan', department: 'Pediatric Surgery', fee: '₹850' },
  { id: 'RH-D39', name: 'Dr. Hemanth Kumar', department: 'Geriatrics', fee: '₹700' },
  { id: 'RH-D40', name: 'Dr. Aparna Nair', department: 'Infectious Diseases', fee: '₹750' },
  { id: 'RH-D41', name: 'Dr. Balaji Venkat', department: 'Pain Management', fee: '₹800' },
];

const REGAL_HOSPITAL = 'Regal Hospital';
const PATIENT_BOOKING_SOURCE = 'patient_app';
const PATIENT_BOOKING_STATUS = 'WAITING';

function isValidUUID(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
  );
}

function resolveBookingPatientId(): string {
  return getActivePatientId();
}

function stripRelationshipTag(label: string): string {
  return label.replace(/\s\([^)]+\)/, '').trim();
}

function findDoctorDirectoryEntry(doctorName: string): DoctorDirectoryItem | undefined {
  return ALL_41_DOCTORS.find((doctor) => doctor.name === doctorName);
}

function findDoctorFromUrlParam(docParam: string): DoctorDirectoryItem | undefined {
  const normalized = decodeURIComponent(docParam).trim().toLowerCase();

  return ALL_41_DOCTORS.find((doctor) => {
    const doctorName = doctor.name.toLowerCase();
    const doctorLastName = doctorName.replace(/^dr\.?\s*/i, '');
    return (
      doctorName === normalized ||
      doctorName.includes(normalized) ||
      normalized.includes(doctorLastName) ||
      doctorLastName.includes(normalized)
    );
  });
}

function mirrorAppointmentToLocalStorage(appointment: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;

  try {
    const saved = localStorage.getItem('curasync_appointments');
    const existing = saved ? JSON.parse(saved) : [];
    const nextList = Array.isArray(existing) ? [appointment, ...existing] : [appointment];
    localStorage.setItem('curasync_appointments', JSON.stringify(nextList));
  } catch (storageErr) {
    console.warn('Local appointment mirror failed:', storageErr);
  }
}

async function calculateNextTokenNumber(
  doctorEmployeeId: string,
  doctorName: string,
  appointmentDate: string,
): Promise<number> {
  try {
    return await calculateNextOpdTokenNumber(
      supabase,
      doctorEmployeeId,
      doctorName,
      appointmentDate,
    );
  } catch (err) {
    console.warn('Token counter fallback:', err);
    return 1;
  }
}

function formatBookingTokenLabel(tokenNumber: number): string {
  const seq = Number.isFinite(tokenNumber) && tokenNumber > 0 ? tokenNumber : 1;
  return `Token #${seq}`;
}

interface FullyAliasedBookingInput {
  patientId: string;
  patientName: string;
  uhid: string;
  phone: string;
  hospitalId: string;
  hospitalName: string;
  doctorName: string;
  doctorCode: string;
  department: string;
  appointmentDate: string;
  slotTime: string;
  consultationFee: string;
  reason: string;
  tokenNumber: number;
  nowIso: string;
}

/** Canonical Supabase insert — every column alias variation in one object. */
function buildFullyAliasedBookingPayload(input: FullyAliasedBookingInput): Record<string, unknown> {
  const tokenString = formatBookingTokenLabel(input.tokenNumber);
  const patientName = input.patientName.trim();
  const doctorCode = String(input.doctorCode || '').trim().toUpperCase();
  const doctorName = input.doctorName.trim();
  const department = input.department.trim();
  const clinicalReason = input.reason.trim();
  const slotTime = input.slotTime;
  const feeDisplay = input.consultationFee;
  const seq = Number.isFinite(input.tokenNumber) && input.tokenNumber > 0 ? input.tokenNumber : 1;
  const hospitalId = input.hospitalId.trim() || HOSPITAL_TENANT_ID;

  const payload: Record<string, unknown> = {
    name: patientName,
    patient_name: patientName,
    uhid: input.uhid,
    phone: input.phone,
    patient_phone: input.phone,
    doctor_name: doctorName,
    doctor_code: doctorCode,
    doctor_id: doctorCode,
    doctor_employee_id: doctorCode,
    department,
    hospital_id: hospitalId,
    hospital_code: hospitalId,
    facility_code: REGAL_FACILITY_CODE,
    hospital_name: input.hospitalName || REGAL_HOSPITAL,
    appointment_date: input.appointmentDate,
    slot_time: slotTime,
    appointment_time: slotTime,
    time_slot: slotTime,
    fee: feeDisplay,
    consultation_fee: feeDisplay,
    reason: clinicalReason,
    chief_complaint: clinicalReason,
    reason_for_visit: clinicalReason,
    token_number: seq,
    queue_number: seq,
    token_label: tokenString,
    source: PATIENT_BOOKING_SOURCE,
    booking_source: PATIENT_BOOKING_SOURCE,
    status: PATIENT_BOOKING_STATUS,
    queue_status: PATIENT_BOOKING_STATUS,
    created_at: input.nowIso,
    updated_at: input.nowIso,
  };

  if (isUuidValue(input.patientId)) {
    payload.patient_id = input.patientId;
  }

  return payload;
}

/** Token column aliases — token_number, queue_number, token_label. */
function buildPatientAppointmentPayload(input: FullyAliasedBookingInput): Record<string, unknown> {
  return buildFullyAliasedBookingPayload(input);
}

function buildAppointmentsLedgerPayload(input: FullyAliasedBookingInput): Record<string, unknown> {
  const feeDisplay = input.consultationFee;
  const feeNumeric = Number(String(feeDisplay).replace(/[^\d.]/g, '')) || 0;

  return {
    ...buildFullyAliasedBookingPayload(input),
    consultation_fee: feeNumeric,
  };
}

function buildOpdQueuePayload(input: FullyAliasedBookingInput): Record<string, unknown> {
  return {
    hospital_id: input.hospitalId,
    hospital_name: input.hospitalName || REGAL_HOSPITAL,
    token_number: formatBookingTokenLabel(input.tokenNumber),
    uhid: input.uhid,
    patient_name: input.patientName.trim(),
    phone: input.phone,
    department: input.department,
    doctor_id: input.doctorCode,
    doctor_name: input.doctorName,
    status: PATIENT_BOOKING_STATUS,
    source: PATIENT_BOOKING_SOURCE,
    appointment_date: input.appointmentDate,
  };
}

function missingColumnFromError(message: string | null | undefined): string | null {
  const match = String(message ?? '').match(/Could not find the '([^']+)' column/i);
  return match?.[1] ?? null;
}

function toDirectDbPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const { hospital_code: _hospitalCode, facility_code: _facilityCode, ...dbPayload } = payload;
  return dbPayload;
}

async function insertDirectLedgerRow(
  table: 'appointments' | 'patient_appointments',
  payload: Record<string, unknown>,
): Promise<{ data: Record<string, unknown> | null; errorMessage: string | null }> {
  try {
    const dbPayload: Record<string, unknown> = toDirectDbPayload(payload);
    let { data, error } = await supabase.from(table).insert([dbPayload]).select().maybeSingle();

    let retries = 0;
    while (error && retries < 8) {
      const missingColumn = missingColumnFromError(error.message);
      if (!missingColumn || !(missingColumn in dbPayload)) break;
      delete dbPayload[missingColumn];
      retries += 1;
      const retry = await supabase.from(table).insert([dbPayload]).select().maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error && isUuidColumnError(error.message) && table === 'appointments') {
      const uuidPayload: Record<string, unknown> = { ...dbPayload, hospital_id: REGAL_HOSPITAL_ID };
      const retry = await supabase.from(table).insert([uuidPayload]).select().maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return { data: null, errorMessage: error.message || 'Booking failed' };
    }

    return { data: (data as Record<string, unknown> | null) ?? null, errorMessage: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : `${table} insert failed`;
    return { data: null, errorMessage: message };
  }
}

async function insertAppointmentsLedger(
  payload: Record<string, unknown>,
): Promise<{ data: Record<string, unknown> | null; errorMessage: string | null }> {
  return insertDirectLedgerRow('appointments', payload);
}

async function insertPatientAppointmentsLedger(
  payload: Record<string, unknown>,
): Promise<{ data: Record<string, unknown> | null; errorMessage: string | null }> {
  return insertDirectLedgerRow('patient_appointments', payload);
}

function buildConfirmedLocalMirrorRecord(
  patientPayload: Record<string, unknown>,
  appointmentsPayload: Record<string, unknown>,
  nowIso: string,
  savedRecord?: Record<string, unknown> | null,
): Record<string, unknown> {
  return {
    ...patientPayload,
    ...appointmentsPayload,
    ...(savedRecord ?? {}),
    source: PATIENT_BOOKING_SOURCE,
    booking_source: PATIENT_BOOKING_SOURCE,
    status: PATIENT_BOOKING_STATUS,
    queue_status: PATIENT_BOOKING_STATUS,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

function applyClinicianFromUrlParams(
  docParam: string | null,
  deptParam: string | null,
  feeParam: string | null,
  setters: {
    setDoctor: (value: string) => void;
    setDoctorCode: (value: string) => void;
    setDept: (value: string) => void;
    setFee: (value: string) => void;
  },
): void {
  if (docParam) {
    const match = findDoctorFromUrlParam(docParam);
    if (match) {
      setters.setDoctor(match.name);
      setters.setDoctorCode(match.id);
      setters.setDept(match.department);
      setters.setFee(match.fee);
      return;
    }

    setters.setDoctor(decodeURIComponent(docParam));
  }

  if (deptParam) setters.setDept(decodeURIComponent(deptParam));
  if (feeParam) setters.setFee(decodeURIComponent(feeParam));
}

export default function BookAppointmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // PATIENT SELECTION (SELF + LINKED FAMILY MEMBERS)
  const [selectedPatientName, setSelectedPatientName] = useState<string>('');
  const [patientOptions, setPatientOptions] = useState<FamilyMemberOption[]>([]);

  const [selectedDoctorName, setSelectedDoctorName] = useState<string>('');
  const [selectedDoctorCode, setSelectedDoctorCode] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [consultationFee, setConsultationFee] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  // SCHEDULING DETAILS
  const [appointmentDate, setAppointmentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [slotTime, setSlotTime] = useState<string>('10:30 AM');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string>('');
  const [bookedSummary, setBookedSummary] = useState<{
    token: number;
    doctor: string;
    date: string;
    slot: string;
  } | null>(null);

  useEffect(() => {
    applyClinicianFromUrlParams(
      searchParams.get('doctor'),
      searchParams.get('department'),
      searchParams.get('fee'),
      {
        setDoctor: setSelectedDoctorName,
        setDoctorCode: setSelectedDoctorCode,
        setDept: setSelectedDept,
        setFee: setConsultationFee,
      },
    );

    void loadPatientAndFamilyOptions();
  }, [searchParams]);

  const loadPatientAndFamilyOptions = async () => {
    const activePatientId = getActivePatientId();
    let primaryName = getActivePatientName();
    let familyMembersList: FamilyMemberOption[] = [];

    if (typeof window !== 'undefined') {
      const savedProfile = localStorage.getItem('curasync_patient_profile');

      if (savedProfile) {
        try {
          const parsed = JSON.parse(savedProfile) as {
            full_name?: string;
            family_members?: FamilyMemberOption[];
          };
          if (parsed.full_name) primaryName = parsed.full_name;
          if (Array.isArray(parsed.family_members)) {
            familyMembersList = parsed.family_members;
          }
        } catch {
          /* use active node name */
        }
      }
    }

    if (isValidUUID(activePatientId)) {
      try {
        const profileQueries = await Promise.all([
          supabase
            .from('patient_profiles')
            .select('id, patient_id, full_name, family_members')
            .eq('id', activePatientId)
            .maybeSingle(),
          supabase
            .from('patient_profiles')
            .select('id, patient_id, full_name, family_members')
            .eq('patient_id', activePatientId)
            .maybeSingle(),
        ]);

        const profileRecord =
          profileQueries.find((result) => !result.error && result.data)?.data ?? null;

        if (profileRecord) {
          if (profileRecord.full_name) primaryName = String(profileRecord.full_name);
          if (Array.isArray(profileRecord.family_members)) {
            familyMembersList = profileRecord.family_members as FamilyMemberOption[];
          }
        }
      } catch {
        console.warn('Profile sync unavailable');
      }
    }

    persistActivePatientNode(activePatientId, primaryName);

    const options: FamilyMemberOption[] = [
      { id: 'self', name: `${primaryName} (Self)`, relation: 'Self' },
      ...familyMembersList.map((member) => ({
        id: member.id || member.name,
        name: `${member.name} (${member.relation})`,
        relation: member.relation,
      })),
    ];

    setPatientId(activePatientId);
    setPatientOptions(options);
    setSelectedPatientName(options[0]?.name ?? `${primaryName} (Self)`);
  };

  // Handle selecting a doctor from the full 41-doctor list
  const handleDoctorSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const docName = e.target.value;
    setSelectedDoctorName(docName);

    const match = ALL_41_DOCTORS.find((d) => d.name === docName);
    if (match) {
      setSelectedDoctorCode(match.id);
      setSelectedDept(match.department);
      setConsultationFee(match.fee);
    }
  };

  const handleBookAppointment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccess(false);
    setBookedSummary(null);

    try {
      const patientSession = readPatientPortalSession();
      if (!patientSession) {
        toast.error('Session expired. Please log in again.');
        router.push('/patient/login');
        return;
      }

      const cleanPatientName = stripRelationshipTag(
        selectedPatientName || patientSession.patient_name,
      );
      const doctorEntry = findDoctorDirectoryEntry(selectedDoctorName);

      if (!cleanPatientName.trim()) {
        setErrorMessage('Select a registered patient before booking.');
        toast.error('Patient identity is required.');
        return;
      }

      if (!selectedDoctorName.trim() || !selectedDoctorCode.trim()) {
        setErrorMessage('Select a consulting doctor before booking.');
        toast.error('Doctor selection is required.');
        return;
      }

      const rawDoctorName = selectedDoctorName.trim();
      const rawDoctorCode = selectedDoctorCode.trim().toUpperCase();
      const department = (selectedDept || doctorEntry?.department || '').trim();
      if (!department) {
        setErrorMessage('Doctor department is required.');
        toast.error('Doctor department is required.');
        return;
      }

      const targetHospitalId = patientSession.hospital_id || HOSPITAL_TENANT_ID;
      const tokenUhid = patientSession.uhid || mintPatientUhid();
      const selectedTime = slotTime;
      const calculatedToken = await calculateNextTokenNumber(
        rawDoctorCode,
        rawDoctorName,
        appointmentDate,
      );
      const clinicalReason = reason.trim();
      const nowIso = new Date().toISOString();
      const resolvedPatientId = resolveBookingPatientId();
      const resolvedDate = appointmentDate || new Date().toISOString().split('T')[0];

      persistActivePatientNode(resolvedPatientId, cleanPatientName);

      const bookingInput: FullyAliasedBookingInput = {
        patientId: resolvedPatientId,
        patientName: cleanPatientName,
        uhid: tokenUhid,
        phone: patientSession.phone,
        hospitalId: targetHospitalId,
        hospitalName: patientSession.hospital_name,
        doctorName: rawDoctorName,
        doctorCode: rawDoctorCode,
        department,
        appointmentDate: resolvedDate,
        slotTime: selectedTime,
        consultationFee,
        reason: clinicalReason,
        tokenNumber: calculatedToken,
        nowIso,
      };

      const patientPayload = buildPatientAppointmentPayload(bookingInput);
      const appointmentsPayload = buildAppointmentsLedgerPayload(bookingInput);

      let savedRecord: Record<string, unknown> | null = null;

      const ledgerResult = await insertAppointmentsLedger(appointmentsPayload);
      if (ledgerResult.data) {
        savedRecord = ledgerResult.data;
      }

      const patientResult = await insertPatientAppointmentsLedger(patientPayload);
      if (patientResult.data && !savedRecord) {
        savedRecord = patientResult.data;
      }

      try {
        await supabase.from('hospital_opd_queue').insert([buildOpdQueuePayload(bookingInput)]);
      } catch (queueErr) {
        console.warn('hospital_opd_queue mirror skipped:', queueErr);
      }

      if (!savedRecord) {
        const failMessage =
          ledgerResult.errorMessage || patientResult.errorMessage || 'Booking failed';
        console.error('Booking failed:', failMessage);
        setErrorMessage(`Booking failed: ${failMessage}`);
        toast.error(`Booking failed: ${failMessage}`);
        return;
      }

      mirrorAppointmentToLocalStorage(
        buildConfirmedLocalMirrorRecord(
          patientPayload,
          appointmentsPayload,
          nowIso,
          savedRecord,
        ),
      );

      setBookedSummary({
        token: calculatedToken,
        doctor: rawDoctorName,
        date: resolvedDate,
        slot: selectedTime,
      });
      setSuccess(true);
      toast.success(`Appointment confirmed with ${rawDoctorName}!`);

      setTimeout(() => {
        router.push('/patient/appointments');
      }, 1000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error completing booking';
      console.error('Unexpected booking error:', err);
      toast.error(message);
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 font-sans text-[#0E2924]">
      {/* HEADER SECTION */}
      <div className="border-b border-[#D5E8E3] pb-4">
        <h1 className="text-2xl font-black text-[#0E2924]">Confirm Consultation Booking</h1>
        <p className="text-xs font-bold text-[#227B6B]">
          Facility: <span className="text-[#113831] font-black">{REGAL_HOSPITAL}</span> • OPD Consultation
        </p>
      </div>

      {/* SUCCESS BANNER */}
      {success && bookedSummary && (
        <div className="rounded-2xl border border-[#227B6B]/30 bg-gradient-to-r from-[#EAF5F2] to-white p-5 shadow-md">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#113831] text-white">
              <CheckCircle2 className="h-6 w-6 text-[#A6E2D8]" />
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-black text-[#0E2924]">
                SmartQ Token Confirmed — {REGAL_HOSPITAL}
              </p>
              <div className="grid gap-1.5 text-xs font-semibold text-[#113831] sm:grid-cols-2">
                <p>
                  Token:{' '}
                  <span className="font-black text-[#227B6B]">
                    {formatBookingTokenLabel(bookedSummary.token)}
                  </span>
                </p>
                <p>
                  Clinician:{' '}
                  <span className="font-black">{bookedSummary.doctor}</span>
                </p>
                <p>
                  Date: <span className="font-black">{bookedSummary.date}</span>
                </p>
                <p>
                  Slot: <span className="font-black">{bookedSummary.slot}</span>
                </p>
              </div>
              <p className="text-[11px] font-bold text-[#227B6B]">
                Your consultation is confirmed. Redirecting to appointments...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ERROR BANNER */}
      {errorMessage && (
        <div className="flex items-center gap-3 rounded-2xl bg-rose-50 p-4 text-xs font-bold text-rose-800 border border-rose-200">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* BOOKING FORM */}
      <form
        onSubmit={handleBookAppointment}
        className="rounded-3xl border border-[#D5E8E3] bg-white p-8 shadow-sm space-y-6"
      >
        {/* PATIENT / DEPENDENT SELECTOR */}
        <div>
          <label className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[#227B6B] mb-1.5">
            <Users className="h-3.5 w-3.5 text-[#227B6B]" /> PATIENT FOR CONSULTATION *
          </label>
          <select
            value={selectedPatientName}
            onChange={(e) => setSelectedPatientName(e.target.value)}
            className="w-full rounded-2xl border border-[#D5E8E3] bg-[#EAF5F2]/40 p-4 text-xs font-bold text-[#0E2924] focus:border-[#113831] focus:outline-none shadow-sm cursor-pointer"
            required
          >
            {patientOptions.length === 0 ? (
              <option value={selectedPatientName}>{selectedPatientName}</option>
            ) : (
              patientOptions.map((opt) => (
                <option key={opt.id} value={opt.name}>
                  {opt.name}
                </option>
              ))
            )}
          </select>
        </div>

        {/* CLINICIAN (ALL 41 DOCTORS INCLUDED) */}
        <div>
          <label className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[#227B6B] mb-1.5">
            <User className="h-3.5 w-3.5 text-[#227B6B]" /> SELECT CLINICIAN (41 SPECIALISTS AVAILABLE) *
          </label>
          <select
            value={selectedDoctorName}
            onChange={handleDoctorSelectionChange}
            className="w-full rounded-2xl border border-[#D5E8E3] bg-white p-4 text-xs font-black text-[#113831] focus:border-[#113831] focus:outline-none shadow-sm cursor-pointer"
          >
            {ALL_41_DOCTORS.map((doc) => (
              <option key={doc.id} value={doc.name}>
                {doc.name} — {doc.department} ({doc.fee})
              </option>
            ))}
          </select>
        </div>

        {/* DEPARTMENT & FEE SUMMARY */}
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[#227B6B] mb-1.5">
              <Stethoscope className="h-3.5 w-3.5 text-[#227B6B]" /> CLINICAL DEPARTMENT
            </label>
            <input
              type="text"
              readOnly
              value={selectedDept}
              className="w-full rounded-2xl border border-[#D5E8E3] bg-[#F4F8F7] p-4 text-xs font-black text-[#113831]"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[#227B6B] mb-1.5">
              CONSULTATION FEE
            </label>
            <input
              type="text"
              readOnly
              value={consultationFee}
              className="w-full rounded-2xl border border-[#D5E8E3] bg-[#F4F8F7] p-4 text-xs font-black text-[#113831]"
            />
          </div>
        </div>

        {/* REASON FOR VISIT (OPTIONAL) */}
        <div>
          <label className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[#227B6B] mb-1.5">
            <FileText className="h-3.5 w-3.5 text-[#227B6B]" /> REASON FOR VISIT / SYMPTOMS (OPTIONAL)
          </label>
          <textarea
            rows={3}
            placeholder="Describe symptoms or clinical concern (e.g., Fever, Routine checkup, Knee pain, Chronic cough)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-2xl border border-[#D5E8E3] bg-[#F4F8F7] p-4 text-xs font-bold text-[#0E2924] focus:border-[#113831] focus:outline-none"
          />
        </div>

        {/* DATE & TIME SLOTS */}
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[#227B6B] mb-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#227B6B]" /> APPOINTMENT DATE *
            </label>
            <input
              type="date"
              required
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
              className="w-full rounded-2xl border border-[#D5E8E3] bg-[#F4F8F7] p-4 text-xs font-bold text-[#0E2924] focus:border-[#113831] focus:outline-none"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[#227B6B] mb-1.5">
              <Clock className="h-3.5 w-3.5 text-[#227B6B]" /> TIME SLOT *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['09:30 AM', '10:30 AM', '11:30 AM', '02:00 PM', '03:30 PM', '05:00 PM'].map((slot) => (
                <button
                  type="button"
                  key={slot}
                  onClick={() => setSlotTime(slot)}
                  className={`p-2.5 rounded-xl text-[11px] font-black border transition ${
                    slotTime === slot
                      ? 'bg-[#113831] text-white border-[#113831] shadow-sm'
                      : 'bg-[#F4F8F7] text-[#0E2924] border-[#D5E8E3] hover:border-[#113831]'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* FACILITY LOCATION */}
        <div className="flex items-center gap-2 text-xs font-bold text-[#227B6B] bg-[#EAF5F2]/40 p-3.5 rounded-2xl border border-[#D5E8E3]">
          <Building2 className="h-4 w-4 shrink-0 text-[#113831]" />
          <span>Consultation Location: <strong>{REGAL_HOSPITAL} OPD Block</strong></span>
        </div>

        {/* SUBMIT BUTTON */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#113831] py-4 text-xs font-black text-white shadow-lg hover:bg-[#227B6B] transition disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-[#A6E2D8]" /> Confirming OPD Booking...
            </>
          ) : (
            <>
              <ArrowRight className="h-4 w-4 text-[#A6E2D8]" /> Confirm & Generate SmartQ Token
            </>
          )}
        </button>
      </form>
    </div>
  );
}