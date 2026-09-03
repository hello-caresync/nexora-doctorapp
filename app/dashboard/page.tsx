'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  BedDouble,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  HeartHandshake,
  IndianRupee,
  LayoutGrid,
  ListOrdered,
  Loader2,
  LogOut,
  Menu,
  PackageCheck,
  Pill,
  Plus,
  RefreshCw,
  ShieldCheck,
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

type QueueRow = {
  id: string;
  token: string;
  patient_name: string;
  department: string;
  phone: string;
  doctor_name: string;
  status: string;
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
  const [pharmacyItems, setPharmacyItems] = useState<PharmacyRow[]>([]);
  const [beds, setBeds] = useState<BedRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [supplyOrders, setSupplyOrders] = useState<SupplyRow[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyRow[]>([]);

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

      const queueSource = [...aptRows, ...opdRows, ...patientAptRows];
      const seenQueueIds = new Set<string>();
      setOpdQueue(
        queueSource.flatMap((row) => {
          const id = String(row.id ?? row.token_number ?? row.uhid ?? '');
          if (!id || seenQueueIds.has(id)) return [];
          seenQueueIds.add(id);
          return [{
            id,
            token: String(row.token_number ?? row.uhid ?? row.token ?? row.id ?? ''),
            patient_name: String(row.patient_name ?? row.name ?? ''),
            department: String(row.department ?? 'OPD'),
            phone: String(row.phone ?? row.patient_phone ?? ''),
            doctor_name: String(row.doctor_name ?? ''),
            status: String(row.status ?? row.queue_status ?? 'Waiting'),
          }];
        }),
      );

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

  const closeModal = () => setActiveModal(null);

  const handleIssueToken = async (event: React.FormEvent) => {
    event.preventDefault();
    const patientName = opdForm.patientName.trim();
    if (!patientName) return;
    const tokenNum = `NX-OPD-${Math.floor(1000 + Math.random() * 9000)}`;
    const doctorName = staffMembers.find((s) => s.staff_type === 'Doctor')?.full_name || 'Duty Medical Officer';
    const error = await insertFirst([
      {
        table: 'hospital_opd_queue',
        payload: {
          hospital_id: hospitalInfo.id,
          hospital_name: hospitalInfo.name,
          token_number: tokenNum,
          uhid: tokenNum,
          patient_name: patientName,
          phone: opdForm.phone.trim() || null,
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
          phone: opdForm.phone.trim() || null,
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

  const navLinks: Array<{ id: NavModule; label: string; icon: typeof LayoutGrid; badge?: number }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'smartq', label: 'SmartQ OPD', icon: ListOrdered, badge: opdQueue.length },
    { id: 'patients', label: 'Patients', icon: Users, badge: opdQueue.length },
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

          {(activeTab === 'smartq' || activeTab === 'patients') && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Patient Registry &amp; SmartQ Queue</h3>
                  <p className="text-xs text-slate-500">UHID records from Patient App bookings and walk-in OPD, scoped to {hospitalInfo.id}.</p>
                </div>
                <button type="button" onClick={() => setActiveModal('opd')} className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Issue Token
                </button>
              </div>
              {opdQueue.length === 0 ? (
                <EmptyState icon={Users} title="No Patient Records Found" body={`Waiting for live bookings scoped strictly to ${hospitalInfo.name} (${hospitalInfo.id}).`} actionLabel="Issue First Token" onAction={() => setActiveModal('opd')} />
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase">
                    <tr>
                      <th className="py-3 px-4">UHID / Token</th>
                      <th className="py-3 px-4">Patient</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {opdQueue.map((p) => (
                      <tr key={p.id}>
                        <td className="py-3.5 px-4 font-mono font-bold text-cyan-800">{p.token}</td>
                        <td className="py-3.5 px-4 font-bold">{p.patient_name}</td>
                        <td className="py-3.5 px-4">{p.department}</td>
                        <td className="py-3.5 px-4 font-mono">{p.phone || '—'}</td>
                        <td className="py-3.5 px-4 text-right">{p.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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

      {activeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {activeModal === 'opd' && 'Issue Walk-In OPD Token'}
                {activeModal === 'pharmacy' && 'Add Medicine to Formulary'}
                {activeModal === 'bed' && 'Register Ward Bed'}
                {activeModal === 'invoice' && 'Post Cashier Invoice'}
                {activeModal === 'supply' && 'Create Purchase Order'}
              </h3>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeModal === 'opd' && (
              <form onSubmit={handleIssueToken} className="space-y-3 text-xs">
                <input required value={opdForm.patientName} onChange={(e) => setOpdForm((p) => ({ ...p, patientName: e.target.value }))} placeholder="Patient full name" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                <input value={opdForm.department} onChange={(e) => setOpdForm((p) => ({ ...p, department: e.target.value }))} placeholder="Department" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                <input value={opdForm.phone} onChange={(e) => setOpdForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone (optional)" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl" />
                <button type="submit" className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold uppercase">Create Token</button>
              </form>
            )}

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
