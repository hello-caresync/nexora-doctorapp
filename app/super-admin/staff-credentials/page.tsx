'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Crown,
  Building2,
  Stethoscope,
  Users,
  Copy,
  Check,
  Eye,
  EyeOff,
  Search,
  RefreshCw,
  Hospital,
  PlusCircle,
  X,
  Sparkles,
  ShieldCheck,
  ArrowLeft,
  ChevronRight,
  Inbox,
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { generateEnterprisePasscode } from '@/lib/generatePasscode';
import {
  parseSuperAdminSession,
  SUPER_ADMIN_SESSION_KEY,
} from '@/lib/auth/super-admin-session';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface HospitalEntity {
  id: string;
  name: string;
  city: string;
  status: string;
}

interface StaffCredential {
  id: string;
  hospital_id: string;
  hospital_name: string;
  full_name: string;
  staff_type: 'Doctor' | 'Nurse' | 'Receptionist' | 'Pharmacist' | 'Admin';
  department: string;
  email: string;
  temporary_passcode: string;
  phone?: string;
  portal_access: string;
  status: 'Active' | 'Restricted';
  is_logged_in?: boolean;
  last_login?: string;
  created_at?: string;
}

type RoleFilter = 'All' | StaffCredential['staff_type'];

function normalizeCredential(row: Record<string, unknown>): StaffCredential {
  const facilityNode =
    typeof row.facility_node === 'string' ? row.facility_node : 'Regal Hospital Main';

  return {
    id: String(row.id ?? ''),
    hospital_id: String(row.hospital_id ?? 'HOSP-01'),
    hospital_name: String(row.hospital_name ?? facilityNode),
    full_name: String(row.full_name ?? ''),
    staff_type: (row.staff_type as StaffCredential['staff_type']) ?? 'Admin',
    department: String(row.department ?? ''),
    email: String(row.email ?? ''),
    temporary_passcode: String(row.temporary_passcode ?? ''),
    phone: row.phone ? String(row.phone) : undefined,
    portal_access: String(row.portal_access ?? '/dashboard'),
    status: (row.status as StaffCredential['status']) ?? 'Active',
    is_logged_in: row.is_logged_in === true,
    last_login: row.last_login ? String(row.last_login) : undefined,
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

function suggestNextHospitalId(existingIds: string[]): string {
  const numbers = existingIds
    .map((id) => {
      const match = id.match(/^HOSP-(\d+)$/i);
      return match ? Number.parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);

  const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 4;
  return `HOSP-${String(next).padStart(2, '0')}`;
}

function mergeHospitalEntities(
  tenants: HospitalEntity[],
  credentials: StaffCredential[],
): HospitalEntity[] {
  const map = new Map<string, HospitalEntity>();

  tenants.forEach((h) => map.set(h.id, h));

  credentials.forEach((cred) => {
    if (!map.has(cred.hospital_id)) {
      map.set(cred.hospital_id, {
        id: cred.hospital_id,
        name: cred.hospital_name,
        city: 'Bengaluru',
        status: 'Active',
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function buildLoginPacket(staff: StaffCredential): string {
  return [
    '=====================================',
    staff.hospital_name.toUpperCase(),
    'OFFICIAL CLINICAL ACCESS PASS',
    '=====================================',
    `Hospital Node: ${staff.hospital_name} (${staff.hospital_id})`,
    `Staff ID: ${staff.id}`,
    `Staff Member: ${staff.full_name}`,
    `Role: ${staff.staff_type} (${staff.department})`,
    `Login Email: ${staff.email}`,
    `Security Passcode: ${staff.temporary_passcode}`,
    'Portal Login URL: http://localhost:3000/login',
    `Target Workspace: ${staff.portal_access}`,
    '=====================================',
  ].join('\n');
}

async function onboardHospitalDirect(payload: {
  hospitalId: string;
  hospitalName: string;
  city: string;
  adminName: string;
  adminEmail: string;
  adminPasscode: string;
  adminPhone: string;
}): Promise<void> {
  if (!supabase) throw new Error('Supabase client unavailable.');

  const adminId = `${payload.hospitalId}-ADM01`;

  await supabase.from('hospital_tenants').upsert(
    {
      hospital_id: payload.hospitalId,
      hospital_name: payload.hospitalName,
      city: payload.city,
    },
    { onConflict: 'hospital_id' },
  );

  const { error: credError } = await supabase.from('hospital_staff_credentials').upsert(
    {
      id: adminId,
      hospital_id: payload.hospitalId,
      hospital_name: payload.hospitalName,
      full_name: payload.adminName,
      staff_type: 'Admin',
      department: 'Hospital Administration',
      email: payload.adminEmail,
      temporary_passcode: payload.adminPasscode,
      phone: payload.adminPhone,
      portal_access: '/dashboard',
      status: 'Active',
      is_logged_in: false,
    },
    { onConflict: 'email' },
  );

  if (credError) throw new Error(credError.message);
}

export default function SuperAdminHospitalBlocksDashboard() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [hospitals, setHospitals] = useState<HospitalEntity[]>([]);
  const [credentials, setCredentials] = useState<StaffCredential[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<RoleFilter>('All');
  const [visibleKeys, setVisibleKeys] = useState<{ [id: string]: boolean }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [createdPacket, setCreatedPacket] = useState<StaffCredential | null>(null);

  const [newHospId, setNewHospId] = useState('HOSP-04');
  const [newHospName, setNewHospName] = useState('');
  const [newHospCity, setNewHospCity] = useState('Bengaluru');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('+91 98450 00000');
  const [adminPasscode, setAdminPasscode] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadPlatformData = useCallback(async () => {
    setIsLoading(true);

    if (supabase) {
      try {
        const [tenantRes, credRes] = await Promise.all([
          supabase.from('hospital_tenants').select('*').order('hospital_id', { ascending: true }),
          supabase
            .from('hospital_staff_credentials')
            .select('*')
            .order('created_at', { ascending: false }),
        ]);

        const normalizedCreds = (credRes.data ?? []).map((row) =>
          normalizeCredential(row as Record<string, unknown>),
        );
        setCredentials(normalizedCreds);

        const tenantEntities: HospitalEntity[] = (tenantRes.data ?? []).map((row) => ({
          id: String(row.hospital_id),
          name: String(row.hospital_name),
          city: String(row.city ?? 'Bengaluru'),
          status: 'Active',
        }));

        const merged = mergeHospitalEntities(tenantEntities, normalizedCreds);
        setHospitals(merged);
        setNewHospId(suggestNextHospitalId(merged.map((h) => h.id)));
      } catch (err) {
        console.error('Error fetching platform data:', err);
      }
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    const session = parseSuperAdminSession(localStorage.getItem(SUPER_ADMIN_SESSION_KEY));
    if (!session) {
      router.replace('/platform-ops-x92/auth');
      return;
    }
    setAuthReady(true);
  }, [router]);

  useEffect(() => {
    if (!authReady) return;
    void loadPlatformData();

    if (!supabase) return;

    const channel = supabase
      .channel('super_admin_blocks_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hospital_tenants' },
        () => {
          void loadPlatformData();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hospital_staff_credentials' },
        () => {
          void loadPlatformData();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authReady, loadPlatformData]);

  const generateDeterministicAdminPasscode = () => {
    if (!adminName.trim()) {
      setModalError('Please enter Admin Full Name before generating a passcode.');
      return;
    }

    setModalError(null);
    setAdminPasscode(
      generateEnterprisePasscode(
        'Admin',
        'Hospital Administration',
        adminName.trim(),
        newHospId.trim().toUpperCase() || 'HOSP-01',
        newHospName.trim() || 'Regal Hospital Main',
      ),
    );
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalSubmitting(true);

    const hospitalId = newHospId.trim().toUpperCase();
    const hospitalName = newHospName.trim();
    const city = newHospCity.trim();
    const fullAdminName = adminName.trim();
    const email = adminEmail.trim().toLowerCase();
    const passcode = adminPasscode.trim();
    const phone = adminPhone.trim() || '+91 98450 00000';

    if (!hospitalId || !hospitalName || !fullAdminName || !email || !passcode) {
      setModalError('Please complete all required fields.');
      setModalSubmitting(false);
      return;
    }

    try {
      if (!supabase) throw new Error('Supabase client unavailable.');

      const { error: procError } = await supabase.rpc('onboard_new_hospital', {
        p_hospital_id: hospitalId,
        p_hospital_name: hospitalName,
        p_city: city,
        p_admin_name: fullAdminName,
        p_admin_email: email,
        p_admin_passcode: passcode,
        p_admin_phone: phone,
      });

      if (procError) {
        await onboardHospitalDirect({
          hospitalId,
          hospitalName,
          city,
          adminName: fullAdminName,
          adminEmail: email,
          adminPasscode: passcode,
          adminPhone: phone,
        });
      }

      const newAdminRecord: StaffCredential = {
        id: `${hospitalId}-ADM01`,
        hospital_id: hospitalId,
        hospital_name: hospitalName,
        full_name: fullAdminName,
        staff_type: 'Admin',
        department: 'Hospital Administration',
        email,
        temporary_passcode: passcode,
        phone,
        portal_access: '/dashboard',
        status: 'Active',
        created_at: new Date().toISOString(),
      };

      setCreatedPacket(newAdminRecord);
      setShowOnboardModal(false);
      await loadPlatformData();

      setNewHospName('');
      setAdminName('');
      setAdminEmail('');
      setAdminPasscode('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to onboard hospital.';
      setModalError(message);
    } finally {
      setModalSubmitting(false);
    }
  };

  const copyLoginPacket = (staff: StaffCredential) => {
    navigator.clipboard.writeText(buildLoginPacket(staff));
    setCopiedId(staff.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const selectedHospitalData = hospitals.find((h) => h.id === selectedHospitalId);

  const scopedCredentials = useMemo(() => {
    if (!selectedHospitalId) return [];
    return credentials.filter((c) => {
      const matchesHospital = c.hospital_id === selectedHospitalId;
      const matchesRole = selectedRoleFilter === 'All' || c.staff_type === selectedRoleFilter;
      const matchesSearch =
        c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesHospital && matchesRole && matchesSearch;
    });
  }, [credentials, selectedHospitalId, selectedRoleFilter, searchQuery]);

  const roleFilters: RoleFilter[] = ['All', 'Admin', 'Doctor', 'Nurse', 'Receptionist', 'Pharmacist'];

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-800 font-sans p-4 sm:p-8">
      <div className="w-full max-w-[1440px] mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-950 via-purple-950 to-slate-900 text-white shadow-xl border border-purple-900/30">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-[11px] font-mono font-bold text-purple-300">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>SUPER ADMIN PLATFORM ROOT</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Hospital Tenant Directory & Credentials
            </h1>
            <p className="text-xs text-purple-200">
              Select any hospital block to inspect its dedicated staff credentials, or onboard a
              new healthcare facility.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowOnboardModal(true)}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-purple-600/30 transition flex items-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Onboard New Hospital</span>
            </button>
            <button
              type="button"
              onClick={() => void loadPlatformData()}
              className="p-2.5 rounded-xl bg-purple-900/50 border border-purple-700/60 text-purple-200 hover:text-white transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              title="Sync Platform Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {!selectedHospitalId ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-600" />
                Connected Hospital Tenants ({hospitals.length})
              </h2>
              <span className="text-xs text-slate-400">Click any block to open credential vault</span>
            </div>

            {isLoading ? (
              <div className="py-20 text-center text-slate-400 text-sm">Loading hospital blocks...</div>
            ) : hospitals.length === 0 ? (
              <div className="py-20 text-center space-y-3 bg-white rounded-2xl border border-dashed border-slate-200">
                <div className="p-3.5 rounded-full bg-purple-50 text-purple-700 w-fit mx-auto">
                  <Inbox className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No hospital tenants onboarded yet</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Use <strong>Onboard New Hospital</strong> to create the first facility block and
                  issue its master admin credentials.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {hospitals.map((hosp) => {
                  const hospCreds = credentials.filter((c) => c.hospital_id === hosp.id);
                  const docCount = hospCreds.filter((c) => c.staff_type === 'Doctor').length;
                  const staffCount = hospCreds.filter(
                    (c) => c.staff_type !== 'Doctor' && c.staff_type !== 'Admin',
                  ).length;
                  const liveCount = hospCreds.filter((c) => c.is_logged_in).length;

                  return (
                    <div
                      key={hosp.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedHospitalId(hosp.id);
                        setSearchQuery('');
                        setSelectedRoleFilter('All');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedHospitalId(hosp.id);
                          setSearchQuery('');
                          setSelectedRoleFilter('All');
                        }
                      }}
                      className="group bg-white rounded-2xl border border-slate-200 hover:border-purple-500 p-6 shadow-xs hover:shadow-xl transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-5"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            {hosp.id}
                          </span>
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {hosp.status}
                            {liveCount > 0 && ` · ${liveCount} live`}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-lg font-black text-slate-900 group-hover:text-purple-700 transition">
                            {hosp.name}
                          </h3>
                          <p className="text-xs text-slate-400">{hosp.city}</p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="text-base font-black text-slate-900">{hospCreds.length}</div>
                          <div className="text-[10px] font-medium text-slate-400 uppercase">Accounts</div>
                        </div>
                        <div className="p-2 rounded-xl bg-blue-50/50 border border-blue-100">
                          <div className="text-base font-black text-blue-700">{docCount}</div>
                          <div className="text-[10px] font-medium text-blue-500 uppercase">Doctors</div>
                        </div>
                        <div className="p-2 rounded-xl bg-teal-50/50 border border-teal-100">
                          <div className="text-base font-black text-teal-700">{staffCount}</div>
                          <div className="text-[10px] font-medium text-teal-500 uppercase">Staff</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs font-bold text-purple-700 pt-2">
                        <span>View Staff Directory</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setSelectedHospitalId(null)}
                className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-2xs hover:bg-slate-50 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to All Hospitals</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Active Tenant:</span>
                <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-black">
                  {selectedHospitalData?.name} ({selectedHospitalId})
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search within ${selectedHospitalData?.name}...`}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:border-purple-600 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {roleFilters.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setSelectedRoleFilter(role)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
                        selectedRoleFilter === role
                          ? 'bg-purple-700 text-white shadow-xs'
                          : 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                <div className="max-h-[580px] overflow-y-auto overflow-x-auto">
                  {scopedCredentials.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 text-sm">
                      No credentials found for this hospital with the current filters.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider z-10">
                        <tr>
                          <th className="py-3 px-4">Staff Member & ID</th>
                          <th className="py-3 px-4">Department & Role</th>
                          <th className="py-3 px-4">Workspace Route</th>
                          <th className="py-3 px-4">Deterministic Passcode</th>
                          <th className="py-3 px-4 text-right">Access Pass</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {scopedCredentials.map((staff) => {
                          const isVisible = visibleKeys[staff.id];
                          return (
                            <tr key={staff.id} className="hover:bg-purple-50/30 transition-colors">
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                    {staff.id}
                                  </span>
                                  <div>
                                    <div className="font-bold text-slate-900 text-xs">{staff.full_name}</div>
                                    <div className="font-mono text-[10px] text-slate-400">{staff.email}</div>
                                    {staff.is_logged_in && staff.last_login && (
                                      <div className="text-[9px] text-emerald-600 font-semibold mt-0.5">
                                        Live · {new Date(staff.last_login).toLocaleString()}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-1.5">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 border border-slate-200 text-slate-700">
                                    {staff.department}
                                  </span>
                                  <span className="text-[9px] font-bold font-mono text-purple-700">
                                    ● {staff.staff_type}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-purple-700 font-semibold text-[11px]">
                                {staff.portal_access}
                              </td>
                              <td className="py-3.5 px-4 font-mono">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2.5 py-1 rounded text-[11px] font-bold border ${
                                      isVisible
                                        ? 'bg-purple-50 text-purple-900 border-purple-200'
                                        : 'bg-slate-100 text-slate-400 border-slate-200'
                                    }`}
                                  >
                                    {isVisible ? staff.temporary_passcode : '••••••••••••••••'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setVisibleKeys((prev) => ({ ...prev, [staff.id]: !isVisible }))
                                    }
                                    className="text-slate-400 hover:text-slate-700 transition cursor-pointer"
                                    title="Toggle Visibility"
                                  >
                                    {isVisible ? (
                                      <EyeOff className="w-3.5 h-3.5" />
                                    ) : (
                                      <Eye className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => copyLoginPacket(staff)}
                                  className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                    copiedId === staff.id
                                      ? 'bg-purple-100 border-purple-300 text-purple-800'
                                      : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                  }`}
                                  title="Copy Handover Packet"
                                >
                                  {copiedId === staff.id ? (
                                    <Check className="w-3.5 h-3.5" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-2">
                <span>
                  Showing {scopedCredentials.length} credentials for {selectedHospitalData?.name}
                </span>
                <span>Protected against cross-tenant exposure</span>
              </div>
            </div>
          </div>
        )}

        {showOnboardModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
                    <Hospital className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Onboard New Hospital Entity</h3>
                    <p className="text-xs text-slate-500">
                      Registers block card and issues master admin credentials.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOnboardModal(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleOnboardSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase">
                      Hospital Node ID
                    </label>
                    <input
                      type="text"
                      required
                      value={newHospId}
                      onChange={(e) => setNewHospId(e.target.value.toUpperCase())}
                      placeholder="e.g. HOSP-04"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase">
                      City / Location
                    </label>
                    <input
                      type="text"
                      required
                      value={newHospCity}
                      onChange={(e) => setNewHospCity(e.target.value)}
                      placeholder="e.g. Bengaluru"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">
                    Hospital Official Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newHospName}
                    onChange={(e) => setNewHospName(e.target.value)}
                    placeholder="e.g. Aster CMI Super Speciality Hospital"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium"
                  />
                </div>

                <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-3">
                  <div className="text-[11px] font-bold text-purple-900 uppercase flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                    Master Hospital Admin Account
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-600 uppercase">
                        Admin Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        placeholder="e.g. Rajesh Sharma"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-600 uppercase">
                        Admin Official Email
                      </label>
                      <input
                        type="email"
                        required
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@astercmi.com"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase">
                      Admin Contact Number
                    </label>
                    <input
                      type="tel"
                      value={adminPhone}
                      onChange={(e) => setAdminPhone(e.target.value)}
                      placeholder="+91 98450 00000"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-bold text-slate-600 uppercase">
                        Structured Passcode
                      </label>
                      <button
                        type="button"
                        onClick={generateDeterministicAdminPasscode}
                        className="text-[10px] font-bold text-purple-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" /> Generate
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      value={adminPasscode}
                      onChange={(e) => setAdminPasscode(e.target.value)}
                      placeholder="e.g. OPS-AC-RS26-A413"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-purple-800 font-mono font-bold"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="w-full py-3 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-purple-700/30 transition cursor-pointer"
                >
                  {modalSubmitting ? 'Onboarding...' : 'Create Block & Issue Admin Pass'}
                </button>
              </form>
            </div>
          </div>
        )}

        {createdPacket && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5">
              <div className="text-center space-y-1.5">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full w-fit mx-auto border border-emerald-200">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-slate-900">Hospital Block Created!</h3>
                <p className="text-xs text-slate-500">
                  Deliver this credential handover pass to the Hospital Administrator.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 text-white font-mono text-xs space-y-2 border border-slate-800">
                <div className="text-purple-300 font-bold border-b border-slate-800 pb-1.5">
                  {createdPacket.hospital_name} ({createdPacket.hospital_id})
                </div>
                <div className="text-slate-300">
                  Admin Name: <span className="text-white font-bold">{createdPacket.full_name}</span>
                </div>
                <div className="text-slate-300">
                  Official Login: <span className="text-white font-bold">{createdPacket.email}</span>
                </div>
                <div className="text-slate-300">
                  Security Passcode:{' '}
                  <span className="text-emerald-400 font-bold">{createdPacket.temporary_passcode}</span>
                </div>
                <div className="text-slate-300">
                  Login Gateway:{' '}
                  <span className="text-indigo-300 underline">http://localhost:3000/login</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => copyLoginPacket(createdPacket)}
                  className="flex-1 py-3 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Copy className="w-4 h-4" />
                  <span>
                    {copiedId === createdPacket.id ? 'Copied Pass!' : 'Copy Handover Pass'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreatedPacket(null)}
                  className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
