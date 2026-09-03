'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  BedDouble,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  HeartHandshake,
  IndianRupee,
  LayoutGrid,
  ListOrdered,
  Loader2,
  LogOut,
  Menu,
  PackageCheck,
  Phone,
  Pill,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  TicketPlus,
  Users,
  X,
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { isHospitalSetupCompleted } from '@/lib/auth/admin-setup';
import { clearActiveSession } from '@/lib/auth/active-session';
import {
  isHospitalAppRole,
  readHospitalAppSession,
} from '@/lib/auth/ecosystem-sessions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

type NavModule =
  | 'dashboard'
  | 'smartq'
  | 'patients'
  | 'ipd'
  | 'pharmacy'
  | 'emergency'
  | 'billing'
  | 'supply'
  | 'staff';

type ModalKind = 'opd' | 'pharmacy' | 'bed' | 'invoice' | 'supply' | null;

type HospitalInfo = {
  id: string;
  nodeCode: string;
  name: string;
  adminName: string;
  adminEmail: string;
};

type StaffRow = {
  id: string;
  full_name: string;
  staff_type: string;
  department: string;
  email: string;
  temporary_passcode?: string;
  portal_access?: string;
  status?: string;
};

type TriageStage = 'Waiting' | 'In Consultation' | 'Completed';

type QueueRow = {
  id: string;
  token: string;
  uhid: string;
  patient_name: string;
  department: string;
  phone: string;
  doctor_name: string;
  status: string;
  created_at: string;
  appointment_date: string;
  source_table: string;
  gender: string;
  age: number | null;
};

type PatientProfile = {
  id: string;
  uhid: string;
  patient_name: string;
  phone: string;
  department: string;
  visits: number;
  last_encounter: string;
  first_registered: string;
  gender: string;
  age: number | null;
  record_status: string;
};

type PharmacyRow = {
  id: string;
  item_name: string;
  category: string;
  stock: number;
  status: string;
};

type BedRow = {
  id: string;
  ward_name: string;
  bed_number: string;
  status: string;
  patient_name: string;
};

type InvoiceRow = {
  id: string;
  patient_name: string;
  service_type: string;
  amount: number;
  status: string;
};

type SupplyRow = {
  id: string;
  po_number: string;
  vendor_name: string;
  item_description: string;
  quantity: number;
  total_amount: number;
  status: string;
};

type EmergencyRow = {
  id: string;
  patient_name: string;
  complaint: string;
  priority: string;
  status: string;
};

function inr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function nodeCodeFor(hospitalId: string): string {
  return hospitalId;
}

const OPD_DEPARTMENTS = [
  'General Medicine',
  'Cardiology',
  'Neurology',
  'Orthopedics',
  'Pediatrics',
  'Dermatology',
  'ENT',
  'Obstetrics & Gynecology',
] as const;

function mintOpdToken(): string {
  return `NX-OPD-${Math.floor(1000 + Math.random() * 9000)}`;
}

function triageStage(status: string): TriageStage {
  const value = status.toLowerCase();
  if (/complete|done|discharged|closed/.test(value)) return 'Completed';
  if (/consult|in.?room|called|exam/.test(value)) return 'In Consultation';
  return 'Waiting';
}

function waitMinutes(isoDate: string): number | null {
  if (!isoDate) return null;
  const stamp = new Date(isoDate).getTime();
  if (!Number.isFinite(stamp)) return null;
  return Math.max(0, Math.round((Date.now() - stamp) / 60000));
}

