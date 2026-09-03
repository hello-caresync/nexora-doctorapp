'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  BedDouble,
  Building2,
  Clock,
  ExternalLink,
  Loader2,
  LogOut,
  Menu,
  Phone,
  Pill,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { isHospitalSetupCompleted } from '@/lib/auth/admin-setup';
import {
  CURASYNC_ACTIVE_SESSION_KEY,
  clearActiveSession,
  parseActiveSession,
} from '@/lib/auth/active-session';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

type OpsTab = 'opd' | 'doctors' | 'beds' | 'pharmacy' | 'vendors';

type HospitalInfo = {
  id: string;
  name: string;
  city: string;
  adminName: string;
  adminEmail: string;
};

type StaffMember = {
  id: string;
  full_name: string;
  staff_type: string;
  department: string;
  email: string;
  status?: string;
};

type TriageItem = {
  id: string;
  token: string;
  patient_name: string;
  department: string;
  assigned_doctor: string;
  status: string;
  time: string;
};

type BedRecord = {
  id: string;
  ward: string;
  bed_number: string;
  status: string;
  patient_name: string;
  doctor: string;
};

type PharmacyItem = {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  status: string;
};

type VendorRecord = {
  id: string;
  name: string;
  category: string;
  contact: string;
  status: string;
  orders: number;
};

const FALLBACK_BEDS: BedRecord[] = [
  { id: 'BED-101', ward: 'ICU', bed_number: '01', status: 'Occupied', patient_name: 'Rahul K', doctor: 'Dr. Suriraju V' },
  { id: 'BED-102', ward: 'ICU', bed_number: '02', status: 'Available', patient_name: '-', doctor: '-' },
  { id: 'BED-201', ward: 'General Ward A', bed_number: '01', status: 'Occupied', patient_name: 'Priya Sharma', doctor: 'Dr. Ananya R' },
  { id: 'BED-202', ward: 'General Ward A', bed_number: '02', status: 'Available', patient_name: '-', doctor: '-' },
  { id: 'BED-203', ward: 'General Ward A', bed_number: '03', status: 'Available', patient_name: '-', doctor: '-' },
  { id: 'BED-301', ward: 'Post-Op Recovery', bed_number: '01', status: 'Cleaning', patient_name: '-', doctor: '-' },
];

const FALLBACK_PHARMACY: PharmacyItem[] = [
  { id: 'MED-01', name: 'Paracetamol 650mg', category: 'Antipyretic', stock: 450, unit: 'Tablets', status: 'In Stock' },
  { id: 'MED-02', name: 'Amoxicillin 500mg', category: 'Antibiotic', stock: 120, unit: 'Capsules', status: 'In Stock' },
  { id: 'MED-03', name: 'Pantoprazole 40mg', category: 'Antacid', stock: 35, unit: 'Tablets', status: 'Low Stock' },
  { id: 'MED-04', name: 'Normal Saline 500ml', category: 'IV Fluid', stock: 85, unit: 'Bottles', status: 'In Stock' },
];

const FALLBACK_VENDORS: VendorRecord[] = [
  { id: 'VEND-01', name: 'MedLife Pharmaceuticals', category: 'Pharma Medicines', contact: '+91 98451 22334', status: 'Active Supplier', orders: 18 },
  { id: 'VEND-02', name: 'Apex Biomedical Surgicals', category: 'Surgical Equipment', contact: '+91 98452 33445', status: 'Active Supplier', orders: 6 },
  { id: 'VEND-03', name: 'Reliance Diagnostics', category: 'Lab & Pathology', contact: '+91 98453 44556', status: 'Verified', orders: 12 },
];

const DEPARTMENTS = [
  'All',
  'General Medicine',
  'Hospital Administration',
  'Pharmacy',
  'Reception',
  'Nursing',
  'Pediatrics',
  'Neurology',
  'Cardiology',
  'Orthopedics',
  'ENT',
];

