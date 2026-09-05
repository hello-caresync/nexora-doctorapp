import type { SupabaseClient } from '@supabase/supabase-js';

import { HOSPITAL_TENANT_ID } from '@/lib/regal/constants';

export type InvoiceMedicineLine = {
  name: string;
  qty: number;
  price: number;
};

export type PendingInvoiceInput = {
  appointmentId?: string | null;
  hospitalId?: string;
  uhid: string;
  patientName: string;
  doctorId?: string;
  doctorName?: string;
  consultationFee: number;
  medicines: InvoiceMedicineLine[];
};

export type BillingInvoiceRow = {
  id: string;
  appointment_id?: string;
  hospital_id: string;
  uhid: string;
  patient_name: string;
  doctor_id?: string;
  doctor_name?: string;
  consultation_fee: number;
  medicines: InvoiceMedicineLine[];
  medicines_total: number;
  total_amount: number;
  payment_status: string;
  payment_method?: string;
  created_at: string;
  paid_at?: string;
};

function isUuid(value?: string | null): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value ?? ''));
}

function missingColumn(message: string | null | undefined): string | null {
  const text = String(message ?? '');
  return (
    text.match(/Could not find the '([^']+)' column/i)?.[1] ??
    text.match(/column (?:[\w]+\.)?([a-zA-Z0-9_]+) does not exist/i)?.[1] ??
    null
  );
}

export function normalizeMedicineLines(raw: unknown): InvoiceMedicineLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((line) => {
      const item = line as Record<string, unknown>;
      return {
        name: String(item.name ?? item.medicine_name ?? '').trim(),
        qty: Math.max(1, Number(item.qty ?? item.quantity ?? 1) || 1),
        price: Math.max(0, Number(item.price ?? item.unit_price ?? item.amount ?? 0) || 0),
      };
    })
    .filter((line) => line.name);
}

export function mapBillingInvoiceRow(row: Record<string, unknown>): BillingInvoiceRow {
  const medicines = normalizeMedicineLines(row.medicines);
  const medicinesTotal = Number(row.medicines_total ?? medicines.reduce((sum, line) => sum + line.qty * line.price, 0));
  return {
    id: String(row.id ?? ''),
    appointment_id: row.appointment_id ? String(row.appointment_id) : undefined,
    hospital_id: String(row.hospital_id ?? HOSPITAL_TENANT_ID),
    uhid: String(row.uhid ?? ''),
    patient_name: String(row.patient_name ?? 'Patient'),
    doctor_id: row.doctor_id ? String(row.doctor_id) : undefined,
    doctor_name: row.doctor_name ? String(row.doctor_name) : undefined,
    consultation_fee: Number(row.consultation_fee ?? 0),
    medicines,
    medicines_total: medicinesTotal,
    total_amount: Number(row.total_amount ?? Number(row.consultation_fee ?? 0) + medicinesTotal),
    payment_status: String(row.payment_status ?? row.status ?? 'pending_payment'),
    payment_method: row.payment_method ? String(row.payment_method) : undefined,
    created_at: String(row.created_at ?? ''),
    paid_at: row.paid_at ? String(row.paid_at) : undefined,
  };
}

export async function createPendingConsultationInvoice(
  supabase: SupabaseClient,
  input: PendingInvoiceInput,
): Promise<{ ok: boolean; invoice?: BillingInvoiceRow; error?: string; skipped?: boolean }> {
  const medicines = normalizeMedicineLines(input.medicines);
  const medicinesTotal = medicines.reduce((sum, line) => sum + line.qty * line.price, 0);
  const consultationFee = Math.max(0, Number(input.consultationFee) || 500);
  const totalAmount = consultationFee + medicinesTotal;
  const appointmentId = isUuid(input.appointmentId) ? String(input.appointmentId) : null;

  if (appointmentId) {
    const existing = await supabase
      .from('billing_invoices')
      .select('*')
      .eq('appointment_id', appointmentId)
      .maybeSingle();
    if (existing.data) {
      return { ok: true, skipped: true, invoice: mapBillingInvoiceRow(existing.data as Record<string, unknown>) };
    }
  }

  const payload: Record<string, unknown> = {
    hospital_id: input.hospitalId || HOSPITAL_TENANT_ID,
    uhid: input.uhid || input.patientName,
    patient_name: input.patientName,
    doctor_id: input.doctorId || null,
    doctor_name: input.doctorName || null,
    consultation_fee: consultationFee,
    medicines,
    medicines_total: medicinesTotal,
    total_amount: totalAmount,
    payment_status: 'pending_payment',
  };
  if (appointmentId) payload.appointment_id = appointmentId;

  let { data, error } = await supabase.from('billing_invoices').insert([payload]).select('*').maybeSingle();
  let attempts = 0;
  while (error && attempts < 8) {
    const column = missingColumn(error.message);
    if (column && column in payload) {
      delete payload[column];
    } else if (/uuid|foreign key|appointments/i.test(error.message) && payload.appointment_id) {
      delete payload.appointment_id;
    } else {
      break;
    }
    attempts += 1;
    const retry = await supabase.from('billing_invoices').insert([payload]).select('*').maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    return { ok: false, error: error.message };
  }

  if (appointmentId) {
    await supabase.from('appointments').update({ billing_status: 'pending_payment' }).eq('id', appointmentId);
  }

  return {
    ok: true,
    invoice: data ? mapBillingInvoiceRow(data as Record<string, unknown>) : undefined,
  };
}

export async function clearConsultationInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  paymentMethod: 'cash' | 'upi' | 'card',
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('billing_invoices')
    .update({
      payment_status: 'paid',
      payment_method: paymentMethod,
      paid_at: new Date().toISOString(),
    })
    .eq('id', invoiceId);

  if (error) return { ok: false, error: error.message };

  const { data } = await supabase.from('billing_invoices').select('appointment_id').eq('id', invoiceId).maybeSingle();
  const appointmentId = data && (data as { appointment_id?: string }).appointment_id;
  if (appointmentId) {
    await supabase.from('appointments').update({ billing_status: 'paid' }).eq('id', appointmentId);
  }

  return { ok: true };
}

export async function completeConsultationWithInvoice(
  supabase: SupabaseClient,
  input: PendingInvoiceInput & { appointmentId: string },
): Promise<{ ok: boolean; invoice?: BillingInvoiceRow; totalAmount: number; error?: string }> {
  const medicines = normalizeMedicineLines(input.medicines);
  const medicinesTotal = medicines.reduce((sum, line) => sum + line.qty * line.price, 0);
  const consultationFee = Math.max(0, Number(input.consultationFee) || 500);
  const totalAmount = consultationFee + medicinesTotal;

  const created = await createPendingConsultationInvoice(supabase, {
    ...input,
    medicines,
    consultationFee,
  });

  if (!created.ok) {
    return { ok: false, totalAmount, error: created.error || 'Failed to write invoice' };
  }

  const appointmentId = String(input.appointmentId);
  const patch = { status: 'completed', billing_status: 'pending_payment' };
  const byId = await supabase.from('appointments').update(patch).eq('id', appointmentId).select('id');
  if (byId.error || !byId.data?.length) {
    await supabase.from('appointments').update(patch).eq('appointment_id', appointmentId);
    await supabase.from('patient_appointments').update({ status: 'completed', queue_status: 'COMPLETED' }).eq('id', appointmentId);
  }

  return { ok: true, invoice: created.invoice, totalAmount };
}
