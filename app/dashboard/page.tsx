'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  BedDouble,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  FlaskConical,
  HeartHandshake,
  IndianRupee,
  LayoutGrid,
  ListOrdered,
  Loader2,
  LogOut,
  Menu,
  MessageSquareQuote,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import {
  isHospitalAppRole,
  readHospitalAppSession,
} from '@/lib/auth/ecosystem-sessions';
import { isHospitalSetupCompleted } from '@/lib/auth/admin-setup';
import { clearActiveSession } from '@/lib/auth/active-session';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

type NavModule =
  | 'dashboard'
  | 'smartq'
  | 'patients'
  | 'ipd'
  | 'pharmacy'
  | 'labs'
  | 'emergency'
  | 'billing'
  | 'supply'
  | 'staff'
  | 'messages';

type HospitalInfo = {
  id: string;
  nodeCode: string;
  name: string;
  adminName: string;
  adminEmail: string;
};

type StaffMember = {
  id: string;
  full_name: string;
  staff_type: string;
  department: string;
  email: string;
  temporary_passcode?: string;
  portal_access?: string;
  status?: string;
};

type QueueItem = {
  id: string;
  token: string;
  patient_name: string;
  age: string;
  department: string;
  doctor_name: string;
  status: string;
  notes: string;
  time: string;
};

type PatientRecord = {
  id: string;
  name: string;
  uhid: string;
  phone: string;
  department: string;
  status: string;
};

type BedRecord = {
  id: string;
  ward: string;
  bed: string;
  status: string;
  patient: string;
  doc: string;
};

type PharmacyRecord = {
  id: string;
  name: string;
  category: string;
  stock: number;
  status: string;
};

type LabRecord = {
  id: string;
  patient_name: string;
  test: string;
  doctor_name: string;
  status: string;
  time: string;
};

type EmergencyRecord = {
  id: string;
  patient_name: string;
  complaint: string;
  priority: string;
  status: string;
  time: string;
};

type BillRecord = {
  id: string;
  invoice: string;
  patient_name: string;
  consultation: number;
  pharmacy: number;
  total: number;
  status: string;
};

type SupplyOrder = {
  id: string;
  vendor: string;
  item: string;
  amount: string;
  status: string;
  time: string;
};

type MessageRecord = {
  id: string;
  title: string;
  body: string;
  from: string;
  target: string;
  time: string;
};

const FALLBACK_OPD: QueueItem[] = [
  { id: 'A-101', token: 'A-101', patient_name: 'Ramesh Gowda', age: '48', department: 'General Medicine', doctor_name: 'Dr. Suriraju V', status: 'In Consultation', notes: '', time: '10:15 AM' },
  { id: 'A-102', token: 'A-102', patient_name: 'Meenakshi Sundaram', age: '34', department: 'Cardiology', doctor_name: 'Dr. Rajesh Sharma', status: 'Vitals Done', notes: '', time: '10:22 AM' },
  { id: 'A-103', token: 'A-103', patient_name: 'Praveen Kumar', age: '29', department: 'Orthopedics', doctor_name: 'Dr. Ananya S', status: 'Waiting', notes: '', time: '10:30 AM' },
  { id: 'A-104', token: 'A-104', patient_name: 'Sunita Devi', age: '52', department: 'Neurology', doctor_name: 'Dr. Suriraju V', status: 'Waiting', notes: '', time: '10:35 AM' },
  { id: 'A-105', token: 'A-105', patient_name: 'Mohammad Farooq', age: '41', department: 'General Medicine', doctor_name: 'Dr. Suriraju V', status: 'Triaged', notes: '', time: '10:40 AM' },
];

const FALLBACK_BEDS: BedRecord[] = [
  { id: 'ICU-01', ward: 'Intensive Care Unit', bed: '01', status: 'Occupied', patient: 'Kiran Kumar', doc: 'Dr. Suriraju V' },
  { id: 'ICU-02', ward: 'Intensive Care Unit', bed: '02', status: 'Available', patient: '-', doc: '-' },
  { id: 'GEN-01', ward: 'General Medical Ward', bed: '01', status: 'Occupied', patient: 'Meera Rao', doc: 'Dr. Ananya S' },
  { id: 'GEN-02', ward: 'General Medical Ward', bed: '02', status: 'Occupied', patient: 'Vijay Patil', doc: 'Dr. Suriraju V' },
  { id: 'GEN-03', ward: 'General Medical Ward', bed: '03', status: 'Available', patient: '-', doc: '-' },
];

const FALLBACK_SUPPLY: SupplyOrder[] = [
  { id: 'ORD-8821', vendor: 'MedLife Pharma', item: 'Surgical Gloves & Syringes', amount: '₹42,500', status: 'Dispatched', time: '10 mins ago' },
  { id: 'ORD-8822', vendor: 'Apex Biomedical', item: 'Pulse Oximeter Probes (x20)', amount: '₹18,200', status: 'In Transit', time: '1 hr ago' },
  { id: 'ORD-8823', vendor: 'Reliance Labs', item: 'Biochemical Reagent Kits', amount: '₹76,000', status: 'Delivered', time: 'Today, 9:30 AM' },
];