function formatWait(isoDate: string): string {
  const mins = waitMinutes(isoDate);
  if (mins == null) return '—';
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatEncounter(isoDate: string): string {
  if (!isoDate) return '—';
  const date = new Date(isoDate);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function mapQueueRow(row: Record<string, unknown>, sourceTable: string): QueueRow | null {
  const id = String(row.id ?? row.token_number ?? row.uhid ?? '');
  if (!id) return null;
  const ageRaw = row.age ?? row.patient_age;
  return {
    id,
    token: String(row.token_number ?? row.uhid ?? row.token ?? row.id ?? ''),
    uhid: String(row.uhid ?? row.token_number ?? row.id ?? ''),
    patient_name: String(row.patient_name ?? row.name ?? ''),
    department: String(row.department ?? 'General Medicine'),
    phone: String(row.phone ?? row.patient_phone ?? ''),
    doctor_name: String(row.doctor_name ?? 'Unassigned'),
    status: String(row.status ?? row.queue_status ?? 'Waiting'),
    created_at: String(row.created_at ?? ''),
    appointment_date: String(row.appointment_date ?? row.created_at ?? ''),
    source_table: sourceTable,
    gender: String(row.gender ?? row.sex ?? ''),
    age: ageRaw == null || ageRaw === '' ? null : Number(ageRaw),
  };
}

function patientKey(name: string, phone: string, uhid: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) return `phone:${digits.slice(-10)}`;
  if (name.trim()) return `name:${name.trim().toLowerCase()}`;
  return `uhid:${uhid}`;
}

function buildPatientDirectory(queue: QueueRow[], extraPatients: Record<string, unknown>[]): PatientProfile[] {
  const directory = new Map<string, PatientProfile>();

  const upsert = (input: {
    id: string;
    uhid: string;
    patient_name: string;
    phone: string;
    department: string;
    created_at: string;
    gender: string;
    age: number | null;
    visits?: number;
  }) => {
    const key = patientKey(input.patient_name, input.phone, input.uhid);
    const existing = directory.get(key);
    if (!existing) {
      directory.set(key, {
        id: input.id,
        uhid: input.uhid,
        patient_name: input.patient_name,
        phone: input.phone,
        department: input.department,
        visits: input.visits ?? 1,
        last_encounter: input.created_at,
        first_registered: input.created_at,
        gender: input.gender,
        age: input.age,
        record_status: 'Verified Profile',
      });
      return;
    }
    existing.visits += input.visits ?? 1;
    if (input.created_at && (!existing.last_encounter || input.created_at > existing.last_encounter)) {
      existing.last_encounter = input.created_at;
      existing.department = input.department || existing.department;
    }
    if (input.created_at && (!existing.first_registered || input.created_at < existing.first_registered)) {
      existing.first_registered = input.created_at;
    }
    if (!existing.gender && input.gender) existing.gender = input.gender;
    if (existing.age == null && input.age != null) existing.age = input.age;
    if (existing.uhid.startsWith('NX-OPD-') && input.uhid && !input.uhid.startsWith('NX-OPD-')) {
      existing.uhid = input.uhid;
    }
  };

  for (const visit of queue) {
    upsert({
      id: visit.id,
      uhid: visit.uhid,
      patient_name: visit.patient_name,
      phone: visit.phone,
      department: visit.department,
      created_at: visit.created_at || visit.appointment_date,
      gender: visit.gender,
      age: visit.age,
    });
  }

  for (const row of extraPatients) {
    upsert({
      id: String(row.id ?? row.uhid ?? ''),
      uhid: String(row.uhid ?? row.id ?? ''),
      patient_name: String(row.full_name ?? row.patient_name ?? row.name ?? ''),
      phone: String(row.phone ?? row.mobile ?? ''),
      department: String(row.department ?? 'General Outpatient'),
      created_at: String(row.created_at ?? row.last_visit_at ?? ''),
      gender: String(row.gender ?? row.sex ?? ''),
      age: row.age == null || row.age === '' ? null : Number(row.age),
      visits: Number(row.visit_count ?? 0) || 1,
    });
  }

  return Array.from(directory.values()).map((patient) => {
    const daysSince = waitMinutes(patient.last_encounter);
    const record_status =
      daysSince != null && daysSince <= 30 * 24 * 60
        ? 'Active Chart'
        : patient.visits > 1
          ? 'Longitudinal Chart'
          : 'Verified Profile';
    return { ...patient, record_status };
  });
}

async function selectScoped(table: string, hospitalId: string): Promise<Record<string, unknown>[]> {
  if (!supabase || !hospitalId) return [];
  const { data, error } = await supabase.from(table).select('*').eq('hospital_id', hospitalId);
  if (error || !data) return [];
  return data as Record<string, unknown>[];
}

async function insertFirst(
  attempts: Array<{ table: string; payload: Record<string, unknown> }>,
): Promise<string | null> {
  if (!supabase) return 'Supabase is not configured';
  let lastError = 'Insert failed';
  for (const attempt of attempts) {
    const { error } = await supabase.from(attempt.table).insert(attempt.payload);
    if (!error) return null;
    lastError = error.message;
  }
  return lastError;
}

function EmptyState({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: typeof Users;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="p-12 text-center space-y-3 border border-dashed border-slate-200 rounded-2xl">
      <Icon className="w-8 h-8 mx-auto text-slate-300" />
      <div className="text-sm font-bold text-slate-700">{title}</div>
      <p className="text-xs text-slate-400 max-w-md mx-auto">{body}</p>
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold"
      >
        <Plus className="w-3.5 h-3.5" />
        {actionLabel}
      </button>
    </div>
  );
}

export default function HospitalMasterDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<NavModule>('dashboard');
  const [currentUserRole, setCurrentUserRole] = useState('Staff');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalKind>(null);

  const [hospitalInfo, setHospitalInfo] = useState<HospitalInfo>({
    id: '',
    nodeCode: '',
    name: '',
    adminName: '',
    adminEmail: '',
  });

  const [staffMembers, setStaffMembers] = useState<StaffRow[]>([]);
  const [opdQueue, setOpdQueue] = useState<QueueRow[]>([]);
  const [masterPatients, setMasterPatients] = useState<Record<string, unknown>[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [ageFilter, setAgeFilter] = useState('all');
  const [advancingTokenId, setAdvancingTokenId] = useState<string | null>(null);
  const [pharmacyItems, setPharmacyItems] = useState<PharmacyRow[]>([]);
  const [beds, setBeds] = useState<BedRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [supplyOrders, setSupplyOrders] = useState<SupplyRow[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyRow[]>([]);

  const [isSubmittingToken, setIsSubmittingToken] = useState(false);
  const [opdTokenPreview, setOpdTokenPreview] = useState(mintOpdToken);
  const [opdForm, setOpdForm] = useState({ patientName: '', department: 'General Medicine', phone: '' });
  const [medForm, setMedForm] = useState({ name: '', category: 'Medicine', stock: 100 });
  const [bedForm, setBedForm] = useState({ ward: 'General Ward', bedNumber: '', patientName: '' });
  const [invoiceForm, setInvoiceForm] = useState({ patientName: '', service: 'OPD Consultation', amount: 800 });
  const [supplyForm, setSupplyForm] = useState({ vendor: '', item: '', quantity: 1, amount: 0 });

  const loadPlatformData = useCallback(async (hospitalId: string) => {
    if (!supabase || !hospitalId) return;
    setIsLoading(true);

    try {
      const [
        staffRows,
        aptRows,
        opdRows,
        patientAptRows,
        patientRows,
        hospitalPatientRows,
        pharmRows,
        inventoryRows,
        bedRows,
        invoiceRows,
        billRows,
        poRows,
        supplyRows,
        emergencyRows,
        hospitalEmergencyRows,
      ] = await Promise.all([
        selectScoped('hospital_staff_credentials', hospitalId),
        selectScoped('appointments', hospitalId),
        selectScoped('hospital_opd_queue', hospitalId),
        selectScoped('patient_appointments', hospitalId),
        selectScoped('patients', hospitalId),
        selectScoped('hospital_patients', hospitalId),
        selectScoped('hospital_pharmacy_inventory', hospitalId),
        selectScoped('inventory_items', hospitalId),
        selectScoped('hospital_beds', hospitalId),
        selectScoped('hospital_invoices', hospitalId),
        selectScoped('bills', hospitalId),
        selectScoped('purchase_orders', hospitalId),
        selectScoped('hospital_supply_orders', hospitalId),
        selectScoped('emergency_triages', hospitalId),
        selectScoped('hospital_emergencies', hospitalId),
      ]);

      setStaffMembers(
        staffRows.map((row) => ({
          id: String(row.id ?? ''),
          full_name: String(row.full_name ?? ''),
          staff_type: String(row.staff_type ?? ''),
          department: String(row.department ?? ''),
          email: String(row.email ?? ''),
          temporary_passcode: String(row.temporary_passcode ?? ''),
          portal_access: String(row.portal_access ?? ''),
          status: String(row.status ?? 'Active'),
        })),
      );

      const queueSource = [
        ...opdRows.map((row) => mapQueueRow(row, 'hospital_opd_queue')),
        ...aptRows.map((row) => mapQueueRow(row, 'appointments')),
        ...patientAptRows.map((row) => mapQueueRow(row, 'patient_appointments')),
      ];
      const seenQueueIds = new Set<string>();
      setOpdQueue(
        queueSource.flatMap((row) => {
          if (!row || seenQueueIds.has(row.id)) return [];
          seenQueueIds.add(row.id);
          return [row];
        }),
      );
      setMasterPatients([...patientRows, ...hospitalPatientRows]);

      const pharmacySource = pharmRows.length > 0 ? pharmRows : inventoryRows;
      setPharmacyItems(
        pharmacySource.map((row) => ({
          id: String(row.id ?? ''),
          item_name: String(row.item_name ?? row.name ?? ''),
          category: String(row.category ?? 'Medicine'),
          stock: Number(row.stock ?? row.quantity_in_stock ?? 0),
          status: String(row.status ?? (Number(row.stock ?? row.quantity_in_stock ?? 0) > 0 ? 'In Stock' : 'Out of Stock')),
        })),
      );

      setBeds(
        bedRows.map((row) => ({
          id: String(row.id ?? ''),
          ward_name: String(row.ward_name ?? row.ward ?? ''),
          bed_number: String(row.bed_number ?? ''),
          status: String(row.status ?? (row.is_occupied ? 'Occupied' : 'Available')),
          patient_name: String(row.patient_name ?? '-'),
        })),
      );

      const invoiceSource = invoiceRows.length > 0 ? invoiceRows : billRows;
      setInvoices(
        invoiceSource.map((row) => ({
          id: String(row.invoice_number ?? row.id ?? ''),
          patient_name: String(row.patient_name ?? ''),
          service_type: String(row.service_type ?? row.bill_type ?? 'OPD Consultation'),
          amount: Number(row.amount ?? row.total_amount ?? 0),
          status: String(row.status ?? 'unpaid'),
        })),
      );

      const supplySource = supplyRows.length > 0 ? supplyRows : poRows;
      setSupplyOrders(
        supplySource.map((row) => ({
          id: String(row.id ?? ''),
          po_number: String(row.po_number ?? row.id ?? ''),
          vendor_name: String(row.vendor_name ?? ''),
          item_description: String(row.item_description ?? row.item_details ?? ''),
          quantity: Number(row.quantity ?? row.quantity_ordered ?? 1),
          total_amount: Number(row.total_amount ?? 0),
          status: String(row.status ?? 'ISSUED'),
        })),
      );

      const emergencySource = emergencyRows.length > 0 ? emergencyRows : hospitalEmergencyRows;
      setEmergencies(
        emergencySource.map((row) => ({
          id: String(row.id ?? ''),
          patient_name: String(row.patient_name ?? ''),
          complaint: String(row.chief_complaint ?? ''),
          priority: String(row.priority ?? 'P3'),
          status: String(row.status ?? 'active'),
        })),
      );
    } catch (err) {
      console.error('Error fetching scoped platform data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const session = readHospitalAppSession();
    const hospitalId = session?.hospital_id;
    const staffType = session?.staff_type || 'Staff';
    setCurrentUserRole(staffType);

    if (!hospitalId || !isHospitalAppRole(staffType)) {
      router.replace(staffType !== 'Admin' ? '/staff/login' : '/admin/login');
      return;
    }

    void (async () => {
      if (staffType === 'Admin') {
        const completed = await isHospitalSetupCompleted(hospitalId);
        if (!completed) {
          router.replace(`/dashboard/staff-credentials?hospitalId=${encodeURIComponent(hospitalId)}`);
          return;
        }
      }

      setHospitalInfo({
        id: hospitalId,
        nodeCode: nodeCodeFor(hospitalId),
        name: session.hospital_name || 'Hospital Node',
        adminName: session.full_name || 'Hospital User',
        adminEmail: session.email || '',
      });
      setIsVerifying(false);
    })();
  }, [router]);

  useEffect(() => {
    if (isVerifying || !hospitalInfo.id) return;
    void loadPlatformData(hospitalInfo.id);

    if (!supabase) return;

    const channel = supabase
      .channel(`hospital_os_realtime_${hospitalInfo.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `hospital_id=eq.${hospitalInfo.id}` }, () => void loadPlatformData(hospitalInfo.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hospital_opd_queue', filter: `hospital_id=eq.${hospitalInfo.id}` }, () => void loadPlatformData(hospitalInfo.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hospital_staff_credentials', filter: `hospital_id=eq.${hospitalInfo.id}` }, () => void loadPlatformData(hospitalInfo.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hospital_pharmacy_inventory', filter: `hospital_id=eq.${hospitalInfo.id}` }, () => void loadPlatformData(hospitalInfo.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hospital_beds', filter: `hospital_id=eq.${hospitalInfo.id}` }, () => void loadPlatformData(hospitalInfo.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hospital_invoices', filter: `hospital_id=eq.${hospitalInfo.id}` }, () => void loadPlatformData(hospitalInfo.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hospital_supply_orders', filter: `hospital_id=eq.${hospitalInfo.id}` }, () => void loadPlatformData(hospitalInfo.id))
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [hospitalInfo.id, isVerifying, loadPlatformData]);

  const closeModal = () => {
    setIsSubmittingToken(false);
    setActiveModal(null);
  };

  useEffect(() => {
    if (activeModal !== 'opd') return;
    setOpdTokenPreview(mintOpdToken());
    setIsSubmittingToken(false);
  }, [activeModal]);

  const handleIssueToken = async (event: React.FormEvent) => {
    event.preventDefault();
    const patientName = opdForm.patientName.trim();
    if (!patientName || isSubmittingToken) return;

    const tokenNum = opdTokenPreview || mintOpdToken();
    const phoneDigits = opdForm.phone.replace(/\D/g, '').slice(0, 10);
    const phone = phoneDigits ? `+91 ${phoneDigits}` : null;
    const doctorName = staffMembers.find((s) => s.staff_type === 'Doctor')?.full_name || 'Duty Medical Officer';

    setIsSubmittingToken(true);
    try {
      const error = await insertFirst([
        {
          table: 'hospital_opd_queue',
          payload: {
            hospital_id: hospitalInfo.id,
            hospital_name: hospitalInfo.name,
            token_number: tokenNum,
            uhid: tokenNum,
            patient_name: patientName,
            phone,
            department: opdForm.department,
            doctor_name: doctorName,
            status: 'WAITING',
            source: 'hospital_walkin',
            appointment_date: new Date().toISOString().slice(0, 10),
          },
        },
        {
          table: 'appointments',
          payload: {
            hospital_id: hospitalInfo.id,
            token_number: tokenNum,
            uhid: tokenNum,
            patient_name: patientName,
            phone,
            department: opdForm.department,
            doctor_name: doctorName,
            status: 'WAITING',
            appointment_date: new Date().toISOString().slice(0, 10),
          },
        },
      ]);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(`Walk-in token ${tokenNum} created`);
      setOpdForm({ patientName: '', department: 'General Medicine', phone: '' });
      closeModal();
      void loadPlatformData(hospitalInfo.id);
    } finally {
      setIsSubmittingToken(false);
    }
  };

  const handleAdvanceTriage = async (item: QueueRow) => {
    if (!supabase || advancingTokenId) return;
    const stage = triageStage(item.status);
    if (stage === 'Completed') return;
    const nextStatus: TriageStage = stage === 'In Consultation' ? 'Completed' : 'In Consultation';
    setAdvancingTokenId(item.id);
    try {
      const tables = Array.from(new Set([item.source_table, 'hospital_opd_queue', 'appointments']));
      let lastError = 'Unable to update triage status';
      let updated = false;
      for (const table of tables) {
        const { error } = await supabase.from(table).update({ status: nextStatus }).eq('id', item.id);
        if (!error) {
          updated = true;
          break;
        }
        lastError = error.message;
      }
      if (!updated) {
        toast.error(lastError);
        return;
      }
      toast.success(nextStatus === 'In Consultation' ? `Called ${item.token}` : `${item.token} marked complete`);
      void loadPlatformData(hospitalInfo.id);
    } finally {
      setAdvancingTokenId(null);
    }
  };

  const handleAddMedicine = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!medForm.name.trim()) return;
    const stock = Number(medForm.stock) || 0;
    const itemName = medForm.name.trim();
    const category = medForm.category.trim() || 'Medicine';
    const error = await insertFirst([
      {
        table: 'hospital_pharmacy_inventory',
        payload: {
          hospital_id: hospitalInfo.id,
          item_name: itemName,
          category,
          stock,
          status: stock > 0 ? 'In Stock' : 'Out of Stock',
        },
      },
      {
        table: 'inventory_items',
        payload: {
          hospital_id: hospitalInfo.id,
          item_name: itemName,
          name: itemName,
          category,
          quantity_in_stock: stock,
          status: stock > 0 ? 'In Stock' : 'Out of Stock',
        },
      },
    ]);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Medicine added to formulary');
    setMedForm({ name: '', category: 'Medicine', stock: 100 });
    closeModal();
    void loadPlatformData(hospitalInfo.id);
  };

  const handleAddBed = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!bedForm.bedNumber.trim()) return;
    const occupied = Boolean(bedForm.patientName.trim());
    const error = await insertFirst([
      {
        table: 'hospital_beds',
        payload: {
          hospital_id: hospitalInfo.id,
          ward: bedForm.ward,
          ward_name: bedForm.ward,
          bed_number: bedForm.bedNumber.trim(),
          status: occupied ? 'Occupied' : 'Available',
          is_occupied: occupied,
          patient_name: occupied ? bedForm.patientName.trim() : null,
        },
      },
    ]);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Bed registered');
    setBedForm({ ward: 'General Ward', bedNumber: '', patientName: '' });
    closeModal();
    void loadPlatformData(hospitalInfo.id);
  };

  const handleAddInvoice = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!invoiceForm.patientName.trim()) return;
    const amount = Number(invoiceForm.amount) || 0;
    const error = await insertFirst([
      {
        table: 'hospital_invoices',
        payload: {
          hospital_id: hospitalInfo.id,
          invoice_number: `INV-${Date.now()}`,
          patient_name: invoiceForm.patientName.trim(),
          service_type: invoiceForm.service,
          amount,
          status: 'unpaid',
        },
      },
      {
        table: 'bills',
        payload: {
          hospital_id: hospitalInfo.id,
          patient_name: invoiceForm.patientName.trim(),
          bill_type: invoiceForm.service,
          total_amount: amount,
          invoice_number: `INV-${Date.now()}`,
          status: 'unpaid',
        },
      },
    ]);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Invoice posted');
    setInvoiceForm({ patientName: '', service: 'OPD Consultation', amount: 800 });
    closeModal();
    void loadPlatformData(hospitalInfo.id);
  };

  const handleAddSupply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supplyForm.vendor.trim() || !supplyForm.item.trim()) return;
    const error = await insertFirst([
      {
        table: 'hospital_supply_orders',
        payload: {
          hospital_id: hospitalInfo.id,
          po_number: `PO-${Date.now()}`,
          vendor_name: supplyForm.vendor.trim(),
          item_description: supplyForm.item.trim(),
          quantity: Number(supplyForm.quantity) || 1,
          total_amount: Number(supplyForm.amount) || 0,
          status: 'ISSUED',
        },
      },
      {
        table: 'purchase_orders',
        payload: {
          hospital_id: hospitalInfo.id,
          hospital_name: hospitalInfo.name,
          po_number: `PO-${Date.now()}`,
          vendor_name: supplyForm.vendor.trim(),
          item_details: supplyForm.item.trim(),
          quantity_ordered: Number(supplyForm.quantity) || 1,
          total_amount: Number(supplyForm.amount) || 0,
          status: 'ISSUED',
        },
      },
    ]);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Purchase order issued');
    setSupplyForm({ vendor: '', item: '', quantity: 1, amount: 0 });
    closeModal();
    void loadPlatformData(hospitalInfo.id);
  };

  const handleLogout = () => {
    const role = currentUserRole;
    clearActiveSession();
    router.push(role === 'Admin' ? '/admin/login' : '/staff/login');
  };

  const doctorCount = staffMembers.filter((s) => s.staff_type === 'Doctor').length;
  const occupiedBeds = beds.filter((b) => /occup/i.test(b.status)).length;
  const occupancyRate = beds.length > 0 ? Math.round((occupiedBeds / beds.length) * 100) : 0;
  const totalCollections = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const outstanding = invoices.filter((inv) => !/paid|settled/i.test(inv.status)).reduce((sum, inv) => sum + inv.amount, 0);

  const waitingCount = opdQueue.filter((q) => triageStage(q.status) === 'Waiting').length;
  const inConsultCount = opdQueue.filter((q) => triageStage(q.status) === 'In Consultation').length;
  const waitingMinutes = opdQueue
    .filter((q) => triageStage(q.status) === 'Waiting')
    .map((q) => waitMinutes(q.created_at))
    .filter((mins): mins is number => mins != null);
  const avgWaitLabel = waitingMinutes.length === 0
    ? '—'
    : `~${Math.round(waitingMinutes.reduce((sum, mins) => sum + mins, 0) / waitingMinutes.length)}m`;

  const patientRegistry = useMemo(
    () => buildPatientDirectory(opdQueue, masterPatients),
    [opdQueue, masterPatients],
  );

  const filteredPatients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return patientRegistry.filter((patient) => {
      if (query) {
        const haystack = `${patient.uhid} ${patient.patient_name} ${patient.phone}`.toLowerCase();
        const digits = query.replace(/\D/g, '');
        const phoneDigits = patient.phone.replace(/\D/g, '');
        const matchesText = haystack.includes(query);
        const matchesPhone = digits.length >= 3 && phoneDigits.includes(digits);
        if (!matchesText && !matchesPhone) return false;
      }
      if (genderFilter !== 'all' && patient.gender.toLowerCase() !== genderFilter) {
        return false;
      }
      if (ageFilter === 'pediatric' && (patient.age == null || patient.age >= 18)) return false;
      if (ageFilter === 'adult' && (patient.age == null || patient.age < 18 || patient.age >= 60)) return false;
      if (ageFilter === 'senior' && (patient.age == null || patient.age < 60)) return false;
      return true;
    });
  }, [patientRegistry, searchQuery, genderFilter, ageFilter]);

  const navLinks: Array<{ id: NavModule; label: string; icon: typeof LayoutGrid; badge?: number }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'smartq', label: 'SmartQ OPD', icon: ListOrdered, badge: waitingCount + inConsultCount },
    { id: 'patients', label: 'Patients', icon: Users, badge: patientRegistry.length },
    { id: 'ipd', label: 'IPD & Bed Census', icon: BedDouble, badge: beds.length },
    { id: 'pharmacy', label: 'Records & Pharmacy', icon: ClipboardCheck, badge: pharmacyItems.length },
    { id: 'emergency', label: 'Emergency Desk', icon: AlertTriangle, badge: emergencies.length },
    { id: 'billing', label: 'Billing & Cashier', icon: IndianRupee, badge: invoices.length },
    { id: 'supply', label: 'Supply & Orders', icon: PackageCheck, badge: supplyOrders.length },
    { id: 'staff', label: 'Doctors & Staff', icon: HeartHandshake, badge: staffMembers.length },
  ];

  const sidebar = (
    <>
      <div className="p-5 overflow-y-auto">
        <div className="text-[11px] font-extrabold uppercase tracking-widest text-[#2dd4bf] font-mono">HOSPITAL APP</div>
        <h1 className="text-lg font-black text-white tracking-tight leading-tight mt-0.5">{hospitalInfo.name}</h1>
        <div className="text-[11px] font-mono text-cyan-300/80 font-bold mt-0.5">{hospitalInfo.nodeCode}</div>
        <nav className="mt-6 space-y-1">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive ? 'bg-[#18537a] text-white shadow-md font-bold' : 'text-slate-300 hover:text-white hover:bg-[#0e3b5b]/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-300' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {Boolean(item.badge) && (
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${isActive ? 'bg-cyan-400 text-slate-950' : 'bg-[#144466] text-cyan-200'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="p-4 border-t border-[#124263] bg-[#07253a] flex items-center justify-between">
        <div className="truncate pr-2">
          <div className="text-xs font-bold text-white truncate">{hospitalInfo.adminName}</div>
          <div className="text-[10px] text-cyan-300/70 truncate">{hospitalInfo.adminEmail}</div>
        </div>
        <button type="button" onClick={handleLogout} className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-[#0e3b5b]" title="Log Out">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </>
  );

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-700" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#f1f5f9] text-slate-800 font-sans overflow-hidden select-none">
      <aside className="w-64 bg-[#0a2e47] text-slate-200 hidden md:flex flex-col justify-between shrink-0 shadow-2xl z-30">
        {sidebar}
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" className="absolute inset-0 bg-slate-950/50" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />
          <aside className="relative z-50 h-full w-64 bg-[#0a2e47] text-slate-200 flex flex-col justify-between">{sidebar}</aside>
        </div>
      )}

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 sm:px-8 py-4 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <button type="button" className="md:hidden p-2 rounded-xl border border-slate-200" onClick={() => setMobileNavOpen(true)} aria-label="Open modules">
              <Menu className="w-4 h-4" />
            </button>
            <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-[#0c314b]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 leading-tight">
                {navLinks.find((n) => n.id === activeTab)?.label} Command Center
              </h2>
              <p className="text-xs text-slate-500">
                Active Node: <span className="font-mono text-cyan-800 font-bold">{hospitalInfo.id} ({hospitalInfo.name})</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setActiveModal('opd')} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Issue OPD Token
            </button>
            <button type="button" onClick={() => router.push('/dashboard/staff-credentials')} className="px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Provision Staff
            </button>
            <button type="button" onClick={() => void loadPlatformData(hospitalInfo.id)} className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50">
              <RefreshCw className={`w-4 h-4 text-cyan-600 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-black text-slate-900">Facility Operations Snapshot</h3>
                <p className="text-xs text-slate-500">Live census scoped to {hospitalInfo.id}. Empty modules stay empty until real records exist.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <button type="button" onClick={() => setActiveTab('smartq')} className="bg-white rounded-2xl p-5 border border-slate-200 text-left">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">LIVE OPD QUEUE</div>
                  <div className="text-3xl font-black text-slate-900 mt-2">{opdQueue.length}</div>
                  <div className="text-xs font-medium text-cyan-700 mt-1">{opdQueue.length} waiting in triage</div>
                </button>
                <button type="button" onClick={() => setActiveTab('staff')} className="bg-white rounded-2xl p-5 border border-slate-200 text-left">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">PROVISIONED STAFF</div>
                  <div className="text-3xl font-black text-slate-900 mt-2">{staffMembers.length}</div>
                  <div className="text-xs font-medium text-cyan-700 mt-1">{doctorCount} doctors verified</div>
                </button>
                <button type="button" onClick={() => setActiveTab('ipd')} className="bg-white rounded-2xl p-5 border border-slate-200 text-left">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">BED OCCUPANCY</div>
                  <div className="text-3xl font-black text-slate-900 mt-2">{occupancyRate}%</div>
                  <div className="text-xs font-medium text-cyan-700 mt-1">{occupiedBeds}/{beds.length} occupied</div>
                </button>
                <button type="button" onClick={() => setActiveTab('billing')} className="bg-white rounded-2xl p-5 border border-slate-200 text-left">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">COLLECTIONS (₹)</div>
                  <div className="text-3xl font-black text-slate-900 mt-2">{inr(totalCollections)}</div>
                  <div className="text-xs font-medium text-emerald-600 mt-1">{inr(outstanding)} outstanding</div>
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-cyan-700" />
                      <h4 className="text-sm font-black text-slate-900">Recent Live Outpatients</h4>
                    </div>
                  </div>
                  {opdQueue.length === 0 ? (
                    <EmptyState icon={Users} title="No active OPD patients" body={`No appointments for ${hospitalInfo.id}. Issue a walk-in token to start.`} actionLabel="Issue OPD Token" onAction={() => setActiveModal('opd')} />
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                          <th className="py-2.5 px-3">Token</th>
                          <th className="py-2.5 px-3">Patient</th>
                          <th className="py-2.5 px-3">Dept</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {opdQueue.slice(0, 6).map((q) => (
                          <tr key={q.id}>
                            <td className="py-2.5 px-3 font-mono font-bold text-cyan-800">{q.token}</td>
                            <td className="py-2.5 px-3 font-bold">{q.patient_name}</td>
                            <td className="py-2.5 px-3">{q.department}</td>
                            <td className="py-2.5 px-3">{q.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                    <h4 className="text-sm font-black text-slate-900">Emergency Status</h4>
                    {emergencies.length === 0 ? (
                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                        <div className="font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Node {hospitalInfo.id} Ready
                        </div>
                        <p className="text-[11px] text-emerald-700 mt-1">No active red alerts for this hospital node.</p>
                      </div>
                    ) : (
                      emergencies.slice(0, 3).map((alert) => (
                        <div key={alert.id} className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-xs">
                          <div className="font-bold text-rose-800">{alert.patient_name} · {alert.priority}</div>
                          <p className="text-rose-700">{alert.complaint}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
                    <h4 className="text-sm font-black text-slate-900">Vendor Supply</h4>
                    {supplyOrders.length === 0 ? (
                      <EmptyState icon={PackageCheck} title="No purchase orders" body="No procurement records for this node." actionLabel="Create Purchase Order" onAction={() => setActiveModal('supply')} />
                    ) : (
                      supplyOrders.slice(0, 3).map((po) => (
                        <div key={po.id} className="p-3 rounded-xl border border-slate-200 text-xs">
                          <div className="font-mono font-bold text-cyan-800">{po.po_number}</div>
                          <div className="font-bold text-slate-900">{po.item_description}</div>
                          <div className="text-slate-500">{po.vendor_name} · {inr(po.total_amount)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'smartq' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-[10px] font-mono font-bold text-cyan-800 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    ACTIVE TRIAGE ENGINE
                  </div>
                  <h3 className="text-lg font-black text-slate-900">SmartQ OPD Consultation Queue</h3>
                  <p className="text-xs text-slate-500">Live token orchestration synchronized with Doctor Workspace examination rooms.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal('opd')}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Issue Walk-In Token</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono font-bold uppercase text-slate-400">Waiting in Lobby</div>
                    <div className="text-2xl font-black text-slate-900 mt-0.5">{waitingCount}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-cyan-50 text-cyan-700">
                    <ListOrdered className="w-5 h-5" />
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono font-bold uppercase text-slate-400">In Consultation</div>
                    <div className="text-2xl font-black text-blue-700 mt-0.5">{inConsultCount}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono font-bold uppercase text-slate-400">Avg Wait Time</div>
                    <div className="text-2xl font-black text-emerald-700 mt-0.5">{avgWaitLabel}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                {opdQueue.length === 0 ? (
                  <div className="p-12">
                    <EmptyState
                      icon={Clock}
                      title="No Patients in SmartQ Queue"
                      body={`Lobby is clear. Walk-in tokens and Patient App bookings scoped to ${hospitalInfo.name} appear in this triage stream instantly.`}
                      actionLabel="Issue First Token"
                      onAction={() => setActiveModal('opd')}
                    />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Token #</th>
                          <th className="py-3 px-4">Patient Name</th>
                          <th className="py-3 px-4">Department</th>
                          <th className="py-3 px-4">Assigned Doctor</th>
                          <th className="py-3 px-4">Wait Time</th>
                          <th className="py-3 px-4">Triage Stage</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {opdQueue.map((item) => {
                          const stage = triageStage(item.status);
                          return (
                            <tr key={`${item.source_table}-${item.id}`} className="hover:bg-cyan-50/40 transition">
                              <td className="py-3.5 px-4 font-mono font-black text-cyan-800">{item.token}</td>
                              <td className="py-3.5 px-4 font-bold text-slate-900">{item.patient_name}</td>
                              <td className="py-3.5 px-4 text-slate-600">{item.department}</td>
                              <td className="py-3.5 px-4 text-slate-600">{item.doctor_name || 'Unassigned'}</td>
                              <td className="py-3.5 px-4 font-mono text-slate-500">{formatWait(item.created_at)}</td>
                              <td className="py-3.5 px-4">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  stage === 'In Consultation'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : stage === 'Completed'
                                      ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}>
                                  {stage}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                {stage === 'Completed' ? (
                                  <span className="text-[11px] font-bold text-slate-400">Closed</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => void handleAdvanceTriage(item)}
                                    disabled={advancingTokenId === item.id}
                                    className="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-cyan-600 bg-white text-[11px] font-bold text-slate-700 hover:text-cyan-800 transition cursor-pointer disabled:opacity-50"
                                  >
                                    {advancingTokenId === item.id ? 'Updating…' : stage === 'In Consultation' ? 'Mark Complete' : 'Call Next'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'patients' && (
            <div className="space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Master Patient Registry &amp; EMR Index</h3>
                  <p className="text-xs text-slate-500">Demographic repository and encounter histories registered at {hospitalInfo.name}.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search by UHID, name, or phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-cyan-700"
                    />
                  </div>
                  <select
                    value={genderFilter}
                    onChange={(e) => setGenderFilter(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                  >
                    <option value="all">All Genders</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  <select
                    value={ageFilter}
                    onChange={(e) => setAgeFilter(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                  >
                    <option value="all">All Ages</option>
                    <option value="pediatric">Pediatric (&lt;18)</option>
                    <option value="adult">Adult (18–59)</option>
                    <option value="senior">Senior (60+)</option>
                  </select>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                {patientRegistry.length === 0 ? (
                  <div className="p-12">
                    <EmptyState
                      icon={Users}
                      title="No Patient Records Synchronized"
                      body={`Zero mock entries. Verified profiles from the Patient App and walk-in OPD registrations scoped to ${hospitalInfo.name} (${hospitalInfo.id}) populate here.`}
                      actionLabel="Issue Walk-In Token"
                      onAction={() => setActiveModal('opd')}
                    />
                  </div>
                ) : filteredPatients.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 space-y-2">
                    <Search className="w-8 h-8 mx-auto text-slate-300" />
                    <div className="text-sm font-bold text-slate-700">No matching patient charts</div>
                    <p className="text-xs text-slate-400">Adjust search or gender/age filters to widen the directory.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Permanent UHID</th>
                          <th className="py-3 px-4">Full Name</th>
                          <th className="py-3 px-4">Contact Number</th>
                          <th className="py-3 px-4">Total Visits</th>
                          <th className="py-3 px-4">Last Encounter</th>
                          <th className="py-3 px-4 text-right">Clinical Record Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPatients.map((patient) => (
                          <tr key={patient.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3.5 px-4 font-mono font-bold text-cyan-800">{patient.uhid}</td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900">{patient.patient_name}</div>
                              <div className="text-[10px] text-slate-400">
                                {patient.gender || 'Sex n/a'}
                                {patient.age != null ? ` · ${patient.age}y` : ''}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-600">{patient.phone || 'Not Provided'}</td>
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{patient.visits}</td>
                            <td className="py-3.5 px-4 font-mono text-slate-500">{formatEncounter(patient.last_encounter)}</td>
                            <td className="py-3.5 px-4 text-right">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {patient.record_status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'pharmacy' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Records &amp; Pharmacy Formulary</h3>
                  <p className="text-xs text-slate-500">Live inventory for {hospitalInfo.name}. No placeholder SKUs.</p>
                </div>
                <button type="button" onClick={() => setActiveModal('pharmacy')} className="px-3.5 py-2 rounded-xl bg-cyan-700 text-white text-xs font-bold flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add Formulary Item
                </button>
              </div>
              {pharmacyItems.length === 0 ? (
                <EmptyState icon={Pill} title="Formulary Empty" body={`No medicines stocked for ${hospitalInfo.name}. Add the first formulary item.`} actionLabel="Add Formulary Item" onAction={() => setActiveModal('pharmacy')} />
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase">
                    <tr>
                      <th className="py-3 px-4">Item</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Stock</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pharmacyItems.map((med) => (
                      <tr key={med.id}>
                        <td className="py-3.5 px-4 font-bold">{med.item_name}</td>
                        <td className="py-3.5 px-4">{med.category}</td>
                        <td className="py-3.5 px-4 font-mono">{med.stock}</td>
                        <td className="py-3.5 px-4 text-right">{med.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Billing &amp; Cashier</h3>
                  <p className="text-xs text-slate-500">Invoices in INR, scoped to {hospitalInfo.id}.</p>
                </div>
                <button type="button" onClick={() => setActiveModal('invoice')} className="px-3.5 py-2 rounded-xl bg-cyan-700 text-white text-xs font-bold flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add Invoice
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="bg-white rounded-2xl p-5 border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-400 uppercase font-mono">Gross Collections</div>
                  <div className="text-3xl font-black mt-2">{inr(totalCollections)}</div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-400 uppercase font-mono">Outstanding</div>
                  <div className="text-3xl font-black mt-2">{inr(outstanding)}</div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-400 uppercase font-mono">Invoices</div>
                  <div className="text-3xl font-black mt-2">{invoices.length}</div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                {invoices.length === 0 ? (
                  <EmptyState icon={IndianRupee} title="No invoices yet" body="They post when you add a cashier invoice or when a consultation is billed." actionLabel="Add Invoice" onAction={() => setActiveModal('invoice')} />
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="text-[10px] font-black uppercase text-slate-400">
                      <tr>
                        <th className="py-2.5 px-3">Invoice</th>
                        <th className="py-2.5 px-3">Patient</th>
                        <th className="py-2.5 px-3">Service</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoices.map((inv) => (
                        <tr key={inv.id}>
                          <td className="py-2.5 px-3 font-mono font-bold text-cyan-800">{inv.id}</td>
                          <td className="py-2.5 px-3 font-bold">{inv.patient_name}</td>
                          <td className="py-2.5 px-3">{inv.service_type}</td>
                          <td className="py-2.5 px-3">{inr(inv.amount)}</td>
                          <td className="py-2.5 px-3 text-right">{inv.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === 'supply' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Procurement &amp; Vendor Dispatch</h3>
                  <p className="text-xs text-slate-500">Purchase requests scoped to {hospitalInfo.id}.</p>
                </div>
                <button type="button" onClick={() => setActiveModal('supply')} className="px-3.5 py-2 rounded-xl bg-cyan-700 text-white text-xs font-bold flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Create Purchase Order
                </button>
              </div>
              {supplyOrders.length === 0 ? (
                <EmptyState icon={PackageCheck} title="No Purchase Orders Issued" body="All placeholder orders are purged. Issue a PO to stock this node." actionLabel="Create Purchase Order" onAction={() => setActiveModal('supply')} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {supplyOrders.map((po) => (
                    <div key={po.id} className="p-5 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-cyan-800">{po.po_number}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-700">{po.status}</span>
                      </div>
                      <div className="font-bold text-sm">{po.item_description}</div>
                      <div className="text-xs text-slate-500">{po.vendor_name}</div>
                      <div className="pt-2 border-t border-slate-100 flex justify-between text-xs">
                        <span className="font-mono font-bold">{inr(po.total_amount)}</span>
                        <span className="text-slate-400">Qty: {po.quantity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'ipd' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">IPD &amp; Bed Census</h3>
                  <p className="text-xs text-slate-500">Ward allocations registered for {hospitalInfo.name}.</p>
                </div>
                <button type="button" onClick={() => setActiveModal('bed')} className="px-3.5 py-2 rounded-xl bg-cyan-700 text-white text-xs font-bold flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Register Bed
                </button>
              </div>
              {beds.length === 0 ? (
                <EmptyState icon={BedDouble} title="No Beds Registered" body="Zero mock beds. Register the first ward allocation for this hospital node." actionLabel="Register Bed" onAction={() => setActiveModal('bed')} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {beds.map((b) => (
                    <div key={b.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold">{b.ward_name} &bull; Bed {b.bed_number}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {/occup/i.test(b.status) ? `Patient: ${b.patient_name}` : 'Available for admission'}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${/occup/i.test(b.status) ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                        {b.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Hospital Staff Directory</h3>
                  <p className="text-xs text-slate-500">Active roster for {hospitalInfo.name}.</p>
                </div>
                <button type="button" onClick={() => router.push('/dashboard/staff-credentials')} className="px-4 py-2 rounded-xl bg-cyan-700 text-white text-xs font-bold flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Staff Credential
                </button>
              </div>
              {currentUserRole !== 'Admin' ? (
                <div className="p-10 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
                  <div className="p-3 bg-cyan-50 text-cyan-700 rounded-full w-fit mx-auto border border-cyan-200">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold">Credential Keyring Restricted</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Logged in as {currentUserRole}. You may provision new staff, but existing passcodes are visible only to Hospital Administrators.
                  </p>
                </div>
              ) : staffMembers.length === 0 ? (
                <EmptyState icon={HeartHandshake} title="No staff provisioned" body="Add the first clinician or support credential for this node." actionLabel="Add Staff Credential" onAction={() => router.push('/dashboard/staff-credentials')} />
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase">
                      <tr>
                        <th className="py-3 px-4">Staff Member &amp; ID</th>
                        <th className="py-3 px-4">Department &amp; Role</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Passcode Key</th>
                        <th className="py-3 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {staffMembers.map((member) => (
                        <tr key={member.id}>
                          <td className="py-3.5 px-4 font-bold">
                            <span className="font-mono text-[10px] font-bold text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200 mr-2">{member.id}</span>
                            {member.full_name}
                          </td>
                          <td className="py-3.5 px-4">{member.department} ({member.staff_type})</td>
                          <td className="py-3.5 px-4 font-mono">{member.email}</td>
                          <td className="py-3.5 px-4 font-mono font-bold text-cyan-800">{member.temporary_passcode}</td>
                          <td className="py-3.5 px-4 text-right">{member.status || 'Active'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'emergency' && (
            <div className="p-8 bg-white rounded-2xl border border-slate-200 space-y-4">
              <h3 className="text-lg font-black text-slate-900">Emergency Desk Command</h3>
              <p className="text-xs text-slate-500">Trauma triage for {hospitalInfo.name} only.</p>
              {emergencies.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  No active red alerts currently dispatched for {hospitalInfo.id}. Triage desk is on standby.
                </div>
              ) : (
                <div className="grid gap-3">
                  {emergencies.map((alert) => (
                    <div key={alert.id} className="p-4 rounded-xl border border-rose-200 bg-rose-50">
                      <div className="flex justify-between text-sm font-bold text-rose-800">
                        <span>{alert.patient_name}</span>
                        <span>{alert.priority}</span>
                      </div>
                      <p className="text-xs text-rose-700 mt-1">{alert.complaint}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {activeModal === 'opd' && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600">
                  <TicketPlus className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900 tracking-tight">Issue Walk-In OPD Token</h3>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                      LIVE
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Instant outpatient queue token &bull; Scoped to{' '}
                    <span className="font-semibold text-slate-700">{hospitalInfo.id}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleIssueToken} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Patient Full Name</span>
                  <span className="text-emerald-600 font-normal normal-case text-[10px]">* Required</span>
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Gowda"
                    value={opdForm.patientName}
                    onChange={(e) => setOpdForm((p) => ({ ...p, patientName: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Clinical Department
                </label>
                <div className="relative">
                  <Stethoscope className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <select
                    value={opdForm.department}
                    onChange={(e) => setOpdForm((p) => ({ ...p, department: e.target.value }))}
                    className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition appearance-none cursor-pointer"
                  >
                    {OPD_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3.5 top-3.5 pointer-events-none text-slate-400">
                    <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Contact Mobile</span>
                  <span className="text-slate-400 font-normal normal-case text-[10px]">SMS Updates</span>
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center gap-1 text-slate-500 font-mono font-bold text-xs pointer-events-none">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>+91</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="98450 12345"
                    value={opdForm.phone}
                    onChange={(e) => setOpdForm((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                    className="w-full pl-[4.75rem] pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Auto-Allocated Queue Slot:</span>
                <span className="font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {opdTokenPreview}
                </span>
              </div>

              <div className="pt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingToken || !opdForm.patientName.trim()}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-600/20 active:scale-[0.99] transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  {isSubmittingToken ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Issuing...</span>
                    </>
                  ) : (
                    <span>Create Token</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeModal && activeModal !== 'opd' && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {activeModal === 'pharmacy' && 'Add Medicine to Formulary'}
                {activeModal === 'bed' && 'Register Ward Bed'}
                {activeModal === 'invoice' && 'Post Cashier Invoice'}
                {activeModal === 'supply' && 'Create Purchase Order'}
              </h3>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeModal === 'pharmacy' && (
              <form onSubmit={handleAddMedicine} className="space-y-3 text-xs">
                <input required value={medForm.name} onChange={(e) => setMedForm((p) => ({ ...p, name: e.target.value }))} placeholder="Medicine name" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                <div className="grid grid-cols-2 gap-3">
                  <input value={medForm.category} onChange={(e) => setMedForm((p) => ({ ...p, category: e.target.value }))} placeholder="Category" className="px-3 py-2.5 border border-slate-200 rounded-xl" />
                  <input type="number" min={0} value={medForm.stock} onChange={(e) => setMedForm((p) => ({ ...p, stock: Number(e.target.value) }))} className="px-3 py-2.5 border border-slate-200 rounded-xl font-mono" />
                </div>
                <button type="submit" className="w-full py-2.5 rounded-xl bg-cyan-700 text-white font-bold uppercase">Save to Formulary</button>
              </form>
            )}

            {activeModal === 'bed' && (
              <form onSubmit={handleAddBed} className="space-y-3 text-xs">
                <input required value={bedForm.ward} onChange={(e) => setBedForm((p) => ({ ...p, ward: e.target.value }))} placeholder="Ward name (ICU / General)" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                <input required value={bedForm.bedNumber} onChange={(e) => setBedForm((p) => ({ ...p, bedNumber: e.target.value }))} placeholder="Bed number" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                <input value={bedForm.patientName} onChange={(e) => setBedForm((p) => ({ ...p, patientName: e.target.value }))} placeholder="Occupying patient (optional)" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                <button type="submit" className="w-full py-2.5 rounded-xl bg-cyan-700 text-white font-bold uppercase">Register Bed</button>
              </form>
            )}

            {activeModal === 'invoice' && (
              <form onSubmit={handleAddInvoice} className="space-y-3 text-xs">
                <input required value={invoiceForm.patientName} onChange={(e) => setInvoiceForm((p) => ({ ...p, patientName: e.target.value }))} placeholder="Patient name" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                <input value={invoiceForm.service} onChange={(e) => setInvoiceForm((p) => ({ ...p, service: e.target.value }))} placeholder="Service type" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                <input type="number" min={0} value={invoiceForm.amount} onChange={(e) => setInvoiceForm((p) => ({ ...p, amount: Number(e.target.value) }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-mono" />
                <button type="submit" className="w-full py-2.5 rounded-xl bg-cyan-700 text-white font-bold uppercase">Post Invoice</button>
              </form>
            )}

            {activeModal === 'supply' && (
              <form onSubmit={handleAddSupply} className="space-y-3 text-xs">
                <input required value={supplyForm.vendor} onChange={(e) => setSupplyForm((p) => ({ ...p, vendor: e.target.value }))} placeholder="Vendor name" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                <input required value={supplyForm.item} onChange={(e) => setSupplyForm((p) => ({ ...p, item: e.target.value }))} placeholder="Item description" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" min={1} value={supplyForm.quantity} onChange={(e) => setSupplyForm((p) => ({ ...p, quantity: Number(e.target.value) }))} className="px-3 py-2.5 border border-slate-200 rounded-xl font-mono" />
                  <input type="number" min={0} value={supplyForm.amount} onChange={(e) => setSupplyForm((p) => ({ ...p, amount: Number(e.target.value) }))} placeholder="Amount INR" className="px-3 py-2.5 border border-slate-200 rounded-xl font-mono" />
                </div>
                <button type="submit" className="w-full py-2.5 rounded-xl bg-cyan-700 text-white font-bold uppercase">Issue Purchase Order</button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
