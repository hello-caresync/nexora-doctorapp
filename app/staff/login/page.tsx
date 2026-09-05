'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  HeartHandshake,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { toast } from 'sonner';
import { recordRealStaffLogin, type AuthenticatedUserPayload } from '@/lib/recordStaffLogin';
import {
  getStaffPortalSession,
  persistStaffPortalSession,
  type StaffPortalSession,
} from '@/lib/auth/ecosystem-sessions';
import { clearStaleAuthArtifacts, persistActiveSession } from '@/lib/auth/active-session';
import {
  authenticatePortalCredential,
  loadHospitalOptionsForLogin,
} from '@/lib/auth/staff-credential-auth';
import { saveDoctorSession } from '@/lib/doctor/session';

type HospitalOption = {
  id: string;
  name: string;
  location: string;
};

function StaffDoctorLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect');

  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState('HOSP-01');
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    clearStaleAuthArtifacts();

    const activeSession = getStaffPortalSession();
    const operationalRoles = ['Nurse', 'Receptionist', 'Pharmacist', 'Staff'];
    if (activeSession && operationalRoles.includes(activeSession.staff_type)) {
      const safeRedirect =
        redirectUrl &&
        redirectUrl.startsWith('/dashboard') &&
        redirectUrl !== '/staff/login'
          ? redirectUrl
          : '/dashboard';
      router.replace(safeRedirect);
      return;
    }

    void loadHospitalOptionsForLogin().then((options) => {
      setHospitals(options);
      setSelectedHospitalId((prev) =>
        options.some((option) => option.id === prev) ? prev : options[0]?.id ?? 'HOSP-01',
      );
      setIsReady(true);
    });
  }, [router, redirectUrl]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const result = await authenticatePortalCredential({
        email,
        passcode,
        hospitalId: selectedHospitalId,
        scope: 'operational_staff',
      });

      if (!result.ok) {
        if (result.error.includes('Hospital Admin')) {
          setErrorMessage('Admins must sign in via the Hospital Admin portal.');
          window.setTimeout(() => router.push('/admin/login'), 1800);
        } else {
          setErrorMessage(result.error);
        }
        return;
      }

      const user = result.user;

      if (user.staff_type === 'Admin') {
        setErrorMessage('Admins must sign in via the Hospital Admin portal.');
        window.setTimeout(() => router.push('/admin/login'), 1800);
        return;
      }

      void recordRealStaffLogin({
        id: user.id,
        hospital_id: user.hospital_id,
        hospital_name: user.hospital_name,
        full_name: user.full_name,
        staff_type: user.staff_type as AuthenticatedUserPayload['staff_type'],
        department: user.department,
        email: user.email,
        temporary_passcode: passcode.trim(),
        phone: user.phone,
        portal_access: user.staff_type === 'Doctor' ? '/doctor/workspace' : '/dashboard',
      });

      toast.success(`Welcome, ${user.full_name} (${user.staff_type})`);

      if (user.staff_type === 'Doctor') {
        saveDoctorSession({
          doctorId: user.id,
          doctorName: user.full_name,
          employeeId: user.id,
          fullName: user.full_name,
          department: user.department,
          specialization: user.department,
          email: user.email,
          hospitalCode: user.hospital_id,
          portalRoute: '/doctor/workspace',
        });
        router.push('/doctor/workspace');
        return;
      }

      const session: StaffPortalSession = {
        id: user.id,
        hospital_id: user.hospital_id,
        hospital_name: user.hospital_name,
        full_name: user.full_name,
        staff_type: user.staff_type,
        department: user.department,
        email: user.email,
        portal_access: '/dashboard',
      };

      persistActiveSession({
        id: session.id,
        hospital_id: session.hospital_id,
        hospital_name: session.hospital_name,
        full_name: session.full_name,
        staff_type: session.staff_type,
        department: session.department,
        email: session.email,
        portal_access: '/dashboard',
      });
      persistStaffPortalSession(session);
      document.cookie = `curasync_session_role=${encodeURIComponent(user.staff_type)}; path=/; max-age=86400; SameSite=Lax`;

      router.push('/dashboard');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  const selectedHospital = hospitals.find((hospital: HospitalOption) => hospital.id === selectedHospitalId);

  if (!isReady) {
    return (
      <div className="min-h-screen w-full bg-[#0a2e47] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0a2e47] text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans relative overflow-hidden select-none">
      <div className="absolute inset-0 bg-[radial-gradient(#144970_1.2px,transparent_1.2px)] [background-size:24px_24px] opacity-60 pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md mx-auto w-full flex items-center justify-between z-10 pt-2">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="text-xs font-semibold text-cyan-300/80 hover:text-cyan-200 transition-colors"
        >
          &larr; Workspace Directory
        </button>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#07253a] border border-[#144970] text-[10px] font-mono font-bold text-cyan-300">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span>HOSPITAL OS ACCESS</span>
        </div>
      </div>

      <div className="max-w-md w-full mx-auto my-auto p-8 rounded-3xl bg-white text-slate-800 shadow-2xl border border-slate-200 relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-cyan-50 border border-cyan-200 text-cyan-700 mb-1">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-700 block">
              Facility Credential Node
            </span>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-0.5">
              Staff &amp; Doctor Portal
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Authorized clinical personnel &amp; administrative staff access
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-600">
              <HeartHandshake className="w-3 h-3 text-cyan-700" />
              Staff
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800">
              <Stethoscope className="w-3 h-3" />
              Doctor
            </span>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
              Hospital Node
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
              <select
                value={selectedHospitalId}
                onChange={(e) => setSelectedHospitalId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:border-cyan-600 focus:bg-white appearance-none cursor-pointer"
              >
                {hospitals.length === 0 ? (
                  <option value="HOSP-01">HOSP-01 · Default node</option>
                ) : (
                  hospitals.map((hospital) => (
                    <option key={hospital.id} value={hospital.id}>
                      {hospital.name} ({hospital.id})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
              Hospital Login Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@regalhospital.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:border-cyan-600 focus:bg-white transition-all shadow-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
              Assigned Passcode Key
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="e.g. REGAL#2026@AS13"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-cyan-600 focus:bg-white transition-all shadow-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs uppercase tracking-wider transition duration-150 flex items-center justify-center gap-2 shadow-md shadow-cyan-900/20 active:scale-[0.99] cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating Clearance...</span>
              </>
            ) : (
              <>
                <span>Log In to Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-3 border-t border-slate-100 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-slate-400" />
          <span>Role-Scoped Access Control Active · {selectedHospital?.id ?? selectedHospitalId}</span>
        </div>
      </div>

      <footer className="max-w-md mx-auto w-full text-center text-[11px] text-cyan-300/70 py-2 z-10 font-mono">
        Regal Healthcare Platform &bull; Node {selectedHospital?.id ?? selectedHospitalId}
      </footer>
    </div>
  );
}

export default function StaffDoctorLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full bg-[#0a2e47] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-300" />
        </div>
      }
    >
      <StaffDoctorLoginForm />
    </Suspense>
  );
}
