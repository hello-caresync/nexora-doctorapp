'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Lock,
  Mail,
  Building2,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Stethoscope,
  HeartPulse,
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { recordRealStaffLogin } from '@/lib/recordStaffLogin';
import {
  clearStaleAuthArtifacts,
  CURASYNC_ACTIVE_SESSION_KEY,
  parseActiveSession,
  persistActiveSession,
  resolvePostLoginRoute,
  type ActiveStaffSession,
} from '@/lib/auth/active-session';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const FALLBACK_HOSPITALS = [
  { id: 'HOSP-01', name: 'Regal Hospital Main', location: 'Bengaluru' },
  { id: 'HOSP-02', name: 'Apollo Super Speciality', location: 'Bengaluru' },
  { id: 'HOSP-03', name: 'Manipal Health Institute', location: 'Bengaluru' },
];

type HospitalOption = {
  id: string;
  name: string;
  location: string;
};

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect');

  const [hospitals, setHospitals] = useState<HospitalOption[]>(FALLBACK_HOSPITALS);
  const [selectedHospitalId, setSelectedHospitalId] = useState('HOSP-01');
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPageReady, setIsPageReady] = useState(false);

  const loadHospitalOptions = async () => {
    if (!supabase) return;

    const { data: tenants } = await supabase
      .from('hospital_tenants')
      .select('hospital_id, hospital_name, city')
      .order('hospital_name', { ascending: true });

    if (tenants?.length) {
      const options = tenants.map((row) => ({
        id: String(row.hospital_id),
        name: String(row.hospital_name),
        location: String(row.city ?? 'Bengaluru'),
      }));
      setHospitals(options);
      setSelectedHospitalId((prev) =>
        options.some((o) => o.id === prev) ? prev : options[0].id,
      );
      return;
    }

    const { data: credentials } = await supabase
      .from('hospital_staff_credentials')
      .select('hospital_id, hospital_name')
      .order('hospital_name', { ascending: true });

    if (credentials?.length) {
      const seen = new Set<string>();
      const options = credentials
        .filter((row) => {
          const id = String(row.hospital_id);
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .map((row) => ({
          id: String(row.hospital_id),
          name: String(row.hospital_name),
          location: 'Bengaluru',
        }));

      if (options.length > 0) {
        setHospitals(options);
        setSelectedHospitalId((prev) =>
          options.some((o) => o.id === prev) ? prev : options[0].id,
        );
      }
    }
  };

  useEffect(() => {
    clearStaleAuthArtifacts();

    const activeSession = parseActiveSession(localStorage.getItem(CURASYNC_ACTIVE_SESSION_KEY));
    if (activeSession) {
      router.replace(
        resolvePostLoginRoute(activeSession.staff_type, activeSession.portal_access),
      );
      return;
    }

    localStorage.removeItem(CURASYNC_ACTIVE_SESSION_KEY);
    setIsPageReady(true);
    void loadHospitalOptions();

    if (!supabase) return;

    const channel = supabase
      .channel('login_hospital_tenants_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hospital_tenants' }, () => {
        void loadHospitalOptions();
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hospital_staff_credentials' },
        () => {
          void loadHospitalOptions();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPasscode = passcode.trim();

    if (!cleanEmail || !cleanPasscode) {
      setErrorMessage('Please enter both your official email and security passcode.');
      setIsSubmitting(false);
      return;
    }

    try {
      if (!supabase) {
        throw new Error('Database client unavailable. Please check configuration.');
      }

      const { data: user, error } = await supabase
        .from('hospital_staff_credentials')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (error || !user) {
        throw new Error('No staff or doctor account found with this email address.');
      }

      if (selectedHospitalId && user.hospital_id !== selectedHospitalId) {
        throw new Error('This account is not registered under the selected hospital tenant.');
      }

      if (user.temporary_passcode !== cleanPasscode) {
        throw new Error('Invalid security passcode. Please verify your credentials.');
      }

      const portalAccess = user.portal_access || '/dashboard';

      await recordRealStaffLogin({
        id: user.id,
        hospital_id: user.hospital_id,
        hospital_name: user.hospital_name,
        full_name: user.full_name,
        staff_type: user.staff_type,
        department: user.department,
        email: user.email,
        temporary_passcode: cleanPasscode,
        phone: user.phone ?? undefined,
        portal_access: portalAccess,
      });

      const session: ActiveStaffSession = {
        id: user.id,
        hospital_id: user.hospital_id,
        hospital_name: user.hospital_name,
        full_name: user.full_name,
        staff_type: user.staff_type,
        department: user.department,
        email: user.email,
        portal_access: portalAccess,
      };

      persistActiveSession(session);

      const destination =
        user.staff_type === 'Admin'
          ? resolvePostLoginRoute('Admin', portalAccess)
          : redirectUrl || resolvePostLoginRoute(user.staff_type, portalAccess);

      router.push(destination);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Authentication failed. Please verify your credentials.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedHospital = hospitals.find((h) => h.id === selectedHospitalId);

  if (!isPageReady) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-10 font-sans">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[600px]">
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 sm:p-10 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

          <div className="space-y-6 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-mono font-semibold text-indigo-200">
              <HeartPulse className="w-4 h-4 text-rose-400 animate-pulse" />
              <span>CLINICAL OS PLATFORM</span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Hospital Staff Authentication
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Role-based access gateway for doctors, nurses, receptionists, pharmacists, and
                administrative heads.
              </p>
            </div>

            <div className="space-y-3 pt-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" />
                <div className="text-xs">
                  <div className="font-bold text-white">Multi-Tenant Isolation</div>
                  <div className="text-slate-400 text-[11px]">Strict hospital-scoped data segregation</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <Stethoscope className="w-5 h-5 text-cyan-400 shrink-0" />
                <div className="text-xs">
                  <div className="font-bold text-white">Direct Workspace Routing</div>
                  <div className="text-slate-400 text-[11px]">
                    Admins provision staff first; clinicians enter their queue
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400 relative z-10">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Live Security Engine
            </span>
            <span>v2.4 Enterprise</span>
          </div>
        </div>

        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-center bg-white">
          <div className="w-full max-w-md mx-auto space-y-6">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Sign In to Your Workspace
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Select your hospital node and enter your provisioned staff credentials.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Select Hospital Facility
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={selectedHospitalId}
                    onChange={(e) => setSelectedHospitalId(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition appearance-none cursor-pointer"
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
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Official Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. admin@regalhospital.com"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs font-medium focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Security Passcode
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Enter your security passcode"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs font-mono font-medium focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-indigo-600/20 transition cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Authenticate & Enter Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>Active Node: {selectedHospital?.name ?? selectedHospitalId}</span>
              <span className="text-indigo-600 font-semibold">Regal Health Network</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HospitalLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
