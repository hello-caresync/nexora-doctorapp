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
} from 'lucide-react';
import { recordRealStaffLogin } from '@/lib/recordStaffLogin';
import {
  clearStaleAuthArtifacts,
  CURASYNC_ACTIVE_SESSION_KEY,
  parseActiveSession,
  persistActiveSession,
  type ActiveStaffSession,
} from '@/lib/auth/active-session';
import { isHospitalSetupCompleted, resolveAdminPostLoginRoute } from '@/lib/auth/admin-setup';
import { authenticateHospitalAdmin } from '@/lib/auth/hospital-admin-auth';
import { loadHospitalOptionsForLogin } from '@/lib/auth/staff-credential-auth';

type HospitalOption = {
  id: string;
  name: string;
  location: string;
};

function HospitalAdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect');
  const tenantId = searchParams.get('tenant') || 'HOSP-01';

  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState(tenantId);
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    clearStaleAuthArtifacts();

    const activeSession = parseActiveSession(localStorage.getItem(CURASYNC_ACTIVE_SESSION_KEY));
    if (activeSession?.staff_type === 'Admin') {
      void resolveAdminPostLoginRoute(activeSession.hospital_id).then((route) => {
        router.replace(redirectUrl || route);
      });
      return;
    }

    void loadHospitalOptionsForLogin().then((options) => {
      setHospitals(options);
      setSelectedHospitalId((prev) => {
        if (options.some((o) => o.id === tenantId)) return tenantId;
        if (options.some((o) => o.id === prev)) return prev;
        return options[0]?.id ?? 'HOSP-01';
      });
      setIsReady(true);
    });
  }, [router, redirectUrl, tenantId]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await authenticateHospitalAdmin(email, passcode, selectedHospitalId);

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      const user = result.admin;
      const portalAccess = user.portal_access || '/dashboard';

      void recordRealStaffLogin({
        id: user.id,
        hospital_id: user.hospital_id,
        hospital_name: user.hospital_name,
        full_name: user.full_name,
        staff_type: 'Admin',
        department: user.department,
        email: user.email,
        temporary_passcode: passcode.trim(),
        phone: user.phone,
        portal_access: portalAccess,
      });

      const session: ActiveStaffSession = {
        id: user.id,
        hospital_id: user.hospital_id,
        hospital_name: user.hospital_name,
        full_name: user.full_name,
        staff_type: 'Admin',
        department: user.department,
        email: user.email,
        portal_access: portalAccess,
      };

      persistActiveSession(session);
      localStorage.setItem('curasync_admin_role', 'admin');
      localStorage.setItem('admin_authenticated', 'true');

      const setupCompleted = await isHospitalSetupCompleted(user.hospital_id);
      const destination = setupCompleted
        ? redirectUrl && !redirectUrl.startsWith('/dashboard/staff-credentials')
          ? redirectUrl
          : '/dashboard'
        : `/dashboard/staff-credentials?hospitalId=${encodeURIComponent(user.hospital_id)}`;
      router.push(destination);
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
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 font-sans sm:p-8">
      <div className="grid min-h-[560px] w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:grid-cols-12">
        <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-8 text-white lg:col-span-5">
          <div className="relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-200">
              <HeartPulse className="h-4 w-4 animate-pulse text-rose-400" />
              <span>HOSPITAL ADMINISTRATION</span>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Facility Command Login</h2>
              <p className="text-xs leading-relaxed text-slate-300">
                Hospital leadership access for roster management, bed inventory, staff provisioning,
                and compliance operations.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-blue-400" />
              <div className="text-xs">
                <div className="font-bold text-white">Tenant-Scoped Admin</div>
                <div className="text-[11px] text-slate-400">Credentials are bound to your hospital node</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center p-8 sm:p-12 lg:col-span-7">
          <div className="mx-auto w-full max-w-md space-y-6">
            <div>
              <h3 className="text-xl font-black text-slate-900 sm:text-2xl">Hospital Admin Sign-In</h3>
              <p className="mt-1 text-xs text-slate-500">
                Select your hospital node and enter your provisioned administrator credentials.
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
                  Hospital Facility
                </label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={selectedHospitalId}
                    onChange={(e) => setSelectedHospitalId(e.target.value)}
                    className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-4 pl-10 text-xs font-medium text-slate-900 transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
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
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@regalhospital.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3.5 pl-10 text-xs font-medium text-slate-900 transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-10 pl-10 font-mono text-xs font-medium text-slate-900 transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
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
                className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-bold tracking-wider text-white uppercase shadow-md shadow-blue-600/20 transition hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verifying Admin Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Enter Admin Workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-[11px] text-slate-400">
              <span>Node: {selectedHospital?.name ?? selectedHospitalId}</span>
              <button type="button" onClick={() => router.push('/')} className="font-semibold text-blue-600">
                Portal Home
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HospitalAdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-100">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      }
    >
      <HospitalAdminLoginForm />
    </Suspense>
  );
}
