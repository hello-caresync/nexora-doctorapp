'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  BedDouble,
  Bell,
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
  Plus,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  Siren,
  Smartphone,
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
import { hospitalIdQueryValues } from '@/lib/hospital/hospital-node';
import { HOSPITAL_TENANT_ID } from '@/lib/regal/constants';
import { CACHE_KEYS, readLocalJson, writeLocalJson } from '@/lib/persistence/local-cache';
import { dedupeEncounterList } from '@/lib/queue/dedupe-encounters';
import {
  clearConsultationInvoice,
  createPendingConsultationInvoice,
  mapBillingInvoiceRow,
  type InvoiceMedicineLine,
} from '@/lib/billing/post-consultation-invoice';
import { RecordsPharmacyCommandCenter } from '@/components/hospital/RecordsPharmacyCommandCenter';

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
type QueueChannel = 'walk-in' | 'online';

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
  source: string;
  channel: QueueChannel;
  source_table: string;
  gender: string;
  age: number | null;
};

type IncomingBookingAlert = {
  id: string;
  name: string;
  department: string;
  token: string;
};

type WalkInTokenSource = {
  uhid?: string | null;
  token?: string | null;
  appointment_date?: string | null;
  created_at?: string | null;
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

function mapPharmacyRow(row: Record<string, unknown>): PharmacyRow {
  const stock = Number(row.stock ?? row.quantity_in_stock ?? 0);
  return {
    id: String(row.id ?? ''),
    item_name: String(row.item_name ?? row.name ?? '').trim(),
    category: String(row.category ?? 'Medicine').trim() || 'Medicine',
    stock,
    status: String(row.status ?? (stock > 0 ? 'In Stock' : 'Out of Stock')),
  };
}

function formularyMatchKey(item: Pick<PharmacyRow, 'item_name' | 'category'>): string {
  return `${item.item_name.trim().toLowerCase()}::${item.category.trim().toLowerCase()}`;
}

function dedupePharmacyItems(rows: PharmacyRow[]): PharmacyRow[] {
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const next: PharmacyRow[] = [];

  for (const row of rows) {
    if (!row.item_name) continue;
    if (row.id && seenIds.has(row.id)) continue;
    const key = formularyMatchKey(row);
    if (seenKeys.has(key)) continue;
    if (row.id) seenIds.add(row.id);
    seenKeys.add(key);
    next.push(row);
  }

  return next;
}

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
  uhid?: string;
  doctor_name?: string;
  consultation_fee?: number;
  medicines_total?: number;
  medicines?: InvoiceMedicineLine[];
  payment_method?: string;
  paid_at?: string;
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

type HospitalVendorRow = {
  id: string;
  hospital_id: string;
  company_name: string;
  vendor_email: string;
  category: string;
  status: string;
  passcode?: string;
  created_at?: string;
};

function mapHospitalVendor(row: Record<string, unknown>): HospitalVendorRow {
  return {
    id: String(row.id ?? ''),
    hospital_id: String(row.hospital_id ?? HOSPITAL_TENANT_ID),
    company_name: String(row.company_name ?? row.vendor_name ?? row.name ?? 'Vendor'),
    vendor_email: String(row.vendor_email ?? row.email ?? row.rep_email ?? ''),
    category: String(row.category ?? 'Pharmaceuticals'),
    status: String(row.status ?? 'active'),
    passcode: row.passcode ? String(row.passcode) : undefined,
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

type EmergencyRow = {
  id: string;
  patient_name: string;
  complaint: string;
  priority: string;
  status: string;
};

type EmergencyAlertRecord = {
  id: string;
  patient_info: string;
  severity: string;
  arrival: string;
  status: string;
  created_at: string;
};

function mapEmergencyAlert(row: Record<string, unknown>): EmergencyAlertRecord {
  return {
    id: String(row.id ?? ''),
    patient_info: String(row.patient_info ?? row.patient_name ?? row.chief_complaint ?? row.complaint ?? 'Unidentified trauma'),
    severity: String(row.severity ?? row.priority ?? 'code_red'),
    arrival: String(row.arrival ?? row.arrival_mode ?? 'Ambulance'),
    status: String(row.status ?? 'active'),
    created_at: String(row.created_at ?? ''),
  };
}

function isCodeRed(severity: string): boolean {
  return /red|critical|1|p1/i.test(severity);
}

function severityLabel(severity: string): string {
  return isCodeRed(severity) ? 'Code Red' : 'Code Yellow';
}

function mapCheckoutInvoice(row: Record<string, unknown>): InvoiceRow {
  if (row.consultation_fee != null || Array.isArray(row.medicines) || row.payment_status) {
    const bill = mapBillingInvoiceRow(row);
    return {
      id: bill.id,
      patient_name: bill.patient_name,
      service_type: 'OPD Consultation + Pharmacy',
      amount: bill.total_amount,
      status: bill.payment_status,
      uhid: bill.uhid,
      doctor_name: bill.doctor_name,
      consultation_fee: bill.consultation_fee,
      medicines_total: bill.medicines_total,
      medicines: bill.medicines,
      payment_method: bill.payment_method,
      paid_at: bill.paid_at,
    };
  }
  return {
    id: String(row.invoice_number ?? row.id ?? ''),
    patient_name: String(row.patient_name ?? ''),
    service_type: String(row.service_type ?? row.bill_type ?? 'OPD Consultation'),
    amount: Number(row.amount ?? row.total_amount ?? 0),
    status: String(row.status ?? row.payment_status ?? 'unpaid'),
    uhid: row.uhid ? String(row.uhid) : undefined,
    doctor_name: row.doctor_name ? String(row.doctor_name) : undefined,
  };
}

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

const WALK_IN_TOKEN_PREFIX = 'NX-WLK';

function todayIsoDate(): string {
  return new Date().toISOString().split('T')[0];
}

const getNextWalkInToken = (queue: WalkInTokenSource[], prefix = WALK_IN_TOKEN_PREFIX) => {
  const todayStr = todayIsoDate();
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}-(\\d+)$`, 'i');
  let highest = 0;

  for (const item of queue || []) {
    const code = String(item.uhid || item.token || '');
    if (!code.toUpperCase().startsWith(prefix.toUpperCase())) continue;
    const onToday =
      String(item.appointment_date || '').startsWith(todayStr) ||
      String(item.created_at || '').startsWith(todayStr);
    if (!onToday) continue;
    const match = code.match(pattern);
    if (match) highest = Math.max(highest, Number(match[1]));
  }

  return `${prefix}-${String(highest + 1).padStart(3, '0')}`;
};

function classifyQueueSource(row: {
  source?: unknown;
  uhid?: unknown;
  token?: unknown;
  token_number?: unknown;
}): QueueChannel {
  const source = String(row.source ?? '').toUpperCase().replace(/[\s-]+/g, '_');
  const uhid = String(row.uhid ?? '');
  const token = String(row.token_number ?? row.token ?? uhid);
  if (
    source === 'WALK_IN' ||
    source === 'HOSPITAL_WALKIN' ||
    uhid.startsWith('NX-WLK') ||
    uhid.startsWith('NX-OPD') ||
    token.startsWith('NX-WLK') ||
    token.startsWith('NX-OPD')
  ) {
    return 'walk-in';
  }
  return 'online';
}

function QueueChannelBadge({ channel }: { channel: QueueChannel }) {
  if (channel === 'walk-in') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[9px] font-black uppercase tracking-wide">
        <TicketPlus className="w-2.5 h-2.5" />
        Walk-In
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-800 border border-violet-200 text-[9px] font-black uppercase tracking-wide">
      <Smartphone className="w-2.5 h-2.5" />
      Patient App
    </span>
  );
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
  const status = String(row.status ?? row.queue_status ?? 'Waiting');
  const id = String(row.id ?? row.appointment_id ?? row.token_number ?? row.uhid ?? '');
  const patientName = String(row.patient_name ?? row.name ?? '').trim();
  if (!id && !patientName) return null;
  const ageRaw = row.age ?? row.patient_age;
  const channel = classifyQueueSource(row);
  return {
    id: id || `enc-${patientName}-${String(row.appointment_date ?? row.created_at ?? '')}`,
    token: String(row.token_number ?? row.uhid ?? row.token ?? row.id ?? '—'),
    uhid: String(row.uhid ?? row.token_number ?? row.id ?? ''),
    patient_name: patientName || 'Unnamed Patient',
    department: String(row.department ?? 'General Medicine'),
    phone: String(row.phone ?? row.patient_phone ?? ''),
    doctor_name: String(row.doctor_name ?? 'Unassigned'),
    status,
    created_at: String(row.created_at ?? ''),
    appointment_date: String(row.appointment_date ?? row.created_at ?? ''),
    source: String(row.source ?? (channel === 'walk-in' ? 'WALK_IN' : 'PATIENT_APP')),
    channel,
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
  if (!error && Array.isArray(data)) return data as Record<string, unknown>[];

  const aliases = hospitalIdQueryValues(hospitalId);
  const aliased = await supabase.from(table).select('*').in('hospital_id', aliases);
  if (aliased.error || !Array.isArray(aliased.data)) return [];
  return aliased.data as Record<string, unknown>[];
}

/** Facility-wide appointments for this hospital node — never filtered by doctor. */
async function fetchNodeAppointments(hospitalId: string): Promise<Record<string, unknown>[]> {
  if (!supabase || !hospitalId) return [];

  const primary = await supabase
    .from('appointments')
    .select('*')
    .eq('hospital_id', hospitalId)
    .order('created_at', { ascending: false });

  if (!primary.error && Array.isArray(primary.data) && primary.data.length > 0) {
    return primary.data as Record<string, unknown>[];
  }

  const aliases = hospitalIdQueryValues(hospitalId);
  const aliased = await supabase
    .from('appointments')
    .select('*')
    .in('hospital_id', aliases)
    .order('created_at', { ascending: false });

  if (aliased.error || !Array.isArray(aliased.data)) return [];
  return aliased.data as Record<string, unknown>[];
}

function dedupeQueueRows(rows: Array<QueueRow | null>): QueueRow[] {
  const seen = new Set<string>();
  const next: QueueRow[] = [];
  for (const row of rows) {
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    next.push(row);
  }
  return next;
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

type HospitalPlatformCache = {
  hospitalId: string;
  hospitalInfo: HospitalInfo;
  opdQueue: QueueRow[];
  patientRegistry: PatientProfile[];
  staffMembers: StaffRow[];
  pharmacyItems: PharmacyRow[];
  beds: BedRow[];
  invoices: InvoiceRow[];
  supplyOrders: SupplyRow[];
  emergencies: EmergencyRow[];
};

function emptyHospitalInfo(): HospitalInfo {
  return {
    id: '',
    nodeCode: '',
    name: '',
    adminName: '',
    adminEmail: '',
  };
}

function readCachedHospitalInfo(): HospitalInfo | null {
  const session = readHospitalAppSession();
  const cached = readLocalJson<Partial<HospitalInfo>>(CACHE_KEYS.hospitalInfo);
  if (session?.hospital_id) {
    return {
      id: session.hospital_id,
      nodeCode: session.hospital_id,
      name: session.hospital_name || cached?.name || 'Regal Hospital',
      adminName: session.full_name || cached?.adminName || 'Hospital User',
      adminEmail: session.email || cached?.adminEmail || '',
    };
  }
  if (cached?.id) {
    return {
      id: String(cached.id),
      nodeCode: String(cached.nodeCode || cached.id),
      name: String(cached.name || 'Regal Hospital'),
      adminName: String(cached.adminName || ''),
      adminEmail: String(cached.adminEmail || ''),
    };
  }
  return null;
}

function hydrateQueueRows(raw: unknown): QueueRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const record = row as Record<string, unknown>;
    const mapped = mapQueueRow(record, String(record.source_table ?? 'appointments'));
    return mapped ? [mapped] : [];
  });
}

function readCachedPlatform(hospitalId: string): HospitalPlatformCache | null {
  if (!hospitalId) return null;
  const snapshot = readLocalJson<HospitalPlatformCache>(CACHE_KEYS.hospitalPlatform);
  if (snapshot?.hospitalId === hospitalId && Array.isArray(snapshot.opdQueue)) {
    return {
      ...snapshot,
      opdQueue: hydrateQueueRows(snapshot.opdQueue),
    };
  }
  const queue = hydrateQueueRows(readLocalJson(CACHE_KEYS.opdQueue));
  if (!queue.length) return null;
  return {
    hospitalId,
    hospitalInfo: readCachedHospitalInfo() ?? {
      id: hospitalId,
      nodeCode: hospitalId,
      name: 'Regal Hospital',
      adminName: '',
      adminEmail: '',
    },
    opdQueue: queue,
    patientRegistry: [],
    staffMembers: [],
    pharmacyItems: [],
    beds: [],
    invoices: [],
    supplyOrders: [],
    emergencies: [],
  };
}

function persistHospitalDashboardCache(snapshot: HospitalPlatformCache): void {
  writeLocalJson(CACHE_KEYS.hospitalInfo, snapshot.hospitalInfo);
  writeLocalJson(CACHE_KEYS.opdQueue, snapshot.opdQueue);
  writeLocalJson(CACHE_KEYS.hospitalPlatform, snapshot);
}

function missingInsertColumn(message: string | null | undefined): string | null {
  const text = String(message ?? '');
  const postgrest = text.match(/Could not find the '([^']+)' column/i);
  if (postgrest?.[1]) return postgrest[1];
  const postgres = text.match(/column (?:[\w]+\.)?([a-zA-Z0-9_]+) does not exist/i);
  return postgres?.[1] ?? null;
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
  const [currentUserRole, setCurrentUserRole] = useState(() => readHospitalAppSession()?.staff_type || 'Staff');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalKind>(null);

  const [hospitalInfo, setHospitalInfo] = useState<HospitalInfo>(() => readCachedHospitalInfo() ?? emptyHospitalInfo());

  const [staffMembers, setStaffMembers] = useState<StaffRow[]>(() => {
    const scope = readCachedHospitalInfo();
    return readCachedPlatform(scope?.id || '')?.staffMembers ?? [];
  });
  const [opdQueue, setOpdQueue] = useState<QueueRow[]>(() => {
    const scope = readCachedHospitalInfo();
    return readCachedPlatform(scope?.id || '')?.opdQueue ?? [];
  });
  const [patientRegistry, setPatientRegistry] = useState<PatientProfile[]>(() => {
    const scope = readCachedHospitalInfo();
    return readCachedPlatform(scope?.id || '')?.patientRegistry ?? [];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [ageFilter, setAgeFilter] = useState('all');
  const [advancingTokenId, setAdvancingTokenId] = useState<string | null>(null);
  const [pharmacyItems, setPharmacyItems] = useState<PharmacyRow[]>(() => {
    const scope = readCachedHospitalInfo();
    return readCachedPlatform(scope?.id || '')?.pharmacyItems ?? [];
  });
  const [beds, setBeds] = useState<BedRow[]>(() => {
    const scope = readCachedHospitalInfo();
    return readCachedPlatform(scope?.id || '')?.beds ?? [];
  });
  const [settlingInvoiceId, setSettlingInvoiceId] = useState<string | null>(null);
  const [pendingInvoices, setPendingInvoices] = useState<InvoiceRow[]>(() => {
    const scope = readCachedHospitalInfo();
    return (readCachedPlatform(scope?.id || '')?.invoices ?? []).filter((inv) =>
      /pending|unpaid|unbilled/i.test(inv.status),
    );
  });
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceRow[]>(() => {
    const scope = readCachedHospitalInfo();
    return readCachedPlatform(scope?.id || '')?.invoices ?? [];
  });
  const [supplyOrders, setSupplyOrders] = useState<SupplyRow[]>(() => {
    const scope = readCachedHospitalInfo();
    return readCachedPlatform(scope?.id || '')?.supplyOrders ?? [];
  });
  const [emergencies, setEmergencies] = useState<EmergencyRow[]>(() => {
    const scope = readCachedHospitalInfo();
    return readCachedPlatform(scope?.id || '')?.emergencies ?? [];
  });
  const [activeEmergencies, setActiveEmergencies] = useState<EmergencyAlertRecord[]>([]);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [isSubmittingEmergency, setIsSubmittingEmergency] = useState(false);
  const [emPatientInfo, setEmPatientInfo] = useState('');
  const [emSeverity, setEmSeverity] = useState('code_red');
  const [emArrival, setEmArrival] = useState('Ambulance');
  const [showAddInvoiceModal, setShowAddInvoiceModal] = useState(false);
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState(false);
  const [invPatientName, setInvPatientName] = useState('');
  const [invUhid, setInvUhid] = useState('');
  const [invDoctorName, setInvDoctorName] = useState('');
  const [invConsultationFee, setInvConsultationFee] = useState(500);
  const [invMedicines, setInvMedicines] = useState<InvoiceMedicineLine[]>([{ name: '', qty: 1, price: 0 }]);

  const [isSubmittingToken, setIsSubmittingToken] = useState(false);
  const [isSubmittingFormulary, setIsSubmittingFormulary] = useState(false);
  const [onlineBookingAlert, setOnlineBookingAlert] = useState<IncomingBookingAlert | null>(null);
  const [opdTokenPreview, setOpdTokenPreview] = useState(() => getNextWalkInToken([]));
  const [opdForm, setOpdForm] = useState({ patientName: '', department: 'General Medicine', phone: '' });
  const [medForm, setMedForm] = useState({ name: '', category: 'Medicine', stock: 100 });
  const [bedForm, setBedForm] = useState({ ward: 'General Ward', bedNumber: '', patientName: '' });
  const [invoiceForm, setInvoiceForm] = useState({ patientName: '', service: 'OPD Consultation', amount: 800 });
  const [supplyForm, setSupplyForm] = useState({ vendor: '', item: '', quantity: 1, amount: 0 });
  const [vendorsList, setVendorsList] = useState<HospitalVendorRow[]>([]);
  const [isProvisioningVendor, setIsProvisioningVendor] = useState(false);
  const [vendorCompany, setVendorCompany] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorCategory, setVendorCategory] = useState('Pharmaceuticals');
  const [vendorPasscode, setVendorPasscode] = useState('');

  const loadPlatformData = useCallback(async (hospitalId?: string) => {
    if (!supabase) return;
    const activeNode = hospitalId || hospitalInfo.id || HOSPITAL_TENANT_ID;
    if (!activeNode) return;
    setIsLoading(true);

    try {
      const [
        staffRows,
        aptRows,
        opdRows,
        patientRows,
        hospitalPatientRows,
        pharmRows,
        inventoryRows,
        bedRows,
        invoiceRows,
        billRows,
        checkoutRows,
        poRows,
        supplyRows,
        emergencyRows,
        hospitalEmergencyRows,
      ] = await Promise.all([
        selectScoped('hospital_staff_credentials', activeNode),
        fetchNodeAppointments(activeNode),
        selectScoped('hospital_opd_queue', activeNode),
        selectScoped('patients', activeNode),
        selectScoped('hospital_patients', activeNode),
        selectScoped('hospital_pharmacy_inventory', activeNode),
        selectScoped('inventory_items', activeNode),
        selectScoped('hospital_beds', activeNode),
        selectScoped('hospital_invoices', activeNode),
        selectScoped('bills', activeNode),
        selectScoped('billing_invoices', activeNode),
        selectScoped('purchase_orders', activeNode),
        selectScoped('hospital_supply_orders', activeNode),
        selectScoped('emergency_triages', activeNode),
        selectScoped('hospital_emergencies', activeNode),
      ]);

      setStaffMembers(
        (staffRows || []).map((row) => ({
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

      const liveAppointments = aptRows || [];
      const liveQueue = dedupeEncounterList(
        dedupeQueueRows([
          ...liveAppointments.map((row) => mapQueueRow(row, 'appointments')),
          ...(opdRows || []).map((row) => mapQueueRow(row, 'hospital_opd_queue')),
        ]).filter((row): row is QueueRow => Boolean(row)),
      );
      setOpdQueue(liveQueue);
      setPatientRegistry(
        buildPatientDirectory(liveQueue, [...(patientRows || []), ...(hospitalPatientRows || [])]),
      );

      const pharmacySource = (pharmRows || []).length > 0 ? pharmRows : inventoryRows || [];
      setPharmacyItems(dedupePharmacyItems(pharmacySource.map(mapPharmacyRow)));

      setBeds(
        (bedRows || []).map((row) => ({
          id: String(row.id ?? ''),
          ward_name: String(row.ward_name ?? row.ward ?? ''),
          bed_number: String(row.bed_number ?? ''),
          status: String(row.status ?? (row.is_occupied ? 'Occupied' : 'Available')),
          patient_name: String(row.patient_name ?? '-'),
        })),
      );

      const invoiceSource = (invoiceRows || []).length > 0 ? invoiceRows : billRows || [];
      const checkoutSource = (checkoutRows || []).length > 0 ? checkoutRows : invoiceSource;
      const mappedInvoices = checkoutSource.map(mapCheckoutInvoice);
      setInvoices(mappedInvoices);
      setPendingInvoices(mappedInvoices.filter((inv) => /pending|unpaid|unbilled/i.test(inv.status)));

      const supplySource = (supplyRows || []).length > 0 ? supplyRows : poRows || [];
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

      const emergencySource = (emergencyRows || []).length > 0 ? emergencyRows : hospitalEmergencyRows || [];
      const nextEmergencies = emergencySource.map((row) => ({
        id: String(row.id ?? ''),
        patient_name: String(row.patient_name ?? row.patient_info ?? ''),
        complaint: String(row.chief_complaint ?? row.patient_info ?? ''),
        priority: String(row.priority ?? row.severity ?? 'P3'),
        status: String(row.status ?? 'active'),
      }));
      setEmergencies(nextEmergencies);

      const nextHospitalInfo: HospitalInfo = {
        ...hospitalInfo,
        id: activeNode,
        nodeCode: hospitalInfo.nodeCode || activeNode,
        name: hospitalInfo.name || 'Regal Hospital',
      };
      persistHospitalDashboardCache({
        hospitalId: activeNode,
        hospitalInfo: nextHospitalInfo,
        opdQueue: liveQueue,
        patientRegistry: buildPatientDirectory(liveQueue, [...(patientRows || []), ...(hospitalPatientRows || [])]),
        staffMembers: (staffRows || []).map((row) => ({
          id: String(row.id ?? ''),
          full_name: String(row.full_name ?? ''),
          staff_type: String(row.staff_type ?? ''),
          department: String(row.department ?? ''),
          email: String(row.email ?? ''),
          temporary_passcode: String(row.temporary_passcode ?? ''),
          portal_access: String(row.portal_access ?? ''),
          status: String(row.status ?? 'Active'),
        })),
        pharmacyItems: dedupePharmacyItems(pharmacySource.map(mapPharmacyRow)),
        beds: (bedRows || []).map((row) => ({
          id: String(row.id ?? ''),
          ward_name: String(row.ward_name ?? row.ward ?? ''),
          bed_number: String(row.bed_number ?? ''),
          status: String(row.status ?? (row.is_occupied ? 'Occupied' : 'Available')),
          patient_name: String(row.patient_name ?? '-'),
        })),
        invoices: checkoutSource.map(mapCheckoutInvoice),
        supplyOrders: supplySource.map((row) => ({
          id: String(row.id ?? ''),
          po_number: String(row.po_number ?? row.id ?? ''),
          vendor_name: String(row.vendor_name ?? ''),
          item_description: String(row.item_description ?? row.item_details ?? ''),
          quantity: Number(row.quantity ?? row.quantity_ordered ?? 1),
          total_amount: Number(row.total_amount ?? 0),
          status: String(row.status ?? 'ISSUED'),
        })),
        emergencies: nextEmergencies,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown dashboard fetch error';
      console.error('Error fetching scoped platform data for hospital dashboard:', message);
    } finally {
      setIsLoading(false);
    }
  }, [hospitalInfo]);

  const loadPharmacyData = useCallback(async () => {
    if (!supabase) return;
    const activeHospital = hospitalInfo.id || HOSPITAL_TENANT_ID;
    try {
      const pharmRows = await selectScoped('hospital_pharmacy_inventory', activeHospital);
      const inventoryRows = pharmRows.length > 0 ? [] : await selectScoped('inventory_items', activeHospital);
      const source = pharmRows.length > 0 ? pharmRows : inventoryRows;
      setPharmacyItems(dedupePharmacyItems(source.map(mapPharmacyRow)));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to load formulary';
      console.error('Failed to load pharmacy data:', message);
    }
  }, [hospitalInfo.id]);

  const loadBillingInvoices = useCallback(async () => {
    if (!supabase) return;
    const activeNode = hospitalInfo.id || HOSPITAL_TENANT_ID;

    try {
      const { data, error } = await supabase
        .from('billing_invoices')
        .select('*')
        .eq('hospital_id', activeNode)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const mapped = (data || []).map((row) => mapCheckoutInvoice(row as Record<string, unknown>));
      setInvoices(mapped);
      setPendingInvoices(mapped.filter((inv) => /pending|unpaid|unbilled/i.test(inv.status)));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to load billing invoices';
      console.error('Failed to load billing invoices:', message);
    }
  }, [hospitalInfo.id]);

  const loadBillingQueue = loadBillingInvoices;

  const loadEmergencyData = useCallback(async () => {
    if (!supabase) return;
    const activeNode = hospitalInfo.id || HOSPITAL_TENANT_ID;

    try {
      const { data, error } = await supabase
        .from('emergency_alerts')
        .select('*')
        .eq('hospital_id', activeNode)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const alerts = (data || []).map((row) => mapEmergencyAlert(row as Record<string, unknown>));
      setActiveEmergencies(alerts);
      setEmergencies(
        alerts.map((alert) => ({
          id: alert.id,
          patient_name: alert.patient_info,
          complaint: alert.patient_info,
          priority: severityLabel(alert.severity),
          status: alert.status,
        })),
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to load emergency alerts';
      console.error('Failed to load emergency data:', message);
    }
  }, [hospitalInfo.id]);

  const loadVendors = useCallback(async () => {
    if (!supabase) return;
    const activeHospital = hospitalInfo.id || HOSPITAL_TENANT_ID;

    try {
      const { data, error } = await supabase
        .from('hospital_vendors')
        .select('*')
        .eq('hospital_id', activeHospital)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVendorsList((data || []).map((row) => mapHospitalVendor(row as Record<string, unknown>)));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to load vendors';
      console.error('Failed to load vendors:', message);
    }
  }, [hospitalInfo.id]);

  useEffect(() => {
    const session = readHospitalAppSession();
    const hospitalId = session?.hospital_id;
    const staffType = session?.staff_type || 'Staff';
    setCurrentUserRole(staffType);

    if (!hospitalId || !isHospitalAppRole(staffType)) {
      router.replace('/admin/login?tenant=HOSP-01');
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

      const nextHospital: HospitalInfo = {
        id: hospitalId,
        nodeCode: nodeCodeFor(hospitalId),
        name: session.hospital_name || 'Hospital Node',
        adminName: session.full_name || 'Hospital User',
        adminEmail: session.email || '',
      };
      setHospitalInfo(nextHospital);
      writeLocalJson(CACHE_KEYS.hospitalInfo, nextHospital);
      setIsVerifying(false);
    })();
  }, [router]);

  useEffect(() => {
    if (isVerifying) return;
    const activeNode = hospitalInfo.id || HOSPITAL_TENANT_ID;
    void loadPlatformData(activeNode);
    void loadEmergencyData();
    void loadBillingInvoices();

    if (!supabase) return;

    const reload = () => {
      void loadPlatformData(activeNode);
      void loadEmergencyData();
      void loadBillingInvoices();
    };

    const announceOnlineBooking = (raw: unknown) => {
      if (!raw || typeof raw !== 'object') return;
      const row = raw as Record<string, unknown>;
      if (classifyQueueSource(row) !== 'online') return;
      const name = String(row.patient_name ?? row.name ?? 'A patient').trim() || 'A patient';
      const department = String(row.department ?? 'OPD');
      const token = String(row.token_number ?? row.uhid ?? row.token ?? '');
      const alert: IncomingBookingAlert = {
        id: String(row.id ?? row.appointment_id ?? `${name}-${token}`),
        name,
        department,
        token,
      };
      setOnlineBookingAlert(alert);
      toast.success(
        token
          ? `New Patient App booking: ${name} · ${department} · ${token}`
          : `New Patient App booking: ${name} · ${department}`,
      );
    };

    let channel = supabase.channel(`hospital_dashboard_realtime_${activeNode}`);
    for (const nodeId of hospitalIdQueryValues(activeNode)) {
      channel = channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments',
          filter: `hospital_id=eq.${nodeId}`,
        },
        (payload) => {
          announceOnlineBooking(payload.new);
          reload();
        },
      );
      channel = channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: `hospital_id=eq.${nodeId}`,
        },
        reload,
      );
      channel = channel.on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'appointments',
          filter: `hospital_id=eq.${nodeId}`,
        },
        reload,
      );
    }
    channel = channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hospital_opd_queue',
          filter: `hospital_id=eq.${activeNode}`,
        },
        reload,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hospital_staff_credentials',
          filter: `hospital_id=eq.${activeNode}`,
        },
        reload,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hospital_beds',
          filter: `hospital_id=eq.${activeNode}`,
        },
        reload,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hospital_invoices',
          filter: `hospital_id=eq.${activeNode}`,
        },
        reload,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'billing_invoices',
          filter: `hospital_id=eq.${activeNode}`,
        },
        reload,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hospital_supply_orders',
          filter: `hospital_id=eq.${activeNode}`,
        },
        reload,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [hospitalInfo.id, isVerifying, loadPlatformData, loadEmergencyData, loadBillingInvoices]);

  useEffect(() => {
    if (isVerifying) return;
    void loadBillingQueue();

    if (!supabase) return;
    const activeNode = hospitalInfo.id || HOSPITAL_TENANT_ID;

    const billingChannel = supabase
      .channel(`hospital_billing_feed_${activeNode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'billing_invoices',
          filter: `hospital_id=eq.${activeNode}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const incoming = payload.new as Record<string, unknown>;
            toast.info(
              `💳 New Invoice Ready: ${String(incoming.patient_name ?? 'Patient')} — Total: ₹${Number(incoming.total_amount ?? 0)}`,
              { duration: 5000 },
            );
          }
          void loadBillingInvoices();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(billingChannel);
    };
  }, [hospitalInfo.id, isVerifying, loadBillingInvoices]);

  useEffect(() => {
    if (isVerifying) return;
    void loadPharmacyData();

    if (!supabase) return;
    const activeHospital = hospitalInfo.id || HOSPITAL_TENANT_ID;
    const channelName = `pharmacy_inventory_feed_${activeHospital}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hospital_pharmacy_inventory',
          filter: `hospital_id=eq.${activeHospital}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const incoming = mapPharmacyRow((payload.new ?? {}) as Record<string, unknown>);
            setPharmacyItems((prev) => {
              const alreadyExists = prev.some(
                (item) =>
                  (incoming.id && item.id === incoming.id) ||
                  formularyMatchKey(item) === formularyMatchKey(incoming),
              );
              if (alreadyExists) return prev;
              return dedupePharmacyItems([incoming, ...prev]);
            });
            return;
          }

          if (payload.eventType === 'UPDATE') {
            const incoming = mapPharmacyRow((payload.new ?? {}) as Record<string, unknown>);
            setPharmacyItems((prev) =>
              dedupePharmacyItems(
                prev.map((item) => (incoming.id && item.id === incoming.id ? incoming : item)),
              ),
            );
            return;
          }

          if (payload.eventType === 'DELETE') {
            const removedId = String((payload.old as Record<string, unknown> | null)?.id ?? '');
            setPharmacyItems((prev) => prev.filter((item) => item.id !== removedId));
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [hospitalInfo.id, isVerifying, loadPharmacyData]);

  useEffect(() => {
    if (isVerifying) return;
    void loadVendors();

    if (!supabase) return;
    const activeHospital = hospitalInfo.id || HOSPITAL_TENANT_ID;
    const vendorChannelName = `vendors_realtime_${activeHospital}`;

    const vendorChannel = supabase
      .channel(vendorChannelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hospital_vendors',
          filter: `hospital_id=eq.${activeHospital}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const incoming = payload.new as Record<string, unknown>;
            toast.success(
              `🏢 Vendor ${String(incoming.company_name ?? incoming.vendor_name ?? 'partner')} provisioned in real time!`,
            );
          }
          void loadVendors();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(vendorChannel);
    };
  }, [hospitalInfo.id, isVerifying, loadVendors]);

  const closeModal = () => {
    if (isSubmittingFormulary) return;
    setIsSubmittingToken(false);
    setActiveModal(null);
  };

  useEffect(() => {
    if (activeModal !== 'opd') return;
    setIsSubmittingToken(false);
  }, [activeModal]);

  useEffect(() => {
    if (activeModal !== 'opd') return;
    setOpdTokenPreview(getNextWalkInToken(opdQueue));
  }, [activeModal, opdQueue]);

  useEffect(() => {
    if (!onlineBookingAlert) return;
    const timer = window.setTimeout(() => setOnlineBookingAlert(null), 12000);
    return () => window.clearTimeout(timer);
  }, [onlineBookingAlert]);

  const handleIssueTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const patientFullName = opdForm.patientName.trim();
    if (!patientFullName || isSubmittingToken) return;
    if (!supabase) {
      toast.error('Database is not configured.');
      return;
    }

    setIsSubmittingToken(true);

    // Sequential walk-in slot for today — never write this into UUID `id`.
    const tokenString = getNextWalkInToken(opdQueue);

    try {
      const activeHospitalId = hospitalInfo?.id || HOSPITAL_TENANT_ID;
      const contactMobile = opdForm.phone.trim();
      const clinicalDepartment = opdForm.department || 'General Medicine';

      const insertPayload: Record<string, unknown> = {
        // DO NOT provide an `id` field here. Postgres will generate the UUID automatically.
        uhid: tokenString,
        hospital_id: activeHospitalId,
        patient_name: patientFullName,
        department: clinicalDepartment,
        phone: contactMobile ? `+91 ${contactMobile}` : '+91 98450 12345',
        status: 'active',
        source: 'WALK_IN',
        appointment_date: todayIsoDate(),
      };
      delete insertPayload.id;

      let { data, error } = await supabase.from('appointments').insert([insertPayload]).select();

      let attempts = 0;
      while (error && attempts < 8) {
        const column = missingInsertColumn(error.message);
        if (!column || !(column in insertPayload)) break;
        delete insertPayload[column];
        delete insertPayload.id;
        if (column === 'uhid') {
          insertPayload.token_number = tokenString;
        }
        attempts += 1;
        const retry = await supabase.from('appointments').insert([insertPayload]).select();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        // Convert full error properties into a visible string
        const errDetails = `[${error.code || 'UNKNOWN'}] ${error.message || 'No message'} - Details: ${error.details || 'None'} - Hint: ${error.hint || 'None'}`;

        console.error('EXACT OPD ERROR: ' + errDetails);
        alert('Database Error: ' + errDetails);
        toast.error(errDetails);
        return;
      }

      if (!data?.length) {
        toast.error('Database rejected token creation.');
        return;
      }

      toast.success(`Token ${tokenString} created for ${patientFullName}`);

      setOpdForm({ patientName: '', department: 'General Medicine', phone: '' });
      setActiveModal(null);

      await loadPlatformData(activeHospitalId);
    } catch (err: unknown) {
      console.error('Unexpected token creation exception:', err);
      const message = err instanceof Error ? err.message : 'Failed to issue walk-in token.';
      toast.error(message);
    } finally {
      setIsSubmittingToken(false);
    }
  };

  const handleCallNextInterleaved = async () => {
    if (!supabase || advancingTokenId) return;
    setAdvancingTokenId('interleave');
    try {
      const doctorId = staffMembers.find((member) => member.staff_type === 'Doctor')?.id;
      const response = await fetch('/api/queue/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId: hospitalInfo.id || HOSPITAL_TENANT_ID,
          doctorId,
        }),
      });
      const payload = (await response.json()) as {
        nextPatient?: { patient_name?: string; queue_type?: string } | null;
        source?: string;
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        toast.error(payload.error || 'Failed to call next interleaved patient');
        return;
      }
      if (!payload.nextPatient) {
        toast.info(payload.message || 'No arrived patients are ready to call.');
        return;
      }
      toast.success(
        `Called ${payload.nextPatient.patient_name} (${payload.nextPatient.queue_type === 'walk_in' ? 'walk-in' : payload.source || 'appointment'})`,
      );
      await loadPlatformData(hospitalInfo.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to call next patient';
      toast.error(message);
    } finally {
      setAdvancingTokenId(null);
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

  const handleAddFormularyItemSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmittingFormulary) return;
    if (!supabase) {
      toast.error('Database is not configured.');
      return;
    }

    const itemName = medForm.name.trim();
    if (!itemName) {
      toast.error('Item name is required');
      return;
    }

    const category = medForm.category.trim() || 'Medicine';
    const stock = Number(medForm.stock) || 0;
    const duplicate = pharmacyItems.some(
      (item) => formularyMatchKey(item) === formularyMatchKey({ item_name: itemName, category }),
    );
    if (duplicate) {
      toast.error(`${itemName} is already in the formulary`);
      return;
    }

    setIsSubmittingFormulary(true);

    try {
      const activeHospital = hospitalInfo.id || HOSPITAL_TENANT_ID;
      const status = stock > 0 ? 'In Stock' : 'Out of Stock';

      let { error } = await supabase
        .from('hospital_pharmacy_inventory')
        .insert([{ hospital_id: activeHospital, item_name: itemName, category, stock, status }])
        .select();

      if (error) {
        const fallback = await supabase
          .from('inventory_items')
          .insert([
            {
              hospital_id: activeHospital,
              item_name: itemName,
              name: itemName,
              category,
              quantity_in_stock: stock,
              status,
            },
          ])
          .select();
        error = fallback.error;
      }

      if (error) throw error;

      toast.success(`${itemName} added to formulary!`);
      setMedForm({ name: '', category: 'Medicine', stock: 100 });
      setActiveModal(null);
      await loadPharmacyData();
    } catch (err: unknown) {
      console.error('Failed to add formulary item:', err);
      toast.error(err instanceof Error ? err.message : 'Could not save inventory item');
    } finally {
      setIsSubmittingFormulary(false);
    }
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

  const handleCollectPayment = async (invoiceId: string, paymentMethod: 'cash' | 'upi' | 'card') => {
    if (!supabase || isProcessingPayment) return;
    setIsProcessingPayment(true);
    setSettlingInvoiceId(invoiceId);
    try {
      const result = await clearConsultationInvoice(supabase, invoiceId, paymentMethod);
      if (!result.ok) throw new Error(result.error || 'Payment settlement failed.');

      toast.success(`Payment of invoice cleared via ${paymentMethod.toUpperCase()}!`);
      await loadBillingInvoices();
      await loadPlatformData(hospitalInfo.id);
    } catch (err: unknown) {
      console.error('Payment collection error:', err);
      toast.error(err instanceof Error ? err.message : 'Payment settlement failed.');
    } finally {
      setIsProcessingPayment(false);
      setSettlingInvoiceId(null);
    }
  };

  const handleCreateInvoiceSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmittingInvoice) return;
    if (!supabase) {
      toast.error('Database is not configured.');
      return;
    }

    const patientName = invPatientName.trim();
    if (!patientName) {
      toast.error('Patient name is required');
      return;
    }

    setIsSubmittingInvoice(true);
    try {
      const validMedicines = invMedicines.filter((med) => med.name.trim() !== '');
      const consultationFee = Number(invConsultationFee) || 500;
      const result = await createPendingConsultationInvoice(supabase, {
        hospitalId: hospitalInfo.id || HOSPITAL_TENANT_ID,
        uhid: invUhid.trim() || `UHID-${Date.now().toString().slice(-6)}`,
        patientName,
        doctorName: invDoctorName.trim() || 'Duty doctor',
        consultationFee,
        medicines: validMedicines,
      });

      if (!result.ok) throw new Error(result.error || 'Could not save invoice');

      toast.success(`Invoice for ${patientName} routed to the checkout queue.`);
      setInvPatientName('');
      setInvUhid('');
      setInvDoctorName('');
      setInvConsultationFee(500);
      setInvMedicines([{ name: '', qty: 1, price: 0 }]);
      setShowAddInvoiceModal(false);
      await loadBillingInvoices();
    } catch (err: unknown) {
      console.error('Failed to create invoice:', err);
      toast.error(err instanceof Error ? err.message : 'Could not save invoice');
    } finally {
      setIsSubmittingInvoice(false);
    }
  };

  const handleEmergencySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmittingEmergency) return;
    if (!supabase) {
      toast.error('Database is not configured.');
      return;
    }

    const patientInfo = emPatientInfo.trim();
    if (!patientInfo) {
      toast.error('Patient / trauma details are required');
      return;
    }

    setIsSubmittingEmergency(true);
    try {
      const payload: Record<string, unknown> = {
        hospital_id: hospitalInfo.id || HOSPITAL_TENANT_ID,
        patient_info: patientInfo,
        patient_name: patientInfo,
        severity: emSeverity,
        arrival: emArrival,
        status: 'active',
      };

      let { error } = await supabase.from('emergency_alerts').insert([payload]).select();
      let attempts = 0;
      while (error && attempts < 6) {
        const column = missingInsertColumn(error.message);
        if (!column || !(column in payload)) break;
        delete payload[column];
        attempts += 1;
        const retry = await supabase.from('emergency_alerts').insert([payload]).select();
        error = retry.error;
      }

      if (error) throw error;

      toast.error('🚨 CODE RED INITIATED', { duration: 6000 });
      setEmPatientInfo('');
      setEmSeverity('code_red');
      setEmArrival('Ambulance');
      setShowEmergencyModal(false);
      await loadEmergencyData();
    } catch (err: unknown) {
      console.error('Failed to dispatch emergency:', err);
      toast.error(err instanceof Error ? err.message : 'Could not sound the alarm');
    } finally {
      setIsSubmittingEmergency(false);
    }
  };

  const handleResolveEmergency = async (id: string) => {
    if (!supabase || !id) return;
    try {
      const { error } = await supabase
        .from('emergency_alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Emergency marked resolved');
      await loadEmergencyData();
    } catch (err: unknown) {
      console.error('Failed to resolve emergency:', err);
      toast.error(err instanceof Error ? err.message : 'Could not resolve alert');
    }
  };

  const handleProvisionVendorSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isProvisioningVendor) return;
    if (!supabase) {
      toast.error('Database is not configured.');
      return;
    }

    const company = vendorCompany.trim();
    const email = vendorEmail.trim().toLowerCase();
    const passcode = vendorPasscode.trim();
    if (!company || !email || !passcode) {
      toast.error('Please complete all vendor credentials');
      return;
    }

    setIsProvisioningVendor(true);
    try {
      const activeHospital = hospitalInfo.id || HOSPITAL_TENANT_ID;
      const payload: Record<string, unknown> = {
        hospital_id: activeHospital,
        company_name: company,
        vendor_name: company,
        vendor_email: email,
        email,
        rep_email: email,
        category: vendorCategory,
        passcode,
        status: 'active',
      };

      let { error } = await supabase.from('hospital_vendors').insert([payload]);
      let attempts = 0;
      while (error && attempts < 8) {
        const column = missingInsertColumn(error.message);
        if (!column || !(column in payload)) break;
        delete payload[column];
        attempts += 1;
        const retry = await supabase.from('hospital_vendors').insert([payload]);
        error = retry.error;
      }

      if (error) throw error;

      toast.success(`Access successfully provisioned for ${company}!`);
      setVendorCompany('');
      setVendorEmail('');
      setVendorPasscode('');
      setVendorCategory('Pharmaceuticals');
      await loadVendors();
    } catch (err: unknown) {
      console.error('Vendor provisioning error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to provision vendor account');
    } finally {
      setIsProvisioningVendor(false);
    }
  };

  const handleToggleVendorStatus = async (vendorId: string, currentStatus: string) => {
    if (!supabase || !vendorId) return;
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      const { error } = await supabase
        .from('hospital_vendors')
        .update({ status: nextStatus })
        .eq('id', vendorId);

      if (error) throw error;
      toast.info(`Vendor marked as ${nextStatus}`);
      await loadVendors();
    } catch (err: unknown) {
      console.error('Status update failed:', err);
      toast.error('Failed to change vendor status');
    }
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
  const canProvisionStaff = currentUserRole === 'Admin';
  const occupiedBeds = beds.filter((b) => /occup/i.test(b.status)).length;
  const occupancyRate = beds.length > 0 ? Math.round((occupiedBeds / beds.length) * 100) : 0;
  const pendingCheckout = pendingInvoices;
  const collectedTotal = invoices
    .filter((inv) => inv.status === 'paid' || /paid|settled/i.test(inv.status))
    .reduce((sum, inv) => sum + inv.amount, 0);
  const pendingCheckoutTotal = invoices
    .filter((inv) => /pending|unpaid|unbilled/i.test(inv.status))
    .reduce((sum, inv) => sum + inv.amount, 0);
  const openBillsCount = invoices.filter((inv) => /pending|unpaid|unbilled/i.test(inv.status)).length;
  const totalCollections = collectedTotal;
  const outstanding = pendingCheckoutTotal;
  const invoiceMedicinesTotal = invMedicines.reduce(
    (sum, med) => sum + (med.name.trim() ? Number(med.qty) * Number(med.price) : 0),
    0,
  );
  const invoiceGrandTotal = Number(invConsultationFee) + invoiceMedicinesTotal;

  const waitingCount = opdQueue.filter((q) => triageStage(q.status) === 'Waiting').length;
  const inConsultCount = opdQueue.filter((q) => triageStage(q.status) === 'In Consultation').length;
  const waitingMinutes = opdQueue
    .filter((q) => triageStage(q.status) === 'Waiting')
    .map((q) => waitMinutes(q.created_at))
    .filter((mins): mins is number => mins != null);
  const avgWaitLabel = waitingMinutes.length === 0
    ? '—'
    : `~${Math.round(waitingMinutes.reduce((sum, mins) => sum + mins, 0) / waitingMinutes.length)}m`;

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
    { id: 'smartq', label: 'SmartQ OPD', icon: ListOrdered, badge: opdQueue.length },
    { id: 'patients', label: 'Patients', icon: Users, badge: patientRegistry.length },
    { id: 'ipd', label: 'IPD & Bed Census', icon: BedDouble, badge: beds.length },
    { id: 'pharmacy', label: 'Records & Pharmacy', icon: ClipboardCheck, badge: pharmacyItems.length },
    { id: 'emergency', label: 'Emergency Desk', icon: AlertTriangle, badge: activeEmergencies.length },
    { id: 'billing', label: 'Billing & Checkout', icon: IndianRupee, badge: pendingCheckout.length },
    { id: 'supply', label: 'Supply & Orders', icon: PackageCheck, badge: supplyOrders.length + vendorsList.length },
    { id: 'staff', label: 'Doctors & Staff', icon: HeartHandshake, badge: staffMembers.length },
  ];

  const sidebar = (
    <>
      <div className="p-5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center shrink-0 aspect-square overflow-hidden">
            <img
              src="/regal-logo-transparent.png"
              alt="Regal Hospital Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white leading-tight tracking-wide">
              {hospitalInfo.name || 'Regal Hospital'}
            </h2>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {hospitalInfo.id || HOSPITAL_TENANT_ID}
              </span>
              <span className="text-[10px] text-slate-400">Bengaluru</span>
            </div>
          </div>
        </div>
      </div>
      <div className="p-5 overflow-y-auto flex-1">
        <nav className="space-y-1">
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
            {canProvisionStaff && (
              <button type="button" onClick={() => router.push('/dashboard/staff-credentials')} className="px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Provision Staff
              </button>
            )}
            <button type="button" onClick={() => void loadPlatformData(hospitalInfo.id)} className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50">
              <RefreshCw className={`w-4 h-4 text-cyan-600 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          {onlineBookingAlert && (
            <div className="flex items-start justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 shadow-xs">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-white border border-violet-200 text-violet-700 shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-wider text-violet-700">
                    New Patient App booking
                  </div>
                  <p className="text-sm font-bold text-slate-900 mt-0.5 truncate">
                    {onlineBookingAlert.name}
                    <span className="font-semibold text-slate-600">
                      {' '}
                      · {onlineBookingAlert.department}
                      {onlineBookingAlert.token ? ` · ${onlineBookingAlert.token}` : ''}
                    </span>
                  </p>
                  <p className="text-[11px] text-violet-800/80 mt-0.5">
                    Added to the SmartQ OPD triage stream. Open SmartQ to call the patient.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('smartq');
                    setOnlineBookingAlert(null);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-violet-700 hover:bg-violet-600 text-white text-[11px] font-bold cursor-pointer"
                >
                  Open SmartQ
                </button>
                <button
                  type="button"
                  onClick={() => setOnlineBookingAlert(null)}
                  className="p-1.5 rounded-lg text-violet-500 hover:text-violet-800 hover:bg-violet-100 cursor-pointer"
                  aria-label="Dismiss booking alert"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

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
                            <td className="py-2.5 px-3">
                              <div className="font-mono font-bold text-cyan-800">{q.token}</div>
                              <div className="mt-1">
                                <QueueChannelBadge channel={q.channel} />
                              </div>
                            </td>
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
                    {activeEmergencies.length === 0 ? (
                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                        <div className="font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Node {hospitalInfo.id} Ready
                        </div>
                        <p className="text-[11px] text-emerald-700 mt-1">No active red alerts for this hospital node.</p>
                      </div>
                    ) : (
                      activeEmergencies.slice(0, 3).map((alert) => (
                        <div key={alert.id} className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-xs">
                          <div className="font-bold text-rose-800">{alert.patient_info} · {severityLabel(alert.severity)}</div>
                          <p className="text-rose-700">{alert.arrival}</p>
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCallNextInterleaved()}
                    disabled={advancingTokenId === 'interleave'}
                    className="px-4 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <ListOrdered className="w-4 h-4" />
                    <span>{advancingTokenId === 'interleave' ? 'Calling…' : 'Call Next (Interleaved)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModal('opd')}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Issue Walk-In Token</span>
                  </button>
                </div>
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
                          <th className="py-3 px-4">Source</th>
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
                            <tr key={`${item.source_table}-${item.id}`} className={`hover:bg-cyan-50/40 transition ${item.channel === 'online' ? 'bg-violet-50/25' : 'bg-emerald-50/20'}`}>
                              <td className="py-3.5 px-4 font-mono font-black text-cyan-800">{item.token}</td>
                              <td className="py-3.5 px-4">
                                <QueueChannelBadge channel={item.channel} />
                              </td>
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
            <RecordsPharmacyCommandCenter
              hospitalId={hospitalInfo.id || HOSPITAL_TENANT_ID}
              hospitalName={hospitalInfo.name || 'Regal Hospital'}
              onInventoryChanged={() => void loadPharmacyData()}
            />
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Billing &amp; Checkout Command Center</h3>
                  <p className="text-xs text-slate-500">
                    Live invoices from Doctor Workspace · Node {hospitalInfo.id || HOSPITAL_TENANT_ID}
                  </p>
                </div>
                <button type="button" onClick={() => setShowAddInvoiceModal(true)} className="px-3.5 py-2 rounded-xl bg-cyan-700 text-white text-xs font-bold flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add Invoice
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="bg-white rounded-2xl p-5 border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-400 uppercase font-mono">Collected</div>
                  <div className="text-3xl font-black mt-2">{inr(collectedTotal)}</div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-amber-200 bg-amber-50/40">
                  <div className="text-[11px] font-bold text-amber-700 uppercase font-mono">Pending checkout</div>
                  <div className="text-3xl font-black mt-2 text-amber-900">{inr(pendingCheckoutTotal)}</div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-400 uppercase font-mono">Open bills</div>
                  <div className="text-3xl font-black mt-2">{openBillsCount}</div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {invoices.length === 0 ? (
                  <div className="p-6">
                    <EmptyState icon={IndianRupee} title="Checkout queue is empty" body="Itemized bills appear here when a doctor completes a consultation or a cashier posts a direct invoice." actionLabel="+ Add Invoice" onAction={() => setShowAddInvoiceModal(true)} />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase">
                        <tr>
                          <th className="py-3 px-4">UHID / Bill ID</th>
                          <th className="py-3 px-4">Patient Name</th>
                          <th className="py-3 px-4">Doctor Name</th>
                          <th className="py-3 px-4">Consultation Fee</th>
                          <th className="py-3 px-4">Prescribed Medicines</th>
                          <th className="py-3 px-4">Total Amount</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Collect Payment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {invoices.map((inv) => {
                          const pending = /pending|unpaid|unbilled/i.test(inv.status);
                          return (
                            <tr key={inv.id} className="align-top">
                              <td className="py-3.5 px-4 font-mono font-bold text-cyan-800">{inv.uhid || inv.id.slice(0, 8)}</td>
                              <td className="py-3.5 px-4 font-bold text-slate-900">{inv.patient_name}</td>
                              <td className="py-3.5 px-4">{inv.doctor_name || 'Duty doctor'}</td>
                              <td className="py-3.5 px-4 font-mono">{inr(inv.consultation_fee ?? 0)}</td>
                              <td className="py-3.5 px-4">
                                {(inv.medicines ?? []).length === 0 ? (
                                  <span className="text-slate-400">—</span>
                                ) : (
                                  <ul className="space-y-1">
                                    {(inv.medicines ?? []).map((med) => (
                                      <li key={`${inv.id}-${med.name}`} className="text-slate-600">
                                        {med.name} × {med.qty} @ {inr(med.price)} = <span className="font-mono font-bold">{inr(med.qty * med.price)}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </td>
                              <td className="py-3.5 px-4 font-black text-emerald-700">{inr(inv.amount)}</td>
                              <td className="py-3.5 px-4">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${pending ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                                  {pending ? 'Pending' : 'Paid'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                {pending ? (
                                  <div className="inline-flex flex-wrap justify-end gap-1.5">
                                    <button
                                      type="button"
                                      disabled={isProcessingPayment}
                                      onClick={() => void handleCollectPayment(inv.id, 'upi')}
                                      className="px-2.5 py-1.5 rounded-lg bg-cyan-700 text-white text-[10px] font-bold uppercase disabled:opacity-50"
                                    >
                                      UPI
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isProcessingPayment}
                                      onClick={() => void handleCollectPayment(inv.id, 'cash')}
                                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-bold uppercase disabled:opacity-50"
                                    >
                                      Cash
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {inv.paid_at ? formatEncounter(inv.paid_at) : 'Cleared'}
                                    {inv.payment_method ? ` · ${inv.payment_method}` : ''}
                                  </span>
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

          {activeTab === 'supply' && (
            <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Vendor Access Control</h3>
                  <p className="text-xs text-slate-500">Provision portal credentials for Node {hospitalInfo.id || HOSPITAL_TENANT_ID}.</p>
                </div>
              </div>
              <form onSubmit={(event) => void handleProvisionVendorSubmit(event)} className="grid gap-3 md:grid-cols-2">
                <input
                  required
                  disabled={isProvisioningVendor}
                  value={vendorCompany}
                  onChange={(e) => setVendorCompany(e.target.value)}
                  placeholder="Company name"
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs disabled:opacity-60"
                />
                <input
                  required
                  type="email"
                  disabled={isProvisioningVendor}
                  value={vendorEmail}
                  onChange={(e) => setVendorEmail(e.target.value)}
                  placeholder="Vendor email"
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs disabled:opacity-60"
                />
                <select
                  disabled={isProvisioningVendor}
                  value={vendorCategory}
                  onChange={(e) => setVendorCategory(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs disabled:opacity-60"
                >
                  <option>Pharmaceuticals</option>
                  <option>Surgical Implants</option>
                  <option>Diagnostic Consumables</option>
                  <option>Biomedical Equipment</option>
                </select>
                <input
                  required
                  disabled={isProvisioningVendor}
                  value={vendorPasscode}
                  onChange={(e) => setVendorPasscode(e.target.value)}
                  placeholder="Vendor passcode"
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={isProvisioningVendor}
                  className="md:col-span-2 rounded-xl bg-orange-600 hover:bg-orange-500 py-3 text-xs font-bold text-white uppercase disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isProvisioningVendor ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Provisioning…
                    </>
                  ) : (
                    'Provision Vendor Portal Access'
                  )}
                </button>
              </form>
              {vendorsList.length === 0 ? (
                <p className="text-xs text-slate-400">No vendor accounts provisioned for this node yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Company</th>
                        <th className="py-2.5 px-3">Email</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Access</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vendorsList.map((vendor) => (
                        <tr key={vendor.id}>
                          <td className="py-3 px-3 font-bold text-slate-900">{vendor.company_name}</td>
                          <td className="py-3 px-3 font-mono">{vendor.vendor_email}</td>
                          <td className="py-3 px-3">{vendor.category}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${vendor.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                              {vendor.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => void handleToggleVendorStatus(vendor.id, vendor.status)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold uppercase"
                            >
                              {vendor.status === 'active' ? 'Suspend' : 'Reactivate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
                {canProvisionStaff && (
                  <button type="button" onClick={() => router.push('/dashboard/staff-credentials')} className="px-4 py-2 rounded-xl bg-cyan-700 text-white text-xs font-bold flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add Staff Credential
                  </button>
                )}
              </div>
              {currentUserRole !== 'Admin' ? (
                <div className="p-10 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
                  <div className="p-3 bg-cyan-50 text-cyan-700 rounded-full w-fit mx-auto border border-cyan-200">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold">Credential Keyring Restricted</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Logged in as {currentUserRole}. Staff provisioning and passcode keys are available only to Hospital Administrators.
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
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Emergency Desk Command</h3>
                  <p className="text-xs text-slate-500">Trauma triage for {hospitalInfo.name} · Node {hospitalInfo.id || HOSPITAL_TENANT_ID}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEmergencyModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wide flex items-center gap-2 shadow-lg shadow-rose-600/30"
                >
                  <Siren className="w-4 h-4 animate-pulse" />
                  Activate Emergency
                </button>
              </div>
              {activeEmergencies.length === 0 ? (
                <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  No active red alerts currently dispatched for {hospitalInfo.id || HOSPITAL_TENANT_ID}. Triage desk is on standby.
                </div>
              ) : (
                <div className="grid gap-3">
                  {activeEmergencies.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-5 rounded-2xl border ${isCodeRed(alert.severity) ? 'border-rose-300 bg-rose-50' : 'border-amber-300 bg-amber-50'}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${isCodeRed(alert.severity) ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'}`}>
                              {severityLabel(alert.severity)}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-white border border-slate-200 text-slate-700">
                              {alert.arrival}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              Dispatched {formatWait(alert.created_at)} ago
                            </span>
                          </div>
                          <div className="text-lg font-black text-slate-900 leading-tight">{alert.patient_info}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleResolveEmergency(alert.id)}
                          className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold uppercase"
                        >
                          Mark Resolved
                        </button>
                      </div>
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

            <form onSubmit={handleIssueTokenSubmit} className="space-y-4 text-xs">
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
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmittingFormulary}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeModal === 'pharmacy' && (
              <form onSubmit={(event) => void handleAddFormularyItemSubmit(event)} className="space-y-3 text-xs">
                <input
                  required
                  disabled={isSubmittingFormulary}
                  value={medForm.name}
                  onChange={(e) => setMedForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Medicine name"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl disabled:opacity-60"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    disabled={isSubmittingFormulary}
                    value={medForm.category}
                    onChange={(e) => setMedForm((p) => ({ ...p, category: e.target.value }))}
                    placeholder="Category"
                    className="px-3 py-2.5 border border-slate-200 rounded-xl disabled:opacity-60"
                  />
                  <input
                    type="number"
                    min={0}
                    disabled={isSubmittingFormulary}
                    value={medForm.stock}
                    onChange={(e) => setMedForm((p) => ({ ...p, stock: Number(e.target.value) }))}
                    className="px-3 py-2.5 border border-slate-200 rounded-xl font-mono disabled:opacity-60"
                  />
                </div>
                <div className="flex justify-end items-center gap-3 mt-6 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={isSubmittingFormulary}
                    onClick={closeModal}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingFormulary}
                    className="px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmittingFormulary ? (
                      <>
                        <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Saving Item...</span>
                      </>
                    ) : (
                      '+ Add to Formulary'
                    )}
                  </button>
                </div>
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

      {showEmergencyModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={(event) => void handleEmergencySubmit(event)}
            className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden"
          >
            <div className="bg-rose-600 px-5 py-4 text-white">
              <h3 className="text-base font-black">Log Emergency Alert</h3>
              <p className="text-[11px] text-rose-100 mt-0.5">Dispatch a Code Red / Code Yellow to the trauma desk.</p>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <label className="block font-bold text-slate-700 uppercase">
                Patient / trauma details
                <input
                  required
                  disabled={isSubmittingEmergency}
                  value={emPatientInfo}
                  onChange={(e) => setEmPatientInfo(e.target.value)}
                  placeholder="35 M - Multi-vehicle trauma"
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium normal-case"
                />
              </label>
              <label className="block font-bold text-slate-700 uppercase">
                Severity
                <select
                  disabled={isSubmittingEmergency}
                  value={emSeverity}
                  onChange={(e) => setEmSeverity(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium normal-case"
                >
                  <option value="code_red">Critical (Code Red)</option>
                  <option value="code_yellow">Urgent (Code Yellow)</option>
                </select>
              </label>
              <label className="block font-bold text-slate-700 uppercase">
                Arrival mode
                <select
                  disabled={isSubmittingEmergency}
                  value={emArrival}
                  onChange={(e) => setEmArrival(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium normal-case"
                >
                  <option value="Ambulance">Ambulance</option>
                  <option value="Walk-In">Walk-In</option>
                  <option value="Police Drop">Police Drop</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end items-center gap-3 px-5 py-4 border-t border-slate-100">
              <button
                type="button"
                disabled={isSubmittingEmergency}
                onClick={() => setShowEmergencyModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingEmergency}
                className="px-5 py-2 text-xs font-black rounded-lg bg-rose-600 hover:bg-rose-500 text-white uppercase flex items-center gap-2 disabled:opacity-60"
              >
                {isSubmittingEmergency ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Sounding…
                  </>
                ) : (
                  <>
                    <Siren className="w-3.5 h-3.5" />
                    Sound Alarm
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {showAddInvoiceModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={(event) => void handleCreateInvoiceSubmit(event)}
            className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">Direct Billing &amp; Pharmacy Invoice</h3>
              <p className="text-[11px] text-slate-500">Route an itemized bill to the hospital checkout desk.</p>
            </div>
            <div className="p-5 space-y-3 text-xs max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <label className="block font-bold text-slate-700 uppercase">
                  Patient full name
                  <input
                    required
                    disabled={isSubmittingInvoice}
                    value={invPatientName}
                    onChange={(e) => setInvPatientName(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium normal-case"
                  />
                </label>
                <label className="block font-bold text-slate-700 uppercase">
                  UHID / Token
                  <input
                    disabled={isSubmittingInvoice}
                    value={invUhid}
                    onChange={(e) => setInvUhid(e.target.value)}
                    placeholder="NX-WLK-001"
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium normal-case"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block font-bold text-slate-700 uppercase">
                  Attending doctor
                  <input
                    disabled={isSubmittingInvoice}
                    value={invDoctorName}
                    onChange={(e) => setInvDoctorName(e.target.value)}
                    placeholder="Dr. Suriraju V"
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl font-medium normal-case"
                  />
                </label>
                <label className="block font-bold text-slate-700 uppercase">
                  Consultation fee
                  <input
                    type="number"
                    min={0}
                    disabled={isSubmittingInvoice}
                    value={invConsultationFee}
                    onChange={(e) => setInvConsultationFee(Number(e.target.value) || 0)}
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl font-mono"
                  />
                </label>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 uppercase">Prescribed medicines</span>
                  <button
                    type="button"
                    disabled={isSubmittingInvoice}
                    onClick={() => setInvMedicines((prev) => [...prev, { name: '', qty: 1, price: 0 }])}
                    className="text-[11px] font-bold text-cyan-800"
                  >
                    + Add Medicine
                  </button>
                </div>
                {invMedicines.map((med, index) => (
                  <div key={`inv-med-${index}`} className="grid grid-cols-12 gap-2">
                    <input
                      disabled={isSubmittingInvoice}
                      value={med.name}
                      onChange={(e) =>
                        setInvMedicines((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, name: e.target.value } : row)),
                        )
                      }
                      placeholder="Medicine name"
                      className="col-span-6 px-3 py-2 border border-slate-200 rounded-xl"
                    />
                    <input
                      type="number"
                      min={1}
                      disabled={isSubmittingInvoice}
                      value={med.qty}
                      onChange={(e) =>
                        setInvMedicines((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, qty: Number(e.target.value) || 0 } : row)),
                        )
                      }
                      className="col-span-2 px-2 py-2 border border-slate-200 rounded-xl font-mono"
                    />
                    <input
                      type="number"
                      min={0}
                      disabled={isSubmittingInvoice}
                      value={med.price}
                      onChange={(e) =>
                        setInvMedicines((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, price: Number(e.target.value) || 0 } : row)),
                        )
                      }
                      className="col-span-3 px-2 py-2 border border-slate-200 rounded-xl font-mono"
                    />
                    <button
                      type="button"
                      disabled={isSubmittingInvoice || invMedicines.length === 1}
                      onClick={() => setInvMedicines((prev) => prev.filter((_, i) => i !== index))}
                      className="col-span-1 text-rose-500 disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 flex justify-between text-xs font-black text-emerald-900">
                <span>Grand Total Payable</span>
                <span className="font-mono">{inr(invoiceGrandTotal)}</span>
              </div>
            </div>
            <div className="flex justify-end items-center gap-3 px-5 py-4 border-t border-slate-100">
              <button
                type="button"
                disabled={isSubmittingInvoice}
                onClick={() => setShowAddInvoiceModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingInvoice}
                className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 disabled:opacity-60"
              >
                {isSubmittingInvoice ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save & Route to Queue'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
