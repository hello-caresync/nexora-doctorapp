'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Hospital,
  Users,
  Stethoscope,
  Activity,
  Clock,
  UserPlus,
  RefreshCw,
  PlusCircle,
  Bed,
  Pill,
  Search,
  Loader2,
  X,
  Truck,
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { isHospitalSetupCompleted } from '@/lib/auth/admin-setup';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

type DashboardTab = 'queue' | 'doctors' | 'wards' | 'pharmacy' | 'vendors';

interface StaffMember {
  id: string;
  full_name: string;
  staff_type: string;
  department: string;
  status?: string;
  email: string;
  is_logged_in?: boolean;
}

interface PatientQueueItem {
  id: string;
  token_number: string;
  patient_name: string;
  age: number | string;
  gender: string;
  department: string;
  doctor_name: string;
  triage_level: 'Critical' | 'Urgent' | 'Standard';
  status: 'Waiting' | 'In Consultation' | 'Completed';
  wait_time_mins: number;
  time_checked_in: string;
  room?: string;
}

interface WardSnapshot {
  name: string;
  total: number;
  occupied: number;
  free: number;
}

interface PharmacyMetrics {
  pending: number;
  inProgress: number;
  fulfilled: number;
}

function normalizeQueueStatus(raw?: string): PatientQueueItem['status'] {
  const s = (raw || '').trim().toUpperCase();
  if (s.includes('CONSULT') || s === 'IN_PROGRESS') return 'In Consultation';
  if (s === 'COMPLETED' || s === 'DONE') return 'Completed';
  return 'Waiting';
}

function inferTriage(chiefComplaint?: string): PatientQueueItem['triage_level'] {
  const text = (chiefComplaint || '').toLowerCase();
  if (/chest pain|stroke|unconscious|severe bleeding|cardiac arrest/.test(text)) return 'Critical';
  if (/fever|injury|fracture|acute|emergency/.test(text)) return 'Urgent';
  return 'Standard';
}

function waitMinutesFromCreatedAt(createdAt?: string): number {
  if (!createdAt) return 0;
  const diff = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(diff / 60000));
}

