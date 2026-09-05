import { createClient } from '@/lib/supabase/client';
import { HOSPITAL_TENANT_ID, REGAL_FACILITY_CODE, REGAL_HOSPITAL_ID } from '@/lib/regal/constants';
import { canonicalHospitalId, isUuidColumnError } from '@/lib/hospital/hospital-node';
import { readPatientPortalSession, mintPatientUhid } from '@/lib/patient/portal-session';

export interface BookAppointmentPayload {
  patientId?: string;
  patient_id?: string;
  patientName?: string;
  patient_name?: string;
  doctor?: {
    doctor_id?: string;
    employeeId?: string;
    department?: string;
    name?: string;
    full_name?: string;
  };
  doctorId?: string;
  doctor_id?: string;
  doctorName?: string;
  doctor_name?: string;
  appointmentDate?: string;
  appointment_date?: string;
  slotTime?: string;
  appointment_time?: string;
  reason?: string;
  reason_for_visit?: string;
  reasonForVisit?: string;
  department?: string;
  hospitalName?: string;
  hospitalId?: string;
  hospital_id?: string;
  [key: string]: unknown;
}

export interface BookAppointmentResponse {
  success: boolean;
  appointment_id: string;
  token_number: number;
  token_label: string;
  message?: string;
}

export const DEFAULT_DOCTOR_ID = '56284599-9a5f-4672-9b53-b90e18146a00';
export const DEFAULT_PATIENT_ID = 'b0000000-0000-0000-0000-000000000002';
export const DEFAULT_DEPARTMENT = 'General Surgery';
export const DEFAULT_REASON = 'General Health Consultation';

const ACTIVE_BOOKING_STATUSES = ['SCHEDULED', 'WAITING', 'CONFIRMED', 'PENDING'];

/** Local calendar date YYYY-MM-DD (avoids UTC midnight drift). */
function localDateString(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().split('T')[0];
}

export async function bookAppointmentWithDoctor(
  payload: BookAppointmentPayload,
): Promise<BookAppointmentResponse> {
  const session = typeof window !== 'undefined' ? readPatientPortalSession() : null;
  const supabase = createClient();

  const { data: authData } = await supabase.auth.getUser();
  const patientId =
    payload.patient_id || payload.patientId || authData?.user?.id || session?.patient_id || DEFAULT_PATIENT_ID;
  const doctorCode = String(
    payload.doctor?.employeeId ||
      payload.doctor_id ||
      payload.doctorId ||
      payload.doctor?.doctor_id ||
      '',
  )
    .trim()
    .toUpperCase();
  if (!doctorCode) {
    throw new Error('Doctor selection is required.');
  }
  const doctorName = String(
    payload.doctor_name || payload.doctorName || payload.doctor?.full_name || payload.doctor?.name || '',
  ).trim();
  if (!doctorName) {
    throw new Error('Doctor name is required.');
  }
  const department =
    payload.department || payload.doctor?.department || DEFAULT_DEPARTMENT;
  if (!String(department).trim()) {
    throw new Error('Doctor department is required.');
  }
  const reasonForVisit =
    payload.reason_for_visit ||
    payload.reasonForVisit ||
    payload.reason ||
    DEFAULT_REASON;
  const appointmentDate =
    payload.appointment_date || payload.appointmentDate || localDateString();
  const appointmentTime =
    payload.appointment_time || payload.slotTime || '10:00 AM';
  const patientName =
    payload.patient_name || payload.patientName || session?.patient_name || 'Verified Patient';
  const hospitalId = canonicalHospitalId(
    payload.hospital_id || payload.hospitalId || session?.hospital_id || HOSPITAL_TENANT_ID,
  );
  const uhid = session?.uhid || mintPatientUhid();
  const phone = session?.phone || '+91 98450 12345';

  let tokenNumber = 1;
  try {
    const { count, error: countError } = await supabase
      .from('appointments')
      .select('appointment_id', { count: 'exact', head: true })
      .or(`doctor_id.eq.${doctorCode},doctor_code.eq.${doctorCode},doctor_employee_id.eq.${doctorCode}`)
      .eq('appointment_date', appointmentDate)
      .in('status', ACTIVE_BOOKING_STATUSES);

    if (!countError && count !== null) {
      tokenNumber = count + 1;
    }
  } catch (err) {
    console.warn('Failed to calculate daily token count, defaulting to T-01:', err);
  }

  const tokenLabel = `T-${tokenNumber.toString().padStart(2, '0')}`;

  const insertPayload: Record<string, unknown> = {
    hospital_id: hospitalId,
    hospital_code: hospitalId,
    facility_code: REGAL_FACILITY_CODE,
    hospital_name: payload.hospitalName || session?.hospital_name || 'Regal Hospital',
    uhid,
    phone,
    patient_phone: phone,
    patient_name: patientName,
    doctor_id: doctorCode,
    doctor_code: doctorCode,
    doctor_employee_id: doctorCode,
    doctor_name: doctorName,
    department,
    reason_for_visit: reasonForVisit,
    chief_complaint: reasonForVisit,
    appointment_date: appointmentDate,
    appointment_time: appointmentTime,
    slot_time: appointmentTime,
    time_slot: appointmentTime,
    status: 'waiting',
    billing_status: 'pending_checkout',
    consultation_fee: Number(payload.consultation_fee ?? payload.fee ?? 500) || 500,
    token_number: tokenLabel,
    source: 'patient_app',
  };

  if (patientId && /^[0-9a-f-]{36}$/i.test(String(patientId))) {
    insertPayload.patient_id = patientId;
  }

  let { data: apptData, error: apptError } = await supabase
    .from('appointments')
    .insert([insertPayload])
    .select('appointment_id, id')
    .single();

  if (apptError && isUuidColumnError(apptError.message)) {
    const retry = await supabase
      .from('appointments')
      .insert([{ ...insertPayload, hospital_id: REGAL_HOSPITAL_ID }])
      .select('appointment_id, id')
      .single();
    apptData = retry.data;
    apptError = retry.error;
  }

  if (apptError) {
    const msg =
      typeof apptError === 'object' && apptError !== null && 'message' in apptError
        ? String((apptError as { message?: string }).message)
        : 'Failed to insert appointment record.';
    console.error('[Supabase Booking Error]:', msg);
    throw new Error(msg);
  }

  if (!apptData) {
    throw new Error('No appointment data returned from database.');
  }

  const appointmentId = String(apptData.appointment_id ?? apptData.id ?? '');

  try {
    await supabase.from('hospital_opd_queue').insert({
      hospital_id: hospitalId,
      hospital_name: insertPayload.hospital_name,
      token_number: tokenLabel,
      uhid,
      patient_name: patientName,
      phone,
      department,
      doctor_id: doctorCode,
      doctor_name: doctorName,
      status: 'WAITING',
      source: 'patient_app',
      appointment_date: appointmentDate,
    });
  } catch {
    /* dashboard still reads appointments */
  }

  return {
    success: true,
    appointment_id: appointmentId,
    token_number: tokenNumber,
    token_label: tokenLabel,
    message: `Appointment successfully booked! Your queue token is ${tokenLabel}.`,
  };
}