const REALTIME_TABLES = [
  'hospital_staff_credentials',
  'appointments',
  'patient_appointments',
  'opd_queue',
  'opd_queues',
  'patients',
  'hospital_beds',
  'inventory_items',
  'prescriptions',
  'clinical_notes',
  'emergency_triages',
  'bills',
  'billing_invoices',
  'purchase_orders',
  'hospital_procurement_orders',
  'vendor_orders',
  'system_notifications',
  'channel_messages',
];

function inr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function relativeTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diff = Date.now() - date.getTime();
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return date.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
}

function nodeCodeFor(hospitalId: string): string {
  if (!hospitalId || hospitalId === 'HOSP-01') return 'RH-BLR-01';
  return hospitalId.replace('HOSP-', 'RH-');
}

function matchesHospital(row: Record<string, unknown>, hospitalId: string, hospitalName: string): boolean {
  const rowId = String(row.hospital_id ?? '').trim();
  if (rowId && rowId === hospitalId) return true;
  const rowName = String(row.hospital_name ?? '').trim().toLowerCase();
  if (rowName && hospitalName && rowName.includes(hospitalName.toLowerCase())) return true;
  const code = String(row.facility_code ?? row.hospital_code ?? '').trim();
  if (code && (code === 'RH-BLR-01' || code === hospitalId) && (hospitalId === 'HOSP-01' || hospitalName.toLowerCase().includes('regal'))) {
    return true;
  }
  return !rowId && !rowName && !code;
}

async function selectRows(table: string): Promise<Record<string, unknown>[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as Record<string, unknown>[];
}

function mapQueue(row: Record<string, unknown>): QueueItem {
  const id = String(row.id ?? row.appointment_id ?? crypto.randomUUID());
  const token = String(row.token_number ?? row.token ?? row.queue_number ?? `OPD-${id.slice(0, 4).toUpperCase()}`);
  return {
    id,
    token,
    patient_name: String(row.patient_name ?? row.name ?? '—'),
    age: String(row.age ?? '—'),
    department: String(row.department ?? 'General Medicine'),
    doctor_name: String(row.doctor_name ?? row.assigned_doctor ?? 'Unassigned'),
    status: String(row.status ?? row.queue_status ?? 'Waiting'),
    notes: String(row.chief_complaint ?? row.clinical_advice ?? row.diagnosis ?? row.reason_for_visit ?? ''),
    time: relativeTime(String(row.updated_at ?? row.created_at ?? row.slot_time ?? '')),
  };
}