function belongsToHospital(row: Record<string, unknown>, hospitalId: string, hospitalName: string): boolean {
  const rowHospitalId = String(row.hospital_id ?? '').trim();
  if (rowHospitalId && rowHospitalId === hospitalId) return true;
  const rowHospitalName = String(row.hospital_name ?? '').trim().toLowerCase();
  const targetName = hospitalName.trim().toLowerCase();
  if (rowHospitalName && targetName && rowHospitalName.includes(targetName)) return true;
  return !rowHospitalId && !rowHospitalName;
}

function mapAppointmentToTriage(row: Record<string, unknown>): TriageItem | null {
  const id = String(row.id ?? row.appointment_id ?? '');
  if (!id) return null;

  const rawStatus = String(row.status ?? row.queue_status ?? 'Waiting in Triage');
  if (/completed|done|cancelled/i.test(rawStatus)) return null;

  const tokenRaw = row.token ?? row.token_number ?? row.token_label ?? row.queue_number ?? '';
  const createdAt = String(row.created_at ?? row.appointment_time ?? '');

  return {
    id,
    token: tokenRaw ? String(tokenRaw) : `OPD-${id.slice(0, 4).toUpperCase()}`,
    patient_name: String(row.patient_name ?? row.name ?? '—'),
    department: String(row.department ?? 'General Medicine'),
    assigned_doctor: String(row.assigned_doctor ?? row.doctor_name ?? row.doctor ?? 'Unassigned'),
    status: rawStatus || 'Waiting in Triage',
    time: createdAt
      ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : String(row.time ?? '—'),
  };
}

function mapBed(row: Record<string, unknown>, index: number): BedRecord {
  const statusRaw = String(row.status ?? 'Available');
  const status = /occup/i.test(statusRaw)
    ? 'Occupied'
    : /clean/i.test(statusRaw)
      ? 'Cleaning'
      : /avail|free|vacant/i.test(statusRaw)
        ? 'Available'
        : statusRaw;
  return {
    id: String(row.id ?? `BED-${index + 1}`),
    ward: String(row.ward ?? row.ward_name ?? row.ward_type ?? 'General Ward'),
    bed_number: String(row.bed_number ?? row.number ?? String(index + 1).padStart(2, '0')),
    status,
    patient_name: String(row.patient_name ?? row.occupant ?? '-'),
    doctor: String(row.doctor ?? row.attending_doctor ?? row.doctor_name ?? '-'),
  };
}

function mapPharmacy(row: Record<string, unknown>, index: number): PharmacyItem {
  const stock = Number(row.stock ?? row.quantity ?? row.on_hand ?? 0);
  return {
    id: String(row.id ?? row.sku ?? `MED-${String(index + 1).padStart(2, '0')}`),
    name: String(row.name ?? row.medicine_name ?? row.item_name ?? 'Unnamed item'),
    category: String(row.category ?? row.therapeutic_class ?? 'General'),
    stock,
    unit: String(row.unit ?? row.uom ?? 'Units'),
    status: stock > 0 && stock < 50 ? 'Low Stock' : stock > 0 ? 'In Stock' : 'Out of Stock',
  };
}

function mapVendor(row: Record<string, unknown>, index: number): VendorRecord {
  return {
    id: String(row.id ?? `VEND-${String(index + 1).padStart(2, '0')}`),
    name: String(row.name ?? row.vendor_name ?? row.company_name ?? 'Vendor'),
    category: String(row.category ?? 'General'),
    contact: String(row.contact ?? row.phone ?? row.rep_email ?? row.email ?? '—'),
    status: String(row.status ?? 'Active Supplier'),
    orders: Number(row.orders ?? row.order_count ?? 0),
  };
}

const navButtonClass = (active: boolean) =>
  `w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
    active ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
  }`;

