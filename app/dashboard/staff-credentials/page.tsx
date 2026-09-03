'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  UserPlus,
  ShieldCheck,
  Users,
  Copy,
  Check,
  Eye,
  EyeOff,
  Mail,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Truck,
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { generateEnterprisePasscode } from '@/lib/generatePasscode';
import { markHospitalSetupCompleted } from '@/lib/auth/admin-setup';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface StaffCredential {
  id: string;
  hospital_id: string;
  hospital_name: string;
  full_name: string;
  staff_type: 'Doctor' | 'Nurse' | 'Receptionist' | 'Pharmacist' | 'Admin';
  department: string;
  email: string;
  temporary_passcode: string;
  phone: string;
  portal_access: string;
  status: 'Active' | 'Restricted';
  created_at?: string;
}

type ProvisionRole = 'Doctor' | 'Nurse' | 'Receptionist' | 'Pharmacist';

function resolvePortalRoute(role: ProvisionRole): string {
  if (role === 'Doctor') return '/doctor/workspace';
  if (role === 'Receptionist') return '/staff/reception';
  if (role === 'Pharmacist') return '/staff/pharmacy';
  if (role === 'Nurse') return '/staff/nursing';
  return '/dashboard';
}

function nextStaffId(
  staffList: StaffCredential[],
  hospitalId: string,
  staffType: ProvisionRole,
): string {
  const rolePrefix =
    staffType === 'Doctor'
      ? 'D'
      : staffType === 'Nurse'
        ? 'N'
        : staffType === 'Receptionist'
          ? 'R'
          : 'P';
  const hospitalPrefix = hospitalId.replace('HOSP-', 'H');
  const sameRoleCount = staffList.filter((s) => s.staff_type === staffType).length;
  return `${hospitalPrefix}-${rolePrefix}${String(sameRoleCount + 1).padStart(2, '0')}`;
}

type SetupTab = 'staff' | 'vendors';

function StaffCredentialsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hospitalIdParam = searchParams.get('hospitalId');

  const [activeTab, setActiveTab] = useState<SetupTab>('staff');

  const [currentHospital, setCurrentHospital] = useState<{ id: string; name: string }>({
    id: 'HOSP-01',
    name: 'Regal Hospital Main',
  });
  const [adminName, setAdminName] = useState('Admin');
  const [staffList, setStaffList] = useState<StaffCredential[]>([]);
  const [visibleKeys, setVisibleKeys] = useState<{ [id: string]: boolean }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [fullName, setFullName] = useState('');
  const [staffType, setStaffType] = useState<ProvisionRole>('Doctor');
  const [department, setDepartment] = useState('General Medicine');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+91 98450 ');
  const [temporaryPasscode, setTemporaryPasscode] = useState('');
  const [vendorForm, setVendorForm] = useState({
    vendorName: '',
    email: '',
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

    try {
      const session = JSON.parse(stored) as {
        hospital_id?: string;
        hospital_name?: string;
        full_name?: string;
      };
      if (session?.hospital_id) {
        setCurrentHospital({
          id: hospitalIdParam || session.hospital_id,
          name: session.hospital_name || 'Hospital Node',
        });
        setAdminName(session.full_name || 'Hospital Admin');
      }
    } catch {
      router.replace('/admin/login');
    }
  }, [router]);

  const loadScopedCredentials = useCallback(async () => {
    if (!currentHospital.id) return;
    setIsLoading(true);

    let loadedData: StaffCredential[] = [];

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('hospital_staff_credentials')
          .select('*')
          .eq('hospital_id', currentHospital.id)
          .neq('staff_type', 'Admin')
          .order('created_at', { ascending: false });

        if (!error && data) {
          loadedData = data as StaffCredential[];
        }
      } catch (e) {
        console.warn('Database query bypassed:', e);
      }
    }

    setStaffList(loadedData);
    setIsLoading(false);
  }, [currentHospital.id]);

  useEffect(() => {
    void loadScopedCredentials();
  }, [loadScopedCredentials]);

  const generatePasscode = () => {
    setValidationError(null);

    if (!fullName.trim()) {
      setValidationError('Please enter Full Name first.');
      return;
    }

    setTemporaryPasscode(
      generateEnterprisePasscode(
        staffType,
        department,
        fullName,
        currentHospital.id,
        currentHospital.name,
      ),
    );
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!temporaryPasscode.trim()) {
      setValidationError('Please generate or enter a passcode.');
      return;
    }

    const resolvedPortal = resolvePortalRoute(staffType);
    const staffId = nextStaffId(staffList, currentHospital.id, staffType);

    const newStaff: StaffCredential = {
      id: staffId,
      hospital_id: currentHospital.id,
      hospital_name: currentHospital.name,
      full_name: fullName.trim(),
      staff_type: staffType,
      department: department.trim(),
      email: email.trim().toLowerCase(),
      temporary_passcode: temporaryPasscode.trim(),
      phone: phone.trim() || '+91 98450 00000',
      portal_access: resolvedPortal,
      status: 'Active',
      created_at: new Date().toISOString(),
    };

    setStaffList([newStaff, ...staffList]);

    if (supabase) {
      try {
        const payload = { ...newStaff, is_logged_in: false };
        const { error } = await supabase
          .from('hospital_staff_credentials')
          .upsert(payload, { onConflict: 'email' });
        if (error) console.warn('Credential save warning:', error.message);

        const { error: memberError } = await supabase.from('staff_members').upsert(
          {
            id: newStaff.id,
            hospital_id: newStaff.hospital_id,
            hospital_name: newStaff.hospital_name,
            full_name: newStaff.full_name,
            staff_type: newStaff.staff_type,
            department: newStaff.department,
            email: newStaff.email,
            passcode: newStaff.temporary_passcode,
            temporary_passcode: newStaff.temporary_passcode,
            phone: newStaff.phone,
            portal_access: newStaff.portal_access,
            status: newStaff.status,
          },
          { onConflict: 'email' },
        );
        if (memberError) console.warn('staff_members save warning:', memberError.message);
      } catch (err) {
        console.warn('Staff provisioning save exception:', err);
      }
    }

    setFullName('');
    setEmail('');
    setPhone('+91 98450 ');
    setTemporaryPasscode('');
    setSuccessBanner(`Added ${newStaff.full_name} (${newStaff.staff_type}) to ${currentHospital.name}`);
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  const handleFinishSetupAndEnterDashboard = async () => {
    setValidationError(null);

    const doctorsCount = staffList.filter((s) => s.staff_type === 'Doctor').length;
    const supportCount = staffList.filter((s) => s.staff_type !== 'Doctor').length;

    if (doctorsCount < 1 || supportCount < 1) {
      setValidationError(
        'Please add at least one Doctor and one Support Staff member before launching your hospital.',
      );
      return;
    }

    await markHospitalSetupCompleted(currentHospital.id);
    router.replace('/dashboard');
  };

  const copyLoginPass = (staff: StaffCredential) => {
    const text = [
      '=====================================',
      staff.hospital_name.toUpperCase(),
      'CLINICAL LOGIN CREDENTIALS',
      '=====================================',
      `Name: ${staff.full_name}`,
      `Role: ${staff.staff_type} (${staff.department})`,
      `Official Email: ${staff.email}`,
      `Security Passcode: ${staff.temporary_passcode}`,
      'Portal Login URL: http://localhost:3000/login',
      `Workspace: ${staff.portal_access}`,
      '=====================================',
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopiedId(staff.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const doctorsCount = staffList.filter((s) => s.staff_type === 'Doctor').length;
  const supportStaffCount = staffList.filter((s) => s.staff_type !== 'Doctor').length;

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-800 font-sans p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-[1440px] mx-auto space-y-6">
        <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-purple-800/40">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-[11px] font-mono font-bold text-purple-300">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>MANDATORY SETUP GATE</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Create Team Credentials for {currentHospital.name}
            </h1>
            <p className="text-xs text-purple-200 max-w-2xl">
              Mandatory Setup: Please add your hospital&apos;s doctors, nursing staff,
              receptionists, and pharmacists. Once all required clinical members are provisioned,
              click &quot;Complete Setup &amp; Enter Hospital App&quot;.
            </p>
            <p className="text-[11px] text-purple-300/80">
              Welcome, {adminName}. Facility node: {currentHospital.id}
            </p>
          </div>

          <button
            type="button"
            onClick={handleFinishSetupAndEnterDashboard}
            className="px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <span>Complete Setup &amp; Enter Hospital App</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {validationError && (
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <div className="flex gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('staff')}
            className={`rounded-lg px-4 py-2 text-xs font-bold ${activeTab === 'staff' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
          >
            Clinical Staff
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('vendors')}
            className={`rounded-lg px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 ${activeTab === 'vendors' ? 'bg-orange-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
          >
            <Truck className="w-3.5 h-3.5" /> Vendors & Procurement
          </button>
        </div>

        {activeTab === 'vendors' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold uppercase text-slate-900">Provision Vendor Access</h2>
            {vendorMessage && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                {vendorMessage}
              </div>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!supabase) return;
                const payload = {
                  id: crypto.randomUUID(),
                  hospital_id: currentHospital.id,
                  vendor_name: vendorForm.vendorName.trim(),
                  category: vendorForm.category,
                  email: vendorForm.email.trim().toLowerCase(),
                  passcode: vendorForm.passcode.trim(),
                  status: 'active',
                };
                const { error } = await supabase.from('hospital_vendors').upsert(payload, {
                  onConflict: 'email',
                });
                if (error) {
                  setVendorMessage(`Vendor save warning: ${error.message}`);
                  return;
                }
                setVendorMessage(`Vendor ${payload.vendor_name} provisioned successfully.`);
                setVendorForm({ vendorName: '', email: '', category: 'Pharmaceuticals', passcode: '' });
              }}
              className="grid gap-3 md:grid-cols-2"
            >
              <input required value={vendorForm.vendorName} onChange={(e) => setVendorForm((p) => ({ ...p, vendorName: e.target.value }))} placeholder="Company name" className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs" />
              <input required type="email" value={vendorForm.email} onChange={(e) => setVendorForm((p) => ({ ...p, email: e.target.value }))} placeholder="Vendor rep email" className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs" />
              <select value={vendorForm.category} onChange={(e) => setVendorForm((p) => ({ ...p, category: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs">
                <option>Pharmaceuticals</option>
                <option>Surgical Implants</option>
                <option>Diagnostic Consumables</option>
                <option>Biomedical Equipment</option>
              </select>
              <input required value={vendorForm.passcode} onChange={(e) => setVendorForm((p) => ({ ...p, passcode: e.target.value }))} placeholder="Vendor passcode" className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-mono" />
              <button type="submit" className="md:col-span-2 rounded-xl bg-orange-600 py-3 text-xs font-bold text-white uppercase">
                Provision Vendor Portal Access
              </button>
            </form>
          </div>
        )}

        {activeTab === 'staff' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-4 rounded-2xl bg-white border border-slate-200 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-purple-700" />
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Add Member Credential
                </h2>
              </div>
              <span className="text-[10px] font-mono text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                {currentHospital.id}
              </span>
            </div>

            {successBanner && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successBanner}</span>
              </div>
            )}

            <form onSubmit={handleCreateStaff} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Full Name & Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Suriraju V / Sister Ananya"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Role
                  </label>
                  <select
                    value={staffType}
                    onChange={(e) => setStaffType(e.target.value as ProvisionRole)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:border-purple-600 focus:outline-none"
                  >
                    <option value="Doctor">Doctor</option>
                    <option value="Nurse">Nurse</option>
                    <option value="Receptionist">Receptionist</option>
                    <option value="Pharmacist">Pharmacist</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Department
                  </label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Urology / ICU"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:border-purple-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Official Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="doctor@hospital.com"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:border-purple-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Security Passcode
                  </label>
                  <button
                    type="button"
                    onClick={generatePasscode}
                    className="text-[10px] font-bold text-purple-700 hover:text-purple-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" /> Auto-Generate
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={temporaryPasscode}
                    onChange={(e) => setTemporaryPasscode(e.target.value)}
                    placeholder="Click Auto-Generate"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-purple-900 font-mono font-bold focus:border-purple-600 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs uppercase tracking-wider shadow-md transition cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                <span>Save Staff Credential</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          <div className="xl:col-span-8 rounded-2xl bg-white border border-slate-200 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Provisioned Team ({staffList.length})
              </h2>
              <div className="flex gap-2">
                <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold">
                  {doctorsCount} Doctors
                </span>
                <span className="px-2.5 py-1 rounded bg-teal-50 text-teal-700 text-xs font-bold">
                  {supportStaffCount} Support Staff
                </span>
              </div>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading credentials...</div>
            ) : staffList.length === 0 ? (
              <div className="py-12 text-center space-y-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Users className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-600">No staff members created yet.</p>
                <p className="text-[11px] text-slate-400">
                  Use the form on the left to add your first doctor or nurse.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase">
                    <tr>
                      <th className="py-3 px-4">Member & ID</th>
                      <th className="py-3 px-4">Role & Dept</th>
                      <th className="py-3 px-4">Security Passcode</th>
                      <th className="py-3 px-4 text-right">Copy Pass</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staffList.map((staff) => {
                      const isVisible = visibleKeys[staff.id];
                      return (
                        <tr key={staff.id} className="hover:bg-slate-50">
                          <td className="py-3.5 px-4 font-medium">
                            <span className="font-bold text-slate-900">{staff.full_name}</span>
                            <div className="text-[10px] font-mono text-slate-400">{staff.email}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {staff.staff_type} • {staff.department}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-900 border border-purple-200">
                              {isVisible ? staff.temporary_passcode : '••••••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setVisibleKeys((prev) => ({ ...prev, [staff.id]: !isVisible }))
                              }
                              className="ml-2 text-slate-400 hover:text-slate-700"
                            >
                              {isVisible ? (
                                <EyeOff className="w-3.5 h-3.5 inline" />
                              ) : (
                                <Eye className="w-3.5 h-3.5 inline" />
                              )}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => copyLoginPass(staff)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100"
                            >
                              {copiedId === staff.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-slate-600" />
                              )}
                            </button>
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
      </div>
    </div>
  );
}

export default function StaffCredentialsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
          Loading setup workspace...
        </div>
      }
    >
      <StaffCredentialsContent />
    </Suspense>
  );
}