export default function RegalHospitalApp() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<NavModule>('dashboard');
  const [currentUserRole, setCurrentUserRole] = useState<string>('Staff');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [walkInName, setWalkInName] = useState('');
  const [showTokenModal, setShowTokenModal] = useState(false);

  const [hospitalInfo, setHospitalInfo] = useState<HospitalInfo>({
    id: '',
    nodeCode: 'RH-BLR-01',
    name: 'Regal Hospital',
    adminName: '',
    adminEmail: '',
  });

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [opdQueue, setOpdQueue] = useState<QueueItem[]>(FALLBACK_OPD);
  const [patientRegistry, setPatientRegistry] = useState<PatientRecord[]>([]);
  const [bedCensus, setBedCensus] = useState<BedRecord[]>(FALLBACK_BEDS);
  const [pharmacyItems, setPharmacyItems] = useState<PharmacyRecord[]>([]);
  const [labOrders, setLabOrders] = useState<LabRecord[]>([]);
  const [emergencyDesk, setEmergencyDesk] = useState<EmergencyRecord[]>([]);
  const [bills, setBills] = useState<BillRecord[]>([]);
  const [supplyOrders, setSupplyOrders] = useState<SupplyOrder[]>(FALLBACK_SUPPLY);
  const [messages, setMessages] = useState<MessageRecord[]>([]);

  const loadPlatformData = useCallback(async (node?: HospitalInfo) => {
    const hospital = node ?? hospitalInfo;
    if (!hospital.id || !supabase) return;
    setIsLoading(true);

    try {
      const [
        staffRows,
        appointmentRows,
        legacyApptRows,
        queueRows,
        queueAltRows,
        patientRows,
        bedRows,
        inventoryRows,
        rxRows,
        noteRows,
        emergencyRows,
        billRows,
        invoiceRows,
        poRows,
        procurementRows,
        vendorOrderRows,
        notificationRows,
        channelRows,
      ] = await Promise.all([
        selectRows('hospital_staff_credentials'),
        selectRows('appointments'),
        selectRows('patient_appointments'),
        selectRows('opd_queue'),
        selectRows('opd_queues'),
        selectRows('patients'),
        supabase.from('hospital_beds').select('*').then((res) => (res.error || !res.data ? [] : (res.data as Record<string, unknown>[]))),
        selectRows('inventory_items'),
        selectRows('prescriptions'),
        selectRows('clinical_notes'),
        selectRows('emergency_triages'),
        selectRows('bills'),
        selectRows('billing_invoices'),
        selectRows('purchase_orders'),
        selectRows('hospital_procurement_orders'),
        selectRows('vendor_orders'),
        selectRows('system_notifications'),
        selectRows('channel_messages'),
      ]);

      const scopedStaff = staffRows.filter((row) => matchesHospital(row, hospital.id, hospital.name));
      setStaffMembers(
        scopedStaff.map((row) => ({
          id: String(row.id ?? ''),
          full_name: String(row.full_name ?? ''),
          staff_type: String(row.staff_type ?? ''),
          department: String(row.department ?? ''),
          email: String(row.email ?? ''),
          temporary_passcode: String(row.temporary_passcode ?? row.passcode ?? ''),
          portal_access: String(row.portal_access ?? ''),
          status: String(row.status ?? 'Active'),
        })),
      );

      const queueMap = new Map<string, QueueItem>();
      [...appointmentRows, ...legacyApptRows, ...queueRows, ...queueAltRows]
        .filter((row) => matchesHospital(row, hospital.id, hospital.name))
        .forEach((row) => {
          const mapped = mapQueue(row);
          if (!queueMap.has(mapped.id)) queueMap.set(mapped.id, mapped);
        });
      const liveQueue = Array.from(queueMap.values());
      setOpdQueue(liveQueue.length > 0 ? liveQueue : FALLBACK_OPD);

      const patients = patientRows
        .filter((row) => matchesHospital(row, hospital.id, hospital.name))
        .map((row) => ({
          id: String(row.id ?? ''),
          name: String(row.full_name ?? row.name ?? row.patient_name ?? '—'),
          uhid: String(row.uhid ?? row.id ?? '—'),
          phone: String(row.phone ?? row.patient_phone ?? '—'),
          department: String(row.department ?? 'OPD'),
          status: String(row.status ?? row.admission_status ?? 'active'),
        }));
      if (patients.length > 0) {
        setPatientRegistry(patients);
      } else {
        const fromQueue = Array.from(queueMap.values()).map((item) => ({
          id: item.id,
          name: item.patient_name,
          uhid: item.token,
          phone: '—',
          department: item.department,
          status: item.status,
        }));
        setPatientRegistry(fromQueue);
      }

      if (bedRows.length > 0) {
        setBedCensus(
          bedRows.map((row, index) => ({
            id: String(row.id ?? `BED-${index + 1}`),
            ward: String(row.ward ?? row.ward_name ?? 'General Ward'),
            bed: String(row.bed_number ?? row.bed ?? String(index + 1).padStart(2, '0')),
            status: Boolean(row.is_occupied) || /occup/i.test(String(row.status ?? '')) ? 'Occupied' : 'Available',
            patient: String(row.patient_name ?? '-'),
            doc: String(row.doctor ?? row.doctor_name ?? '-'),
          })),
        );
      }

      if (inventoryRows.length > 0) {
        setPharmacyItems(
          inventoryRows.map((row) => {
            const stock = Number(row.quantity_in_stock ?? row.in_stock ?? row.stock ?? 0);
            const reorder = Number(row.reorder_level ?? 10);
            return {
              id: String(row.id ?? row.item_code ?? ''),
              name: String(row.item_name ?? row.name ?? 'Item'),
              category: String(row.category ?? 'Medicine'),
              stock,
              status: stock <= reorder ? 'Low Stock' : 'In Stock',
            };
          }),
        );
      } else if (rxRows.length > 0) {
        setPharmacyItems(
          rxRows.slice(0, 12).map((row) => ({
            id: String(row.id ?? ''),
            name: String(row.medication_name ?? row.patient_name ?? 'Prescription'),
            category: String(row.status ?? 'Rx'),
            stock: 1,
            status: String(row.status ?? 'Pending'),
          })),
        );
      }

      const labs = [...noteRows, ...rxRows]
        .filter((row) => matchesHospital(row, hospital.id, hospital.name) || !row.hospital_id)
        .map((row) => ({
          id: String(row.id ?? ''),
          patient_name: String(row.patient_name ?? '—'),
          test: String(row.diagnosis_disease ?? row.clinical_advice ?? row.prescription ?? 'Diagnostic review'),
          doctor_name: String(row.doctor_name ?? '—'),
          status: String(row.status ?? 'Reported'),
          time: relativeTime(String(row.created_at ?? '')),
        }));
      setLabOrders(labs.slice(0, 20));

      setEmergencyDesk(
        emergencyRows.map((row) => ({
          id: String(row.id ?? ''),
          patient_name: String(row.patient_name ?? '—'),
          complaint: String(row.chief_complaint ?? ''),
          priority: String(row.priority ?? 'P3'),
          status: String(row.status ?? 'active'),
          time: relativeTime(String(row.created_at ?? '')),
        })),
      );

      const billed = [...billRows, ...invoiceRows]
        .filter((row) => matchesHospital(row, hospital.id, hospital.name))
        .map((row) => {
          const consultation = Number(row.consultation_fee ?? 0);
          const pharmacy = Number(row.pharmacy_charges ?? 0);
          const total = Number(row.total_amount ?? consultation + pharmacy);
          return {
            id: String(row.id ?? ''),
            invoice: String(row.invoice_number ?? row.id ?? 'INV'),
            patient_name: String(row.patient_name ?? '—'),
            consultation,
            pharmacy,
            total,
            status: String(row.status ?? row.payment_status ?? 'unpaid'),
          };
        });
      setBills(billed);

      const orders = [...poRows, ...procurementRows, ...vendorOrderRows]
        .filter((row) => matchesHospital(row, hospital.id, hospital.name))
        .map((row) => ({
          id: String(row.po_number ?? row.id ?? 'ORD'),
          vendor: String(row.vendor_name ?? row.vendor ?? 'Vendor'),
          item: String(row.item_details ?? row.item ?? row.items ?? 'Procurement lot'),
          amount: inr(Number(row.total_amount ?? row.amount ?? 0)),
          status: String(row.status ?? 'ISSUED'),
          time: relativeTime(String(row.updated_at ?? row.created_at ?? '')),
        }));
      if (orders.length > 0) setSupplyOrders(orders);

      const inbox = [...notificationRows, ...channelRows].map((row) => ({
        id: String(row.id ?? ''),
        title: String(row.title ?? row.subject ?? 'Ecosystem update'),
        body: String(row.message ?? row.body ?? row.message_text ?? ''),
        from: String(row.sender_role ?? row.sender_name ?? row.source_app ?? 'system'),
        target: String(row.target_app ?? row.recipient_type ?? 'hospital'),
        time: relativeTime(String(row.created_at ?? '')),
      }));
      setMessages(inbox.slice(0, 30));
    } catch (err) {
      console.error('Failed to sync hospital data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [hospitalInfo]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const session = readHospitalAppSession();
    const hospitalId = session?.hospital_id;
    const staffType = session?.staff_type || 'Staff';

    setCurrentUserRole(staffType);

    if (!hospitalId || !isHospitalAppRole(staffType)) {
      router.replace(staffType && staffType !== 'Admin' ? '/staff/login' : '/admin/login');
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
        name: session.hospital_name || 'Regal Hospital',
        adminName: session.full_name || 'Hospital User',
        adminEmail: session.email || '',
      });
      setIsVerifying(false);
    })();
  }, [router]);

  useEffect(() => {
    if (isVerifying || !hospitalInfo.id) return;
    void loadPlatformData(hospitalInfo);
  }, [isVerifying, hospitalInfo.id, loadPlatformData, hospitalInfo]);

  useEffect(() => {
    if (!supabase || isVerifying || !hospitalInfo.id) return;

    let channel = supabase.channel(`regal_hospital_os_${hospitalInfo.id}`);
    REALTIME_TABLES.forEach((table) => {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        void loadPlatformData(hospitalInfo);
      });
    });
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [hospitalInfo, isVerifying, loadPlatformData]);

  const waitingCount = opdQueue.filter((item) => /wait|schedul|check|token|triage/i.test(item.status)).length;
  const consultingCount = opdQueue.filter((item) => /consult|progress|exam/i.test(item.status)).length;
  const completedCount = opdQueue.filter((item) => /complete|done|discharg|prescrib/i.test(item.status)).length;
  const occupiedBeds = bedCensus.filter((bed) => bed.status === 'Occupied').length;
  const occupancyRate = bedCensus.length === 0 ? 0 : Math.round((occupiedBeds / bedCensus.length) * 100);
  const unpaidTotal = bills.filter((bill) => !/paid|settled/i.test(bill.status)).reduce((sum, bill) => sum + bill.total, 0);
  const collectedTotal = bills.reduce((sum, bill) => sum + bill.total, 0);
  const emergencyActive = emergencyDesk.filter((item) => !/closed|discharged|resolved/i.test(item.status)).length;

  const filteredStaff = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return staffMembers;
    return staffMembers.filter(
      (member) =>
        member.full_name.toLowerCase().includes(query) ||
        member.staff_type.toLowerCase().includes(query) ||
        member.department.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query),
    );
  }, [staffMembers, searchQuery]);

  const navLinks: Array<{
    id: NavModule;
    label: string;
    icon: typeof LayoutGrid;
    badge?: number;
    badgeColor?: string;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'smartq', label: 'SmartQ OPD', icon: ListOrdered, badge: opdQueue.length },
    { id: 'patients', label: 'Patients', icon: Users, badge: patientRegistry.length },
    { id: 'ipd', label: 'IPD & Bed Census', icon: BedDouble, badge: occupiedBeds },
    { id: 'pharmacy', label: 'Records & Pharmacy', icon: ClipboardCheck },
    { id: 'labs', label: 'Diagnostics & Labs', icon: FlaskConical },
    { id: 'emergency', label: 'Emergency Desk', icon: AlertTriangle, badge: emergencyActive, badgeColor: 'bg-rose-500' },
    { id: 'billing', label: 'Billing & Cashier', icon: IndianRupee },
    { id: 'supply', label: 'Supply & Orders', icon: PackageCheck, badge: supplyOrders.length },
    { id: 'staff', label: 'Doctors & Staff', icon: HeartHandshake, badge: staffMembers.length },
    { id: 'messages', label: 'Ecosystem Messages', icon: MessageSquareQuote, badge: messages.length },
  ];

  const openModule = (id: NavModule) => {
    setActiveTab(id);
    setMobileNavOpen(false);
  };

  const handleIssueToken = async (event: React.FormEvent) => {
    event.preventDefault();
    const patientName = walkInName.trim();
    if (!patientName || !supabase) return;

    const tokenNumber = `OPD-${Math.floor(100 + Math.random() * 900)}`;
    const doctor = staffMembers.find((member) => member.staff_type === 'Doctor');
    const payload = {
      hospital_id: hospitalInfo.id,
      hospital_name: hospitalInfo.name,
      patient_name: patientName,
      token_number: tokenNumber,
      department: 'General Medicine',
      doctor_name: doctor?.full_name || 'Chief Medical Officer',
      doctor_id: doctor?.id || 'UNASSIGNED',
      status: 'WAITING',
      queue_status: 'WAITING',
      source: 'hospital_dashboard_walkin',
      appointment_date: new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('appointments').insert([payload]);
    if (error) {
      await supabase.from('opd_queue').insert([payload]);
    }
    setWalkInName('');
    setShowTokenModal(false);
    toast.success(`Walk-in token ${tokenNumber} issued`);
    void loadPlatformData(hospitalInfo);
  };

  const handleLogout = () => {
    const role = currentUserRole;
    clearActiveSession();
    router.push(role === 'Admin' ? '/admin/login' : '/staff/login');
  };

  const sidebar = (
    <>
      <div className="p-5 overflow-y-auto">
        <div className="text-[11px] font-extrabold uppercase tracking-widest text-[#2dd4bf] font-mono">
          HOSPITAL APP
        </div>
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
                onClick={() => openModule(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#18537a] text-white shadow-md font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-[#0e3b5b]/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-300' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                      item.badgeColor && item.badge > 0
                        ? `${item.badgeColor} text-white`
                        : isActive
                          ? 'bg-cyan-400 text-slate-950'
                          : 'bg-[#144466] text-cyan-200'
                    }`}
                  >
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
        <button
          type="button"
          onClick={handleLogout}
          className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-[#0e3b5b] transition cursor-pointer"
          title="Log Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </>
  );

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-700" />
          <p className="text-xs font-semibold">Opening hospital command suite...</p>
        </div>
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
          <aside className="relative z-50 h-full w-64 bg-[#0a2e47] text-slate-200 flex flex-col justify-between shadow-2xl">
            {sidebar}
          </aside>
        </div>
      )}

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileNavOpen(true)} className="md:hidden p-2 rounded-xl border border-slate-200" aria-label="Open modules">
              <Menu className="w-4 h-4" />
            </button>
            <div className="p-2 rounded-xl bg-cyan-50 border border-cyan-200 text-[#0c314b]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 leading-tight">
                {navLinks.find((nav) => nav.id === activeTab)?.label} Command Center
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Active Node:{' '}
                <span className="font-mono text-cyan-800 font-bold">
                  {hospitalInfo.id} ({hospitalInfo.name})
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowTokenModal(true)}
              className="hidden sm:inline-flex px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Issue OPD Token
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard/staff-credentials')}
              className="px-3.5 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Provision Staff</span>
            </button>
            <button
              type="button"
              onClick={() => void loadPlatformData(hospitalInfo)}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer"
              title="Sync Platform State"
            >
              <RefreshCw className={`w-4 h-4 text-cyan-600 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-black text-slate-900">Facility Operations Snapshot</h3>
                <p className="text-xs text-slate-500">Live census across OPD, IPD, pharmacy, billing, and vendor supply.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <button type="button" onClick={() => openModule('smartq')} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs text-left hover:border-cyan-300 transition">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">LIVE OPD QUEUE</div>
                  <div className="text-3xl font-black text-slate-900 mt-2">{opdQueue.length}</div>
                  <div className="text-xs font-medium text-cyan-700 mt-1">{waitingCount} waiting in triage</div>
                </button>
                <button type="button" onClick={() => openModule('staff')} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs text-left hover:border-cyan-300 transition">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">PROVISIONED STAFF</div>
                  <div className="text-3xl font-black text-slate-900 mt-2">{staffMembers.length}</div>
                  <div className="text-xs font-medium text-cyan-700 mt-1">{staffMembers.filter((s) => s.staff_type === 'Doctor').length} doctors verified</div>
                </button>
                <button type="button" onClick={() => openModule('ipd')} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs text-left hover:border-cyan-300 transition">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">BED OCCUPANCY</div>
                  <div className="text-3xl font-black text-slate-900 mt-2">{occupancyRate}%</div>
                  <div className="text-xs font-medium text-cyan-700 mt-1">{occupiedBeds}/{bedCensus.length} occupied</div>
                </button>
                <button type="button" onClick={() => openModule('billing')} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs text-left hover:border-cyan-300 transition">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">COLLECTIONS (₹)</div>
                  <div className="text-3xl font-black text-slate-900 mt-2">{inr(collectedTotal)}</div>
                  <div className="text-xs font-medium text-emerald-600 mt-1">{inr(unpaidTotal)} outstanding today</div>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 space-y-6">
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-cyan-700" />
                        <h4 className="text-sm font-black text-slate-900">Live Outpatient Queue (SmartQ)</h4>
                      </div>
                      <button type="button" onClick={() => openModule('smartq')} className="text-[11px] font-mono font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-200">
                        Realtime Feed
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                            <th className="py-2.5 px-3">Token</th>
                            <th className="py-2.5 px-3">Patient</th>
                            <th className="py-2.5 px-3">Department</th>
                            <th className="py-2.5 px-3">Doctor</th>
                            <th className="py-2.5 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {opdQueue.slice(0, 8).map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50 transition">
                              <td className="py-3 px-3 font-mono font-black text-cyan-800">{item.token}</td>
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-900">{item.patient_name}</div>
                                <div className="text-[10px] text-slate-400">Age: {item.age} &bull; {item.time}</div>
                              </td>
                              <td className="py-3 px-3 text-slate-600">{item.department}</td>
                              <td className="py-3 px-3 text-slate-700 font-medium">{item.doctor_name}</td>
                              <td className="py-3 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    /consult/i.test(item.status)
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : /vital/i.test(item.status)
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  {item.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BedDouble className="w-4 h-4 text-cyan-700" />
                        <h4 className="text-sm font-black text-slate-900">Inpatient Ward &amp; Bed Census</h4>
                      </div>
                      <button type="button" onClick={() => openModule('ipd')} className="text-[11px] font-mono text-slate-400">
                        ICU &amp; General Units
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {bedCensus.map((bed) => (
                        <div key={bed.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                          <div>
                            <div className="text-xs font-bold text-slate-900">{bed.ward} &bull; Bed {bed.bed}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {bed.status === 'Occupied' ? `Patient: ${bed.patient}` : 'Ready for admission'}
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            bed.status === 'Occupied'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {bed.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <h4 className="text-sm font-black text-slate-900">Emergency &amp; Triage Alerts</h4>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        emergencyActive > 0
                          ? 'text-rose-700 bg-rose-50 border-rose-200'
                          : 'text-emerald-600 bg-emerald-50 border-emerald-200'
                      }`}>
                        {emergencyActive > 0 ? `${emergencyActive} Active` : 'Normal Flow'}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Duty Medical Officer Assigned</span>
                      </div>
                      <p className="text-[11px] text-blue-700">
                        Emergency Bay 1 and Trauma response are staffed. Real-time patient triage synchronized with Doctor Portal.
                      </p>
                    </div>
                    {emergencyDesk.slice(0, 3).map((alert) => (
                      <div key={alert.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{alert.patient_name}</span>
                          <span className="text-[10px] font-bold text-rose-700">{alert.priority}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1">{alert.complaint}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PackageCheck className="w-4 h-4 text-cyan-700" />
                        <h4 className="text-sm font-black text-slate-900">Vendor Supply Dispatches</h4>
                      </div>
                      <button type="button" onClick={() => openModule('supply')} className="text-[11px] font-bold text-cyan-700">
                        {supplyOrders.length} In-Transit
                      </button>
                    </div>
                    <div className="space-y-3">
                      {supplyOrders.slice(0, 4).map((order) => (
                        <div key={order.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs text-cyan-800">{order.id}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800">
                              {order.status}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-900">{order.item}</div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>{order.vendor}</span>
                            <span className="font-bold text-slate-700">{order.amount}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {pharmacyItems.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                        Pharmacy health: {pharmacyItems.filter((item) => item.status === 'Low Stock').length} low-stock SKUs of {pharmacyItems.length} tracked.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'smartq' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">SmartQ Outpatient Triage Registry</h3>
                <p className="text-xs text-slate-500">Live feed from Patient bookings and Doctor Workspace consultation status.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <div className="text-xs font-bold text-slate-400 uppercase">Waiting in Queue</div>
                  <div className="text-3xl font-black text-cyan-800 mt-1">{waitingCount || opdQueue.length}</div>
                  <div className="text-[11px] text-emerald-600 font-bold mt-1">Patient App bookings appear instantly</div>
                </div>
                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <div className="text-xs font-bold text-slate-400 uppercase">Consulting Now</div>
                  <div className="text-3xl font-black text-blue-700 mt-1">{consultingCount}</div>
                  <div className="text-[11px] text-blue-600 font-bold mt-1">Doctor Workspace in-progress notes</div>
                </div>
                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <div className="text-xs font-bold text-slate-400 uppercase">Completed Today</div>
                  <div className="text-3xl font-black text-slate-800 mt-1">{completedCount}</div>
                  <div className="text-[11px] text-slate-400 font-bold mt-1">Discharged or prescribed</div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                {opdQueue.length === 0 ? (
                  <div className="p-12 text-center text-sm text-slate-500">No live OPD tokens yet. Issue a walk-in or wait for Patient App bookings.</div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                      <tr>
                        <th className="py-3 px-4">Token</th>
                        <th className="py-3 px-4">Patient</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4">Clinician</th>
                        <th className="py-3 px-4">Notes</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {opdQueue.map((item) => (
                        <tr key={item.id} className="hover:bg-cyan-50/40">
                          <td className="py-3 px-4 font-mono font-black text-cyan-800">{item.token}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{item.patient_name}</td>
                          <td className="py-3 px-4">{item.department}</td>
                          <td className="py-3 px-4">{item.doctor_name}</td>
                          <td className="py-3 px-4 text-slate-500 max-w-[220px] truncate">{item.notes || '—'}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === 'patients' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Patient Registry</h3>
                <p className="text-xs text-slate-500">UHID records synchronized from Patient App bookings and walk-in OPD.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                    <tr>
                      <th className="py-3 px-4">UHID / Token</th>
                      <th className="py-3 px-4">Patient</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {patientRegistry.map((patient) => (
                      <tr key={patient.id}>
                        <td className="py-3 px-4 font-mono font-bold text-cyan-800">{patient.uhid}</td>
                        <td className="py-3 px-4 font-bold">{patient.name}</td>
                        <td className="py-3 px-4">{patient.department}</td>
                        <td className="py-3 px-4 font-mono">{patient.phone}</td>
                        <td className="py-3 px-4">{patient.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'ipd' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Ward &amp; Bed Allocation Census</h3>
                <p className="text-xs text-slate-500">Real-time occupancy for ICU and general wards.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {bedCensus.map((bed) => (
                  <div key={bed.id} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">
                        {bed.ward} ({bed.bed})
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          bed.status === 'Occupied'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {bed.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Patient: <strong className="text-slate-800">{bed.patient}</strong>
                    </div>
                    <div className="text-xs text-slate-500">
                      Consultant: <strong className="text-slate-800">{bed.doc}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'pharmacy' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Records &amp; Pharmacy Formulary</h3>
                <p className="text-xs text-slate-500">Inventory and e-prescriptions shared with Doctor Workspace.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                {pharmacyItems.length === 0 ? (
                  <div className="p-12 text-center text-sm text-slate-500">No inventory rows yet. Vendor receipts will populate this formulary.</div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                      <tr>
                        <th className="py-3 px-4">Item</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Stock</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pharmacyItems.map((item) => (
                        <tr key={item.id}>
                          <td className="py-3 px-4 font-bold">{item.name}</td>
                          <td className="py-3 px-4">{item.category}</td>
                          <td className="py-3 px-4 font-mono">{item.stock}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.status === 'Low Stock' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === 'labs' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Diagnostics &amp; Labs</h3>
                <p className="text-xs text-slate-500">Clinical notes and diagnostic orders from Doctor consultations.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                {labOrders.length === 0 ? (
                  <div className="p-12 text-center text-sm text-slate-500">No diagnostic notes yet. They appear when clinicians save consultation records.</div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                      <tr>
                        <th className="py-3 px-4">Patient</th>
                        <th className="py-3 px-4">Order / Finding</th>
                        <th className="py-3 px-4">Clinician</th>
                        <th className="py-3 px-4">Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {labOrders.map((lab) => (
                        <tr key={lab.id}>
                          <td className="py-3 px-4 font-bold">{lab.patient_name}</td>
                          <td className="py-3 px-4">{lab.test}</td>
                          <td className="py-3 px-4">{lab.doctor_name}</td>
                          <td className="py-3 px-4 font-mono text-slate-500">{lab.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === 'emergency' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Emergency Desk</h3>
                <p className="text-xs text-slate-500">P1–P3 triage board synchronized with Doctor emergency bypass.</p>
              </div>
              {emergencyDesk.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">
                  No active emergency triages.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {emergencyDesk.map((item) => (
                    <div key={item.id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-slate-900">{item.patient_name}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.priority === 'P1' ? 'bg-rose-100 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                          {item.priority}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{item.complaint}</p>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>{item.status}</span>
                        <span className="font-mono">{item.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Billing &amp; Cashier</h3>
                <p className="text-xs text-slate-500">Consultation invoices and pharmacy charges in INR, linked to OPD encounters.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 bg-white rounded-2xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-400 uppercase">Gross Collections</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">{inr(collectedTotal)}</div>
                </div>
                <div className="p-5 bg-white rounded-2xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-400 uppercase">Outstanding</div>
                  <div className="text-2xl font-black text-amber-700 mt-1">{inr(unpaidTotal)}</div>
                </div>
                <div className="p-5 bg-white rounded-2xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-400 uppercase">Invoices</div>
                  <div className="text-2xl font-black text-cyan-800 mt-1">{bills.length}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                {bills.length === 0 ? (
                  <div className="p-12 text-center text-sm text-slate-500">No invoices yet. They post when consultations complete.</div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                      <tr>
                        <th className="py-3 px-4">Invoice</th>
                        <th className="py-3 px-4">Patient</th>
                        <th className="py-3 px-4">Consult</th>
                        <th className="py-3 px-4">Pharmacy</th>
                        <th className="py-3 px-4">Total</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bills.map((bill) => (
                        <tr key={bill.id}>
                          <td className="py-3 px-4 font-mono font-bold text-cyan-800">{bill.invoice}</td>
                          <td className="py-3 px-4 font-bold">{bill.patient_name}</td>
                          <td className="py-3 px-4">{inr(bill.consultation)}</td>
                          <td className="py-3 px-4">{inr(bill.pharmacy)}</td>
                          <td className="py-3 px-4 font-black">{inr(bill.total)}</td>
                          <td className="py-3 px-4">{bill.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === 'supply' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Procurement &amp; Vendor Dispatch</h3>
                <p className="text-xs text-slate-500">Hospital purchase requests update when vendors acknowledge or fulfill in the Vendor Portal.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {supplyOrders.map((ord) => (
                  <div key={ord.id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-cyan-800">{ord.id}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                        {ord.status}
                      </span>
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{ord.item}</div>
                      <div className="text-xs text-slate-500">{ord.vendor}</div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-slate-800">{ord.amount}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{ord.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Hospital Staff Directory</h3>
                  <p className="text-xs text-slate-500">
                    Facility personnel, active rosters, and access clearances.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/staff-credentials')}
                  className="px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Staff Credential</span>
                </button>
              </div>

              {currentUserRole !== 'Admin' ? (
                <div className="p-10 bg-white rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
                  <div className="p-3 bg-cyan-50 text-cyan-700 rounded-full w-fit mx-auto border border-cyan-200">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Credential Keyring Restricted</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    You are currently logged in with <span className="font-semibold text-slate-700">{currentUserRole}</span> clearance.
                    You may provision new staff accounts, but existing security passcodes and master identifiers are restricted to Hospital Administrators.
                  </p>
                </div>
              ) : (
                <>
                  <div className="relative w-full sm:w-72 ml-auto">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search doctor, staff or department..."
                      className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-cyan-600"
                    />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          <tr>
                            <th className="py-3 px-4">Staff Member &amp; ID</th>
                            <th className="py-3 px-4">Department &amp; Role</th>
                            <th className="py-3 px-4">Login Email</th>
                            <th className="py-3 px-4">Passcode Key</th>
                            <th className="py-3 px-4">Workspace Target</th>
                            <th className="py-3 px-4 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredStaff.map((member) => (
                            <tr key={member.id} className="hover:bg-cyan-50/40 transition">
                              <td className="py-3.5 px-4">
                                <span className="font-mono text-[10px] font-bold text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200 mr-2">
                                  {member.id}
                                </span>
                                <span className="font-bold text-slate-900">{member.full_name}</span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-600">
                                <span className="font-semibold text-slate-800">{member.staff_type}</span>
                                <span className="text-slate-400 block text-[11px]">{member.department}</span>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-600">{member.email}</td>
                              <td className="py-3.5 px-4 font-mono font-bold text-cyan-800">
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1"
                                  onClick={() => {
                                    if (member.temporary_passcode) {
                                      void navigator.clipboard.writeText(member.temporary_passcode);
                                      toast.success('Passcode copied');
                                    }
                                  }}
                                >
                                  {member.temporary_passcode || '—'}
                                  <Copy className="w-3 h-3 text-slate-400" />
                                </button>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">{member.portal_access}</td>
                              <td className="py-3.5 px-4 text-right">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {member.status || 'Active'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Ecosystem Messages</h3>
                <p className="text-xs text-slate-500">Cross-app notifications from Doctor, Patient, and Vendor workspaces.</p>
              </div>
              {messages.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">
                  No ecosystem messages yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div key={message.id} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-sm font-black text-slate-900">{message.title}</h4>
                        <span className="text-[10px] font-mono text-slate-400">{message.time}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{message.body}</p>
                      <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-cyan-700">
                        {message.from} → {message.target}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <form onSubmit={handleIssueToken} className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase">Issue Walk-In OPD Token</h2>
              <button type="button" onClick={() => setShowTokenModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              required
              value={walkInName}
              onChange={(event) => setWalkInName(event.target.value)}
              placeholder="Patient full name"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
            <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase">
              Confirm &amp; Issue Token
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
