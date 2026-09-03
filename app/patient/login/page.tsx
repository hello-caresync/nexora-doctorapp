'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import {
  ShieldCheck,
  Mail,
  Lock,
  Building2,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Phone,
  UserPlus,
  LogIn,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { setNexoraRoleCookie } from '@/lib/auth/role-cookies';
import { SESSION_KEYS } from '@/lib/auth/ecosystem-sessions';

const HOSPITALS = [
  { id: 'HOSP-01', name: 'Regal Hospital • Bengaluru' },
  { id: 'HOSP-02', name: 'Regal Multispeciality • North Wing' },
  { id: 'HOSP-03', name: 'Regal Cardiac & Trauma Centre' },
];

function persistPatientAuthSession(params: {
  id: string;
  email: string;
  fullName: string;
  hospital: string;
  phone?: string;
}) {
  const loginTime = new Date().toISOString();
  localStorage.setItem('curasync_active_patient_id', params.id);
  localStorage.setItem('curasync_patient_id', params.id);
  localStorage.setItem('curasync_patient_name', params.fullName);
  localStorage.setItem('patient_full_name', params.fullName);
  localStorage.setItem('curasync_patient_email', params.email);
  localStorage.setItem('curasync_selected_hospital', params.hospital);
  localStorage.setItem('selected_hospital_name', params.hospital);
  localStorage.setItem('curasync_patient_logged_in', 'true');
  localStorage.setItem(
    SESSION_KEYS.patient,
    JSON.stringify({
      email: params.email,
      patient_id: params.id,
      full_name: params.fullName,
      hospital: params.hospital,
      phone: params.phone,
      authenticated: true,
      login_time: loginTime,
    }),
  );
  setNexoraRoleCookie('patient');
}

function PatientLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/patient/dashboard';

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [selectedHospital, setSelectedHospital] = useState(HOSPITALS[0].name);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword || !fullName.trim()) {
      setErrorMessage('Please complete all required registration fields.');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: cleanPassword,
      options: {
        data: { full_name: fullName.trim(), phone: phone.trim(), hospital: selectedHospital },
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const patientId = data.user?.id ?? `PT-${Date.now()}`;
    persistPatientAuthSession({
      id: patientId,
      email: cleanEmail,
      fullName: fullName.trim(),
      hospital: selectedHospital,
      phone: phone.trim(),
    });

    router.push(redirectUrl);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanPassword = password.trim();

    if ((!cleanEmail && !cleanPhone) || !cleanPassword) {
      setErrorMessage('Enter your registered email or phone and password.');
      setLoading(false);
      return;
    }

    try {
      let patientData: { id: string; email: string; full_name: string } | null = null;

      if (cleanEmail) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (!authError && authData?.user) {
          patientData = {
            id: authData.user.id,
            email: authData.user.email ?? cleanEmail,
            full_name: String(authData.user.user_metadata?.full_name ?? 'Verified Patient'),
          };
        }
      }

      if (!patientData) {
        let query = supabase.from('patients').select('*');
        if (cleanEmail) query = query.eq('email', cleanEmail);
        else if (cleanPhone) query = query.eq('phone', cleanPhone);

        const { data: patientRow } = await query.maybeSingle();

        if (patientRow) {
          const row = patientRow as Record<string, unknown>;
          const stored = String(row.password ?? row.passcode ?? '');
          if (stored && stored !== cleanPassword) {
            throw new Error('Invalid email or password. Please verify your credentials.');
          }
          patientData = {
            id: String(row.id ?? ''),
            email: String(row.email ?? cleanEmail),
            full_name: String(row.full_name ?? row.name ?? 'Verified Patient'),
          };
        }
      }

      if (!patientData) {
        const { data: legacyUser } = await supabase
          .from('patient_users')
          .select('*')
          .eq('email', cleanEmail)
          .eq('password', cleanPassword)
          .maybeSingle();

        if (legacyUser) {
          patientData = {
            id: String(legacyUser.id ?? ''),
            email: cleanEmail,
            full_name: String(legacyUser.full_name ?? 'Verified Patient'),
          };
        }
      }

      if (!patientData) {
        throw new Error('Invalid email or password. Please verify your credentials.');
      }

      persistPatientAuthSession({
        id: patientData.id,
        email: patientData.email,
        fullName: patientData.full_name,
        hospital: selectedHospital,
        phone: cleanPhone || undefined,
      });

      router.push(redirectUrl);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Authentication failed.');
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-sky-50/60 to-emerald-50/40 p-4 font-sans sm:p-6">
      <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-cyan-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-emerald-200/40 blur-3xl" />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/90 p-8 shadow-xl backdrop-blur-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Patient Portal</h1>
          <p className="mt-1 text-xs font-semibold text-emerald-700">
            Secure access to appointments, queue tracking, and records
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`rounded-lg py-2 text-xs font-bold transition ${mode === 'login' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
          >
            <span className="inline-flex items-center gap-1"><LogIn className="h-3.5 w-3.5" /> Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`rounded-lg py-2 text-xs font-bold transition ${mode === 'register' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
          >
            <span className="inline-flex items-center gap-1"><UserPlus className="h-3.5 w-3.5" /> Register</span>
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {errorMessage}
          </div>
        )}

        <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase">
              <Building2 className="h-3.5 w-3.5" /> Hospital / Clinic
            </label>
            <select
              value={selectedHospital}
              onChange={(e) => setSelectedHospital(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500"
            >
              {HOSPITALS.map((h) => (
                <option key={h.id} value={h.name}>{h.name}</option>
              ))}
            </select>
          </div>

          {mode === 'register' && (
            <div>
              <label className="mb-1.5 text-[10px] font-bold text-slate-500 uppercase">Full Name</label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500"
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase">
              <Mail className="h-3.5 w-3.5" /> Email
            </label>
            <input
              type="email"
              required={mode === 'register'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="aishwarya@gmail.com"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase">
              <Phone className="h-3.5 w-3.5" /> Phone (optional for login)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase">
              <Lock className="h-3.5 w-3.5" /> Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-11 text-sm outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-emerald-500 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === 'login' ? 'Sign In To Patient Portal' : 'Create Patient Account'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

export default function PatientLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      }
    >
      <PatientLoginForm />
    </Suspense>
  );
}
