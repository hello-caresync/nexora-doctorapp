'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  HeartPulse,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Stethoscope,
  Users2,
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { recordRealStaffLogin, type AuthenticatedUserPayload } from '@/lib/recordStaffLogin';
import {
  getStaffPortalSession,
  persistStaffPortalSession,
  resolveStaffDepartmentRoute,
  type StaffPortalSession,
} from '@/lib/auth/ecosystem-sessions';
import {
  clearStaleAuthArtifacts,
} from '@/lib/auth/active-session';
import {
  authenticatePortalCredential,
  loadHospitalOptionsForLogin,
} from '@/lib/auth/staff-credential-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

type HospitalOption = {
  id: string;
  name: string;
  location: string;
};

function HospitalStaffLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect');

  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState('HOSP-01');
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    clearStaleAuthArtifacts();

    const activeSession = getStaffPortalSession();
    if (activeSession && activeSession.staff_type !== 'Admin') {
      const safeRedirect =
        redirectUrl &&
        redirectUrl !== '/staff/login' &&
        !redirectUrl.startsWith('/staff/login')
          ? redirectUrl
          : null;
      router.replace(safeRedirect || resolveStaffDepartmentRoute(activeSession.staff_type));
      return;
    }

    void loadHospitalOptionsForLogin().then((options) => {
      setHospitals(options);
      setSelectedHospitalId((prev) =>
        options.some((o) => o.id === prev) ? prev : options[0]?.id ?? 'HOSP-01',
      );
      setIsReady(true);
    });

    if (!supabase) return;

    const channel = supabase
      .channel('staff_login_hospital_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hospital_tenants' }, () => {
        void loadHospitalOptionsForLogin().then(setHospitals);
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hospital_staff_credentials' },
        () => {
          void loadHospitalOptionsForLogin().then(setHospitals);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router, redirectUrl]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

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

      const portalAccess = resolveStaffDepartmentRoute(user.staff_type);

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
        portal_access: portalAccess,
      });

      const session: StaffPortalSession = {
        id: user.id,
        hospital_id: user.hospital_id,
        hospital_name: user.hospital_name,
        full_name: user.full_name,
        staff_type: user.staff_type,
        department: user.department,
        email: user.email,
        portal_access: portalAccess,
      };

      persistStaffPortalSession(session);

      router.push(redirectUrl || portalAccess);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Authentication failed. Please verify your credentials.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedHospital = hospitals.find((h) => h.id === selectedHospitalId);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 font-sans sm:p-6 lg:p-10">
      <div className="grid min-h-[600px] w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:grid-cols-12">
        <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 text-white sm:p-10 lg:col-span-5">
          <div className="relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 font-mono text-xs font-semibold text-indigo-200">
              <HeartPulse className="h-4 w-4 animate-pulse text-rose-400" />
              <span>OPERATIONAL STAFF GATEWAY</span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
                Hospital Staff Authentication
              </h2>
              <p className="text-xs leading-relaxed text-slate-300">
                Sign in with admin-provisioned credentials for nursing, pharmacy, reception, and
                clinical support roles.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <ShieldCheck className="h-5 w-5 shrink-0 text-indigo-400" />
                <div className="text-xs">
                  <div className="font-bold text-white">Provisioned Credentials Only</div>
                  <div className="text-[11px] text-slate-400">
                    Verified against live staff records in Supabase
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <Users2 className="h-5 w-5 shrink-0 text-cyan-400" />
                <div className="text-xs">
                  <div className="font-bold text-white">Direct Workspace Routing</div>
                  <div className="text-[11px] text-slate-400">
                    Routes to your assigned department portal — not admin setup
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <Stethoscope className="h-5 w-5 shrink-0 text-teal-400" />
                <div className="text-xs">
                  <div className="font-bold text-white">Doctors Use Clinician Portal</div>
                  <div className="text-[11px] text-slate-400">
                    Clinicians should sign in via the Doctor Portal card on the home screen
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 border-t border-white/10 pt-6 text-[11px] text-slate-400">
            Regal Health Network • Staff Access Layer
          </div>
        </div>

        <div className="flex flex-col justify-center bg-white p-8 sm:p-12 lg:col-span-7">
          <div className="mx-auto w-full max-w-md space-y-6">
            <div>
              <h3 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                Sign In to Your Workspace
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Select your hospital node and enter your provisioned staff credentials.
              </p>
            </div>

            {errorMessage && (
              <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold tracking-wider text-slate-700 uppercase">
                  Select Hospital Facility
                </label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={selectedHospitalId}
                    onChange={(e) => setSelectedHospitalId(e.target.value)}
                    className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-4 pl-10 text-xs font-medium text-slate-900 transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                  >
                    {hospitals.map((hosp) => (
                      <option key={hosp.id} value={hosp.id}>
                        {hosp.name} ({hosp.location})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold tracking-wider text-slate-700 uppercase">
                  Official Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. nurse@regalhospital.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3.5 pl-10 text-xs font-medium text-slate-900 transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold tracking-wider text-slate-700 uppercase">
                  Security Passcode
                </label>
                <div className="relative">
                  <Lock className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPasscode ? 'text' : 'password'}
                    required
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Enter your security passcode"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-10 pl-10 font-mono text-xs font-medium text-slate-900 transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    className="absolute top-1/2 right-3.5 -translate-y-1/2 cursor-pointer text-slate-400 transition hover:text-slate-700"
                  >
                    {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold tracking-wider text-white uppercase shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Authenticate & Enter Workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-[11px] text-slate-400">
              <span>Active Node: {selectedHospital?.name ?? selectedHospitalId}</span>
              <button type="button" onClick={() => router.push('/')} className="font-semibold text-indigo-600">
                Portal Home
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HospitalStaffLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-100">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      }
    >
      <HospitalStaffLoginForm />
    </Suspense>
  );
}