export default function HospitalMasterDashboard() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<OpsTab>('opd');
  const [activeDepartment, setActiveDepartment] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifyingGuard, setIsVerifyingGuard] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [walkInName, setWalkInName] = useState('');

  const [hospitalInfo, setHospitalInfo] = useState<HospitalInfo>({
    id: '',
    name: '',
    city: 'Bengaluru',
    adminName: '',
    adminEmail: '',
  });

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [triageQueue, setTriageQueue] = useState<TriageItem[]>([]);
  const [bedList, setBedList] = useState<BedRecord[]>(FALLBACK_BEDS);
  const [pharmacyItems, setPharmacyItems] = useState<PharmacyItem[]>(FALLBACK_PHARMACY);
  const [vendorList, setVendorList] = useState<VendorRecord[]>(FALLBACK_VENDORS);

  const loadDashboardData = useCallback(async () => {
    if (!hospitalInfo.id) return;

    setIsLoading(true);
    try {
      if (!supabase) return;

      const [staffRes, apptRes, legacyApptRes, bedsRes, pharmacyRes, vendorRes] = await Promise.all([
        supabase
          .from('hospital_staff_credentials')
          .select('*')
          .eq('hospital_id', hospitalInfo.id)
          .order('created_at', { ascending: false }),
        supabase.from('appointments').select('*').order('created_at', { ascending: false }),
        supabase.from('patient_appointments').select('*').order('created_at', { ascending: false }),
        supabase.from('hospital_beds').select('*').eq('hospital_id', hospitalInfo.id),
        supabase.from('pharmacy_inventory').select('*').eq('hospital_id', hospitalInfo.id),
        supabase.from('hospital_vendors').select('*').eq('hospital_id', hospitalInfo.id),
      ]);

      if (!staffRes.error && staffRes.data) {
        setStaffList(staffRes.data as StaffMember[]);
      }

      const appointmentRows = [
        ...((apptRes.data || []) as Record<string, unknown>[]),
        ...((legacyApptRes.data || []) as Record<string, unknown>[]),
      ].filter((row) => belongsToHospital(row, hospitalInfo.id, hospitalInfo.name));

      const queueMap = new Map<string, TriageItem>();
      appointmentRows.forEach((row) => {
        const mapped = mapAppointmentToTriage(row);
        if (mapped && !queueMap.has(mapped.id)) queueMap.set(mapped.id, mapped);
      });
      setTriageQueue(Array.from(queueMap.values()));

      if (!bedsRes.error && bedsRes.data && bedsRes.data.length > 0) {
        setBedList(bedsRes.data.map((row, index) => mapBed(row as Record<string, unknown>, index)));
      }

      if (!pharmacyRes.error && pharmacyRes.data && pharmacyRes.data.length > 0) {
        setPharmacyItems(pharmacyRes.data.map((row, index) => mapPharmacy(row as Record<string, unknown>, index)));
      }

      if (!vendorRes.error && vendorRes.data && vendorRes.data.length > 0) {
        setVendorList(vendorRes.data.map((row, index) => mapVendor(row as Record<string, unknown>, index)));
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  }, [hospitalInfo.id, hospitalInfo.name]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const session =
      parseActiveSession(localStorage.getItem(CURASYNC_ACTIVE_SESSION_KEY)) ||
      parseActiveSession(localStorage.getItem('curasync_admin_session'));

    if (!session?.hospital_id || session.staff_type !== 'Admin') {
      router.replace('/admin/login');
      return;
    }

    void (async () => {
      const completed = await isHospitalSetupCompleted(session.hospital_id);
      if (!completed) {
        router.replace(`/dashboard/staff-credentials?hospitalId=${encodeURIComponent(session.hospital_id)}`);
        return;
      }

      setHospitalInfo({
        id: session.hospital_id,
        name: session.hospital_name || 'Regal Hospital',
        city: 'Bengaluru',
        adminName: session.full_name || 'Hospital Administrator',
        adminEmail: session.email,
      });
      setIsVerifyingGuard(false);
    })();
  }, [router]);

  useEffect(() => {
    if (isVerifyingGuard || !hospitalInfo.id) return;
    void loadDashboardData();
  }, [isVerifyingGuard, hospitalInfo.id, loadDashboardData]);

  const handleIssueToken = async (event: React.FormEvent) => {
    event.preventDefault();
    const patientName = walkInName.trim();
    if (!patientName) return;

    const tokenNumber = `OPD-${Math.floor(100 + Math.random() * 900)}`;
    const department = activeDepartment === 'All' ? 'General Medicine' : activeDepartment;
    const assignedDoctor =
      staffList.find((staff) => staff.staff_type === 'Doctor')?.full_name || 'Chief Medical Officer';
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newEntry: TriageItem = {
      id: tokenNumber,
      token: tokenNumber,
      patient_name: patientName,
      department,
      assigned_doctor: assignedDoctor,
      status: 'Waiting in Triage',
      time,
    };

    setTriageQueue((prev) => [newEntry, ...prev]);
    setWalkInName('');
    setShowTokenModal(false);
    toast.success(`Walk-in Token ${tokenNumber} issued successfully!`);

    if (supabase && hospitalInfo.id) {
      const payload = {
        hospital_id: hospitalInfo.id,
        hospital_name: hospitalInfo.name,
        patient_name: patientName,
        department,
        doctor_name: assignedDoctor,
        assigned_doctor: assignedDoctor,
        token_number: tokenNumber,
        token: tokenNumber,
        status: 'WAITING',
        queue_status: 'WAITING',
        source: 'hospital_dashboard_walkin',
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('appointments').insert([payload]);
      if (error) {
        await supabase.from('patient_appointments').insert([payload]);
      }
    }
  };

  const handleLogout = () => {
    clearActiveSession();
    router.push('/admin/login');
  };

  const doctorCount = staffList.filter((staff) => staff.staff_type === 'Doctor').length;
  const occupiedBeds = bedList.filter((bed) => bed.status === 'Occupied').length;
  const occupancyRate = bedList.length === 0 ? 0 : Math.round((occupiedBeds / bedList.length) * 100);

  const filteredQueue = useMemo(() => {
    return triageQueue.filter((item) => {
      const matchesDept = activeDepartment === 'All' || item.department === activeDepartment;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        item.patient_name.toLowerCase().includes(query) ||
        item.token.toLowerCase().includes(query) ||
        item.assigned_doctor.toLowerCase().includes(query);
      return matchesDept && matchesSearch;
    });
  }, [triageQueue, activeDepartment, searchQuery]);

  const filteredDoctors = useMemo(() => {
    return staffList.filter((staff) => {
      if (staff.staff_type !== 'Doctor') return false;
      return activeDepartment === 'All' || staff.department === activeDepartment;
    });
  }, [staffList, activeDepartment]);

  const openModule = (tab: OpsTab) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
  };

  const sidebar = (
    <>
      <div className="p-5 space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-5">
          <div className="p-2 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/30">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-widest">
              {hospitalInfo.id}
            </div>
            <h1 className="text-sm font-black text-white leading-tight truncate max-w-[140px]">
              {hospitalInfo.name}
            </h1>
            <p className="text-[10px] text-slate-400">{hospitalInfo.city}</p>
          </div>
        </div>

        <nav className="space-y-1">
          <div className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider px-3 pb-2">
            Clinical Modules
          </div>

          <button type="button" onClick={() => openModule('opd')} className={navButtonClass(activeTab === 'opd')}>
            <div className="flex items-center gap-2.5">
              <Activity className="w-4 h-4" />
              <span>Live OPD &amp; Triage</span>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-900/60 text-blue-200">
              {triageQueue.length}
            </span>
          </button>

          <button type="button" onClick={() => openModule('doctors')} className={navButtonClass(activeTab === 'doctors')}>
            <div className="flex items-center gap-2.5">
              <Stethoscope className="w-4 h-4" />
              <span>Doctor Schedules</span>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
              {doctorCount}
            </span>
          </button>

          <button type="button" onClick={() => openModule('beds')} className={navButtonClass(activeTab === 'beds')}>
            <div className="flex items-center gap-2.5">
              <BedDouble className="w-4 h-4" />
              <span>Wards &amp; Bed Alloc</span>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
              {occupancyRate}%
            </span>
          </button>

          <button type="button" onClick={() => openModule('pharmacy')} className={navButtonClass(activeTab === 'pharmacy')}>
            <div className="flex items-center gap-2.5">
              <Pill className="w-4 h-4" />
              <span>Pharmacy Inventory</span>
            </div>
          </button>

          <button type="button" onClick={() => openModule('vendors')} className={navButtonClass(activeTab === 'vendors')}>
            <div className="flex items-center gap-2.5">
              <Truck className="w-4 h-4" />
              <span>Vendor Supply Chain</span>
            </div>
          </button>
        </nav>

        <div className="pt-4 border-t border-slate-800 space-y-2">
          <div className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider px-3">
            Linked Platform Apps
          </div>

          <button
            type="button"
            onClick={() => window.open('/doctor/login', '_blank')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Stethoscope className="w-3.5 h-3.5 text-blue-400" />
              <span>Doctor Workspace</span>
            </div>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </button>

          <button
            type="button"
            onClick={() => window.open('/patient/login', '_blank')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Patient Portal</span>
            </div>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </button>

          <button
            type="button"
            onClick={() => window.open('/vendor/login', '_blank')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Truck className="w-3.5 h-3.5 text-purple-400" />
              <span>Vendor Gateway</span>
            </div>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </button>

          <button
            type="button"
            onClick={() => router.push('/dashboard/staff-credentials')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Staff Vault</span>
            </div>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </button>
        </div>
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
        <div className="truncate">
          <div className="text-xs font-bold text-white truncate">{hospitalInfo.adminName}</div>
          <div className="text-[10px] text-slate-400 truncate">{hospitalInfo.adminEmail}</div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </>
  );

  if (isVerifyingGuard) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-xs font-semibold">Verifying hospital setup status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex font-sans select-none">
      <aside className="w-64 bg-slate-900 text-white flex-col justify-between shrink-0 border-r border-slate-800 hidden md:flex">
        {sidebar}
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-50 h-full w-64 bg-slate-900 text-white flex flex-col justify-between border-r border-slate-800">
            {sidebar}
          </aside>
        </div>
      )}

      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        <header className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-6 shadow-md shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-200"
                aria-label="Open modules"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-[10px] font-mono font-bold text-blue-300">
                <Building2 className="w-3 h-3" />
                <span>FACILITY NODE: {hospitalInfo.id}</span>
              </div>
            </div>
            <h2 className="text-2xl font-black tracking-tight">{hospitalInfo.name} Operations Command</h2>
            <p className="text-xs text-slate-400">
              Logged in: <strong className="text-white">{hospitalInfo.adminName}</strong> • Scoped strictly to your facility data.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowTokenModal(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Issue OPD Token</span>
            </button>

            <button
              type="button"
              onClick={() => router.push('/dashboard/staff-credentials')}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-600/30 transition cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Staff Vault</span>
            </button>

            <button
              type="button"
              onClick={() => void loadDashboardData()}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700"
              title="Sync Platform Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        <div className="p-6 pb-2 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">{staffList.length}</div>
              <div className="text-[11px] font-medium text-slate-500 uppercase">Total Provisioned Staff</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-indigo-700">{doctorCount}</div>
              <div className="text-[11px] font-medium text-slate-500 uppercase">Clinical Doctors</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-700">{triageQueue.length}</div>
              <div className="text-[11px] font-medium text-slate-500 uppercase">Live OPD Triage Active</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
              <BedDouble className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-purple-700">{occupancyRate}%</div>
              <div className="text-[11px] font-medium text-slate-500 uppercase">Bed Occupancy Rate</div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4 flex-1">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {DEPARTMENTS.map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => setActiveDepartment(dept)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeDepartment === dept
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>

          {activeTab === 'opd' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900">Live OPD Consultation &amp; Triage Queue</h3>
                  <p className="text-xs text-slate-500">Realtime outpatient queue synchronized with Doctor Workspace.</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search token or patient"
                      className="w-48 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-800"
                    />
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-600 px-3 py-1 rounded-full bg-blue-50 border border-blue-200">
                    {filteredQueue.length} Patients Waiting
                  </span>
                </div>
              </div>

              {filteredQueue.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 text-slate-400 space-y-2">
                  <Clock className="w-8 h-8 mx-auto text-slate-300" />
                  <div className="text-sm font-bold text-slate-600">No Patients in Triage Queue</div>
                  <p className="text-xs text-slate-400">
                    Issue a walk-in OPD token or wait for patient bookings scoped to {hospitalInfo.id}.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowTokenModal(true)}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    + Issue First Token
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                        <th className="py-3 px-4">Token #</th>
                        <th className="py-3 px-4">Patient Name</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4">Assigned Clinician</th>
                        <th className="py-3 px-4">Wait Time</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredQueue.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 font-mono font-black text-blue-700">{item.token}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{item.patient_name}</td>
                          <td className="py-3 px-4">{item.department}</td>
                          <td className="py-3 px-4 text-slate-600">{item.assigned_doctor}</td>
                          <td className="py-3 px-4 font-mono text-slate-400">{item.time}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'doctors' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Registered Facility Clinicians ({filteredDoctors.length})
                  </h3>
                  <p className="text-xs text-slate-500">Doctors verified to log in via the Doctor Portal.</p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/staff-credentials')}
                  className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Provision Clinician
                </button>
              </div>

              {filteredDoctors.length === 0 ? (
                <div className="p-10 text-center rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
                  No clinicians provisioned yet. Open Staff Vault to add doctors.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDoctors.map((doc) => (
                    <div key={doc.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-700">
                          {doc.id}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Available
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 text-sm">{doc.full_name}</div>
                      <div className="text-xs text-slate-500">{doc.department}</div>
                      <div className="text-[11px] font-mono text-slate-400 truncate">{doc.email}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'beds' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900">Ward Allocations &amp; Bed Registry</h3>
                <p className="text-xs text-slate-500">Live inpatient occupancy across General, ICU, and Post-Op wards.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {bedList.map((bed) => (
                  <div key={bed.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-slate-900">
                        {bed.ward} - Bed {bed.bed_number}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          bed.status === 'Occupied'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : bed.status === 'Cleaning'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {bed.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Patient: <strong className="text-slate-800">{bed.patient_name}</strong>
                    </div>
                    <div className="text-xs text-slate-500">
                      Attending: <strong className="text-slate-800">{bed.doctor}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'pharmacy' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900">Pharmacy Formulary &amp; Stock</h3>
                <p className="text-xs text-slate-500">Medication inventory synchronized with doctor e-prescriptions.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                      <th className="py-3 px-4">Item Code</th>
                      <th className="py-3 px-4">Medicine Name</th>
                      <th className="py-3 px-4">Therapeutic Category</th>
                      <th className="py-3 px-4">Current Stock</th>
                      <th className="py-3 px-4">Inventory Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pharmacyItems.map((med) => (
                      <tr key={med.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">{med.id}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{med.name}</td>
                        <td className="py-3 px-4 text-slate-500">{med.category}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {med.stock} {med.unit}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              med.status === 'Low Stock'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {med.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'vendors' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900">Procurement &amp; Vendor Partners</h3>
                <p className="text-xs text-slate-500">Connected pharmaceutical and biomedical logistics channels.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {vendorList.map((vendor) => (
                  <div key={vendor.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-purple-700">{vendor.id}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {vendor.status}
                      </span>
                    </div>
                    <div className="font-bold text-slate-900 text-sm">{vendor.name}</div>
                    <div className="text-xs text-slate-500">{vendor.category}</div>
                    <div className="text-xs text-slate-600 flex items-center gap-1 pt-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{vendor.contact}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <form
            onSubmit={handleIssueToken}
            className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 uppercase">Issue Walk-In OPD Token</h2>
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
            <p className="text-[11px] text-slate-500">
              Department: <strong>{activeDepartment === 'All' ? 'General Medicine' : activeDepartment}</strong>
            </p>
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider"
            >
              Confirm &amp; Issue Token
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