function formatCheckInTime(createdAt?: string, fallback?: string): string {
  if (fallback) return fallback;
  if (!createdAt) return '—';
  return new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function mapAppointmentToQueue(row: Record<string, unknown>): PatientQueueItem | null {
  const id = String(row.id ?? row.appointment_id ?? '');
  if (!id) return null;

  const status = normalizeQueueStatus(
    String(row.status ?? row.queue_status ?? 'WAITING'),
  );
  if (status === 'Completed') return null;

  const tokenRaw = row.token_number ?? row.token_label ?? row.queue_number ?? '';
  const token_number = tokenRaw ? String(tokenRaw) : '—';
  const chief = String(row.chief_complaint ?? row.reason_for_visit ?? row.reason ?? '');

  return {
    id,
    token_number,
    patient_name: String(row.patient_name ?? row.name ?? '—'),
    age: (row.age as number | string) ?? '—',
    gender: String(row.gender ?? '—'),
    department: String(row.department ?? 'General'),
    doctor_name: String(row.doctor_name ?? '—'),
    triage_level: inferTriage(chief),
    status,
    wait_time_mins: waitMinutesFromCreatedAt(String(row.created_at ?? '')),
    time_checked_in: formatCheckInTime(
      String(row.created_at ?? ''),
      String(row.appointment_time ?? row.time_slot ?? row.slot_time ?? ''),
    ),
    room: String(row.room ?? row.consultation_room ?? ''),
  };
}

function belongsToHospital(row: Record<string, unknown>, hospitalId: string, hospitalName: string): boolean {
  const rowHospitalId = String(row.hospital_id ?? '').trim();
  if (rowHospitalId && rowHospitalId === hospitalId) return true;

  const rowHospitalName = String(row.hospital_name ?? '').trim().toLowerCase();
  const targetName = hospitalName.trim().toLowerCase();
  if (rowHospitalName && targetName && rowHospitalName.includes(targetName)) return true;

  return !rowHospitalId && !rowHospitalName;
}

export default function CompleteHospitalOperationsDashboard() {
  const router = useRouter();

  const [currentHospital, setCurrentHospital] = useState<{ id: string; name: string }>({
    id: '',
    name: '',
  });
  const [adminName, setAdminName] = useState('Administrator');
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [patientQueue, setPatientQueue] = useState<PatientQueueItem[]>([]);
  const [wardSnapshots, setWardSnapshots] = useState<WardSnapshot[]>([]);
  const [pharmacyMetrics, setPharmacyMetrics] = useState<PharmacyMetrics>({
    pending: 0,
    inProgress: 0,
    fulfilled: 0,
  });
  const [activeTab, setActiveTab] = useState<DashboardTab>('queue');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('All');
  const [isVerifyingGuard, setIsVerifyingGuard] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [isSubmittingToken, setIsSubmittingToken] = useState(false);
  const [tokenForm, setTokenForm] = useState({
    patientName: '',
    age: '',
    gender: 'Female',
    department: 'General Medicine',
    doctorId: '',
    doctorName: '',
    chiefComplaint: '',
  });
  const [vendorForm, setVendorForm] = useState({
    companyName: '',
    repEmail: '',
    category: 'Pharmaceuticals',
    passcode: '',
  });
  const [vendorMessage, setVendorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem('curasync_active_session');
    if (!stored) {
      router.replace('/admin/login');
      return;
    }

    void (async () => {
      try {
        const session = JSON.parse(stored) as {
          hospital_id?: string;
          hospital_name?: string;
          full_name?: string;
          staff_type?: string;
        };

        if (!session?.hospital_id || session.staff_type !== 'Admin') {
          router.replace('/admin/login');
          return;
        }

        const completed = await isHospitalSetupCompleted(session.hospital_id);
        if (!completed) {
          router.replace('/dashboard/staff-credentials');
          return;
        }

        setCurrentHospital({
          id: session.hospital_id,
          name: session.hospital_name || 'Hospital Facility Node',
        });
        setAdminName(session.full_name || 'Hospital Administrator');
        setIsVerifyingGuard(false);
      } catch {
        router.replace('/admin/login');
      }
    })();
  }, [router]);

  const loadHospitalData = useCallback(async () => {
    if (!currentHospital.id || !supabase) return;
    setIsLoading(true);

    try {
      const [staffRes, apptRes, legacyApptRes, rxRes, bedsRes] = await Promise.all([
        supabase
          .from('hospital_staff_credentials')
          .select('*')
          .eq('hospital_id', currentHospital.id)
          .order('created_at', { ascending: false }),
        supabase.from('appointments').select('*').order('created_at', { ascending: false }),
        supabase.from('patient_appointments').select('*').order('created_at', { ascending: false }),
        supabase.from('prescriptions').select('*').order('created_at', { ascending: false }),
        supabase.from('hospital_beds').select('*').eq('hospital_id', currentHospital.id),
      ]);

      if (!staffRes.error && staffRes.data) {
        setStaffList(staffRes.data as StaffMember[]);
      }

      const appointmentRows = [
        ...((apptRes.data || []) as Record<string, unknown>[]),
        ...((legacyApptRes.data || []) as Record<string, unknown>[]),
      ].filter((row) => belongsToHospital(row, currentHospital.id, currentHospital.name));

      const queueMap = new Map<string, PatientQueueItem>();
      appointmentRows.forEach((row) => {
        const mapped = mapAppointmentToQueue(row);
        if (mapped && !queueMap.has(mapped.id)) queueMap.set(mapped.id, mapped);
      });
      setPatientQueue(Array.from(queueMap.values()));

      const rxRows = ((rxRes.data || []) as Record<string, unknown>[]).filter((row) =>
        belongsToHospital(row, currentHospital.id, currentHospital.name),
      );
      const pending = rxRows.filter((r) =>
        ['DISPATCHED', 'PENDING', 'SUBMITTED'].includes(String(r.status ?? '').toUpperCase()),
      ).length;
      const inProgress = rxRows.filter((r) =>
        ['IN_PROGRESS', 'DISPENSING'].includes(String(r.status ?? '').toUpperCase()),
      ).length;
      const fulfilled = rxRows.filter((r) =>
        ['FULFILLED', 'COMPLETED', 'DELIVERED'].includes(String(r.status ?? '').toUpperCase()),
      ).length;
      setPharmacyMetrics({ pending, inProgress, fulfilled });

      const bedRows = bedsRes.error
        ? []
        : ((bedsRes.data || []) as Array<{
            ward_name?: string;
            ward_type?: string;
            status?: string;
          }>);

      if (bedRows.length > 0) {
        const wardMap = new Map<string, WardSnapshot>();
        bedRows.forEach((bed) => {
          const name = String(bed.ward_name ?? bed.ward_type ?? 'General Ward');
          const current = wardMap.get(name) ?? { name, total: 0, occupied: 0, free: 0 };
          current.total += 1;
          if (String(bed.status ?? '').toLowerCase() === 'occupied') current.occupied += 1;
          else current.free += 1;
          wardMap.set(name, current);
        });
        setWardSnapshots(Array.from(wardMap.values()));
      } else {
        setWardSnapshots([
          { name: 'Intensive Care Unit (ICU)', total: 0, occupied: 0, free: 0 },
          { name: 'Emergency Ward', total: 0, occupied: 0, free: 0 },
          { name: 'General Inpatient Ward', total: 0, occupied: 0, free: 0 },
        ]);
      }
    } catch (err) {
      console.error('Failed to load hospital operations data:', err);
    }

    setIsLoading(false);
  }, [currentHospital.id, currentHospital.name]);

  useEffect(() => {
    if (!isVerifyingGuard && currentHospital.id) {
      void loadHospitalData();
    }
  }, [isVerifyingGuard, currentHospital.id, loadHospitalData]);

  useEffect(() => {
    if (!supabase || !currentHospital.id || isVerifyingGuard) return;

    const channel = supabase
      .channel(`hospital_ops_${currentHospital.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () =>
        void loadHospitalData(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_appointments' }, () =>
        void loadHospitalData(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prescriptions' }, () =>
        void loadHospitalData(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentHospital.id, isVerifyingGuard, loadHospitalData]);

  const doctors = useMemo(
    () => staffList.filter((s) => s.staff_type === 'Doctor'),
    [staffList],
  );

  const filteredQueue = useMemo(() => {
    return patientQueue.filter((item) => {
      const matchesSearch =
        item.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.token_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.doctor_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = selectedDeptFilter === 'All' || item.department === selectedDeptFilter;
      return matchesSearch && matchesDept;
    });
  }, [patientQueue, searchQuery, selectedDeptFilter]);

  const departmentsList = useMemo(() => {
    const fromQueue = patientQueue.map((p) => p.department);
    const fromStaff = staffList.map((s) => s.department).filter(Boolean);
    return ['All', ...Array.from(new Set([...fromQueue, ...fromStaff]))];
  }, [patientQueue, staffList]);

  const bedOccupancyPct = useMemo(() => {
    const total = wardSnapshots.reduce((sum, w) => sum + w.total, 0);
    const occupied = wardSnapshots.reduce((sum, w) => sum + w.occupied, 0);
    if (total === 0) return 0;
    return Math.round((occupied / total) * 100);
  }, [wardSnapshots]);

  const doctorQueueCounts = useMemo(() => {
    const counts = new Map<string, number>();
    patientQueue.forEach((item) => {
      const key = item.doctor_name.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [patientQueue]);

  const resolveDoctorShiftStatus = (doc: StaffMember): string => {
    const inConsult = patientQueue.some(
      (q) =>
        q.doctor_name.toLowerCase() === doc.full_name.toLowerCase() &&
        q.status === 'In Consultation',
    );
    if (inConsult) return 'In Consultation';
    if (doc.is_logged_in) return 'Available';
    return 'Off Duty';
  };

  const handleIssueToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !tokenForm.patientName.trim() || !tokenForm.doctorName.trim()) return;

    setIsSubmittingToken(true);
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const nextToken = patientQueue.length + 1;

    const payload = {
      hospital_id: currentHospital.id,
      hospital_name: currentHospital.name,
      patient_name: tokenForm.patientName.trim(),
      age: tokenForm.age || null,
      gender: tokenForm.gender,
      department: tokenForm.department,
      doctor_id: tokenForm.doctorId || tokenForm.doctorName,
      doctor_name: tokenForm.doctorName,
      chief_complaint: tokenForm.chiefComplaint.trim(),
      token_number: `#${String(nextToken).padStart(2, '0')}`,
      status: 'WAITING',
      queue_status: 'WAITING',
      appointment_date: today,
      appointment_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      source: 'hospital_dashboard_walkin',
      created_at: now,
      updated_at: now,
    };

    try {
      const { error } = await supabase.from('appointments').insert([payload]);
      if (error) {
        await supabase.from('patient_appointments').insert([payload]);
      }
      setShowTokenModal(false);
      setTokenForm({
        patientName: '',
        age: '',
        gender: 'Female',
        department: 'General Medicine',
        doctorId: '',
        doctorName: '',
        chiefComplaint: '',
      });
      await loadHospitalData();
    } catch (err) {
      console.error('Walk-in token issue failed:', err);
    } finally {
      setIsSubmittingToken(false);
    }
  };

  if (isVerifyingGuard) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-xs font-semibold">Verifying hospital setup status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-800 font-sans p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-[1440px] mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-[11px] font-mono font-bold text-indigo-300">
              <Hospital className="w-3.5 h-3.5 text-cyan-400" />
              <span>FACILITY NODE: {currentHospital.id}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              {currentHospital.name} Operations Command
            </h1>
            <p className="text-xs text-indigo-200">
              Logged in: <strong className="text-white">{adminName}</strong> • Scoped strictly to
              your healthcare facility.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowTokenModal(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg transition flex items-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Issue OPD Token</span>
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard/staff-credentials')}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Staff Vault</span>
            </button>
            <button
              type="button"
              onClick={() => void loadHospitalData()}
              className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              title="Refresh Hospital Metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3.5">
            <div className="p-3 rounded-lg bg-indigo-50 text-indigo-700">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">{staffList.length}</div>
              <div className="text-[11px] font-semibold text-slate-500">Total Provisioned Staff</div>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3.5">
            <div className="p-3 rounded-lg bg-blue-50 text-blue-700">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">{doctors.length}</div>
              <div className="text-[11px] font-semibold text-slate-500">Clinical Doctors</div>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3.5">
            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-600">{patientQueue.length}</div>
              <div className="text-[11px] font-semibold text-slate-500">Live OPD Triage Active</div>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center gap-3.5">
            <div className="p-3 rounded-lg bg-purple-50 text-purple-700">
              <Bed className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">{bedOccupancyPct}%</div>
              <div className="text-[11px] font-semibold text-slate-500">Bed Occupancy Rate</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
          {(
            [
              { id: 'queue' as const, label: 'Live OPD & Triage Queues', icon: Clock },
              { id: 'doctors' as const, label: 'Doctor Schedule & Status', icon: Stethoscope },
              { id: 'wards' as const, label: 'Ward & Bed Occupancy', icon: Bed },
              { id: 'pharmacy' as const, label: 'Pharmacy Dispense', icon: Pill },
              { id: 'vendors' as const, label: 'Vendors', icon: Truck },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab === 'queue' && (
          <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search token, patient name, or doctor..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {departmentsList.map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setSelectedDeptFilter(dept)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
                      selectedDeptFilter === dept
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>

            {filteredQueue.length === 0 ? (
              <div className="py-16 text-center space-y-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">No Patients in Triage Queue</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Issue a walk-in OPD token or wait for patient bookings scoped to{' '}
                  {currentHospital.id}.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs min-w-[800px]">
                  <thead className="bg-slate-100 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Token & Patient</th>
                      <th className="py-3 px-4">Department & Doctor</th>
                      <th className="py-3 px-4">Triage Priority</th>
                      <th className="py-3 px-4">Wait Time</th>
                      <th className="py-3 px-4">Live Status</th>
                      <th className="py-3 px-4">Room</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredQueue.map((item) => (
                      <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="py-3.5 px-4 font-medium">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded font-mono text-[11px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {item.token_number}
                            </span>
                            <div>
                              <div className="font-bold text-slate-900">{item.patient_name}</div>
                              <div className="text-[10px] text-slate-400">
                                {item.age} yrs • {item.gender}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800">{item.department}</div>
                          <div className="text-[11px] text-indigo-600 font-semibold">
                            {item.doctor_name}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border ${
                              item.triage_level === 'Critical'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : item.triage_level === 'Urgent'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {item.triage_level}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {item.wait_time_mins} mins
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1.5 w-fit ${
                              item.status === 'In Consultation'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.status === 'In Consultation'
                                  ? 'bg-emerald-500 animate-pulse'
                                  : 'bg-blue-500'
                              }`}
                            />
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">{item.room || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'doctors' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {doctors.length === 0 ? (
              <div className="col-span-full py-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                No doctors provisioned for {currentHospital.name}. Add clinicians in Staff Vault.
              </div>
            ) : (
              doctors.map((doc) => {
                const shiftStatus = resolveDoctorShiftStatus(doc);
                const queueCount = doctorQueueCounts.get(doc.full_name.toLowerCase()) ?? 0;
                return (
                  <div
                    key={doc.id}
                    className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {doc.id}
                      </span>
                      <span
                        className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          shiftStatus === 'In Consultation'
                            ? 'text-amber-700 bg-amber-50 border-amber-200'
                            : shiftStatus === 'Available'
                              ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                              : 'text-slate-500 bg-slate-100 border-slate-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            shiftStatus === 'Available' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                          }`}
                        />
                        {shiftStatus}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{doc.full_name}</h3>
                      <p className="text-xs text-indigo-600 font-semibold">{doc.department}</p>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">{doc.email}</p>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>{doc.department} OPD</span>
                      <span className="font-bold text-slate-800">{queueCount} In Queue</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'wards' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {wardSnapshots.map((ward) => (
              <div
                key={ward.name}
                className="p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black text-slate-900">{ward.name}</h3>
                  <Bed className="w-4 h-4 text-slate-400" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-base font-black text-slate-900">{ward.total}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Total</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                    <div className="text-base font-black text-rose-700">{ward.occupied}</div>
                    <div className="text-[10px] text-rose-500 font-bold uppercase">Occupied</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                    <div className="text-base font-black text-emerald-700">{ward.free}</div>
                    <div className="text-[10px] text-emerald-500 font-bold uppercase">Available</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'pharmacy' && (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase">
                Prescription Dispense Pipeline
              </h3>
              <span className="text-xs font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                {currentHospital.id} DISPENSARY
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xl font-black text-slate-900">{pharmacyMetrics.pending}</div>
                <div className="text-xs text-slate-500">Pending Prescriptions</div>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <div className="text-xl font-black text-amber-700">{pharmacyMetrics.inProgress}</div>
                <div className="text-xs text-amber-600">Dispensing in Progress</div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-xl font-black text-emerald-700">{pharmacyMetrics.fulfilled}</div>
                <div className="text-xs text-emerald-600">Fulfilled Today</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'vendors' && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase">Vendor Provisioning</h3>
              <p className="mt-1 text-xs text-slate-500">
                Create vendor portal credentials for {currentHospital.name}.
              </p>
            </div>
            {vendorMessage && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                {vendorMessage}
              </div>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!supabase || !currentHospital.id) return;
                const payload = {
                  id: `VND-${Date.now()}`,
                  hospital_id: currentHospital.id,
                  company_name: vendorForm.companyName.trim(),
                  rep_email: vendorForm.repEmail.trim().toLowerCase(),
                  category: vendorForm.category,
                  passcode: vendorForm.passcode.trim(),
                  temporary_passcode: vendorForm.passcode.trim(),
                  status: 'Active',
                };
                const { error } = await supabase.from('hospital_vendors').upsert(payload, {
                  onConflict: 'rep_email',
                });
                if (error) {
                  setVendorMessage(`Vendor save warning: ${error.message}`);
                  return;
                }
                setVendorMessage(`Provisioned vendor ${payload.company_name} successfully.`);
                setVendorForm({ companyName: '', repEmail: '', category: 'Pharmaceuticals', passcode: '' });
              }}
              className="grid gap-3 md:grid-cols-2"
            >
              <input
                required
                value={vendorForm.companyName}
                onChange={(e) => setVendorForm((p) => ({ ...p, companyName: e.target.value }))}
                placeholder="Company name"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs"
              />
              <input
                required
                type="email"
                value={vendorForm.repEmail}
                onChange={(e) => setVendorForm((p) => ({ ...p, repEmail: e.target.value }))}
                placeholder="Vendor rep email"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs"
              />
              <select
                value={vendorForm.category}
                onChange={(e) => setVendorForm((p) => ({ ...p, category: e.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs"
              >
                <option>Pharmaceuticals</option>
                <option>Surgical Supplies</option>
                <option>Diagnostics</option>
                <option>General Equipment</option>
              </select>
              <input
                required
                value={vendorForm.passcode}
                onChange={(e) => setVendorForm((p) => ({ ...p, passcode: e.target.value }))}
                placeholder="Vendor passcode"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono"
              />
              <button
                type="submit"
                className="md:col-span-2 rounded-xl bg-orange-600 py-3 text-xs font-bold text-white uppercase"
              >
                Provision Vendor Portal Access
              </button>
            </form>
          </div>
        )}
      </div>

      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 uppercase">Issue Walk-In OPD Token</h2>
              <button
                type="button"
                onClick={() => setShowTokenModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleIssueToken} className="space-y-3 text-xs">
              <input
                required
                value={tokenForm.patientName}
                onChange={(e) => setTokenForm((p) => ({ ...p, patientName: e.target.value }))}
                placeholder="Patient full name"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={tokenForm.age}
                  onChange={(e) => setTokenForm((p) => ({ ...p, age: e.target.value }))}
                  placeholder="Age"
                  className="px-3 py-2.5 rounded-xl border border-slate-200"
                />
                <select
                  value={tokenForm.gender}
                  onChange={(e) => setTokenForm((p) => ({ ...p, gender: e.target.value }))}
                  className="px-3 py-2.5 rounded-xl border border-slate-200"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <select
                required
                value={tokenForm.doctorName}
                onChange={(e) => {
                  const doc = doctors.find((d) => d.full_name === e.target.value);
                  setTokenForm((p) => ({
                    ...p,
                    doctorName: e.target.value,
                    doctorId: doc?.id ?? '',
                    department: doc?.department ?? p.department,
                  }));
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200"
              >
                <option value="">Select consulting doctor</option>
                {doctors.map((doc) => (
                  <option key={doc.id} value={doc.full_name}>
                    {doc.full_name} — {doc.department}
                  </option>
                ))}
              </select>
              <input
                value={tokenForm.chiefComplaint}
                onChange={(e) => setTokenForm((p) => ({ ...p, chiefComplaint: e.target.value }))}
                placeholder="Chief complaint / triage notes"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200"
              />
              <button
                type="submit"
                disabled={isSubmittingToken || doctors.length === 0}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {isSubmittingToken ? 'Issuing Token...' : 'Confirm & Issue Token'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
