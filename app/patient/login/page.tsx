'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { setNexoraRoleCookie } from '@/lib/auth/role-cookies';
import { SESSION_KEYS } from '@/lib/auth/ecosystem-sessions';
import { loadHospitalOptionsForLogin } from '@/lib/auth/staff-credential-auth';
import { ensurePatientIdPersisted } from '@/lib/clinical/bridge';

type HospitalOption = {
  id: string;
  name: string;
  city?: string;
};

type HospitalQueryRow = {
  id?: unknown;
  name?: unknown;
  city?: unknown;
};

type PatientRecord = {
  id: string;
  uhid: string;
  full_name: string;
  email: string;
  phone: string;
};

function mintUhid(): string {
  return `NX-PAT-${Math.floor(1000 + Math.random() * 9000)}`;
}

function formatPhone(digits: string): string {
  const clean = digits.replace(/\D/g, '').slice(-10);
  return clean ? `+91 ${clean}` : '';
}

function serializeAuthError(err: unknown): string {
  if (!err) return 'Failed to complete request.';
  if (typeof err === 'string') {
    const trimmed = err.trim();
    return !trimmed || trimmed === '{}' ? 'Failed to complete request.' : trimmed;
  }

  if (typeof err === 'object') {
    const record = err as {
      message?: unknown;
      error_description?: unknown;
      details?: unknown;
      hint?: unknown;
      error?: unknown;
      msg?: unknown;
      code?: unknown;
    };
    const candidates = [record.message, record.error_description, record.details, record.hint, record.error, record.msg];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim() && candidate.trim() !== '{}') {
        return candidate.trim();
      }
    }

    try {
      const serialized = JSON.stringify(err);
      if (serialized && serialized !== '{}' && serialized !== '[]' && serialized !== 'null') {
        const code = typeof record.code === 'string' ? record.code : '';
        return code ? `${code}: ${serialized}` : serialized;
      }
    } catch {
      /* ignore circular errors */
    }

    if (typeof record.code === 'string' && record.code.trim()) {
      return `Request failed (${record.code}).`;
    }
  }

  return 'Failed to complete request.';
}

function persistPatientAuthSession(params: {
  id: string;
  uhid: string;
  email: string;
  fullName: string;
  hospitalId: string;
  hospitalName: string;
  phone?: string;
}) {
  const loginTime = new Date().toISOString();
  const payload = {
    uhid: params.uhid,
    patient_id: params.id,
    patient_name: params.fullName,
    full_name: params.fullName,
    email: params.email,
    phone: params.phone,
    hospital_id: params.hospitalId,
    hospital_name: params.hospitalName,
    hospital: params.hospitalName,
    role: 'patient',
    authenticated: true,
    authenticatedAt: loginTime,
    login_time: loginTime,
  };

  localStorage.setItem('curasync_active_patient_id', params.id);
  localStorage.setItem('curasync_patient_id', params.id);
  localStorage.setItem('curasync_patient_name', params.fullName);
  localStorage.setItem('patient_full_name', params.fullName);
  localStorage.setItem('curasync_patient_email', params.email);
  localStorage.setItem('curasync_selected_hospital', params.hospitalName);
  localStorage.setItem('selected_hospital_name', params.hospitalName);
  localStorage.setItem('curasync_patient_logged_in', 'true');
  localStorage.setItem(SESSION_KEYS.patient, JSON.stringify(payload));
  setNexoraRoleCookie('patient');
  ensurePatientIdPersisted(params.id);
}

function pickDefaultHospitalId(options: HospitalOption[]): string {
  const primary =
    options.find((hospital: HospitalOption) => hospital.id === 'HOSP-01') ||
    options.find((hospital: HospitalOption) => /regal/i.test(hospital.name));
  return primary?.id || options[0]?.id || 'HOSP-01';
}

async function insertPatientRecord(payload: Record<string, unknown>): Promise<string | null> {
  const attempts = [
    { table: 'hospital_patients', payload },
    {
      table: 'patients',
      payload: {
        id: payload.id,
        hospital_id: payload.hospital_id,
        uhid: payload.uhid,
        full_name: payload.full_name,
        name: payload.full_name,
        email: payload.email,
        phone: payload.phone,
        gender: payload.gender,
        age: payload.age,
        password: payload.passcode,
        passcode: payload.passcode,
        status: 'Active',
      },
    },
    {
      table: 'patient_users',
      payload: {
        id: payload.id,
        hospital_id: payload.hospital_id,
        full_name: payload.full_name,
        email: payload.email,
        phone: payload.phone,
        password: payload.passcode,
      },
    },
  ];

  let lastError: string | null = 'Unable to create patient EMR record.';
  for (const attempt of attempts) {
    const { error } = await supabase.from(attempt.table).insert(attempt.payload);
    if (!error) return null;
    lastError = serializeAuthError(error);
  }
  return lastError;
}

async function lookupScopedPatient(params: {
  hospitalId: string;
  email?: string;
  phone?: string;
}): Promise<(PatientRecord & { passcode?: string }) | null> {
  const phoneVariants = params.phone
    ? Array.from(new Set([params.phone, formatPhone(params.phone), params.phone.replace(/\D/g, '')]))
    : [];

  const tables = ['hospital_patients', 'patients', 'patient_users'] as const;

  for (const table of tables) {
    let query = supabase.from(table).select('*').eq('hospital_id', params.hospitalId);

    if (params.email) {
      query = query.eq('email', params.email);
    } else if (phoneVariants.length > 0) {
      query = query.in('phone', phoneVariants);
    } else {
      continue;
    }

    const { data, error } = await query.limit(1).maybeSingle();
    if (error || !data) continue;

    const row = data as Record<string, unknown>;
    return {
      id: String(row.id ?? ''),
      uhid: String(row.uhid ?? row.id ?? ''),
      full_name: String(row.full_name ?? row.patient_name ?? row.name ?? 'Verified Patient'),
      email: String(row.email ?? params.email ?? ''),
      phone: String(row.phone ?? params.phone ?? ''),
      passcode: String(row.passcode ?? row.password ?? ''),
    };
  }

  return null;
}

function PatientAuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || searchParams.get('next') || '/patient/dashboard';

  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState('HOSP-01');

  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Female');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    void (async () => {
      const options = await loadHospitalOptionsForLogin();
      if (options.length > 0) {
        const mapped = options.map((hospital: { id: string; name: string; location: string }): HospitalOption => ({
          id: hospital.id,
          name: hospital.name,
          city: hospital.location,
        }));
        setHospitals(mapped);
        setSelectedHospitalId(pickDefaultHospitalId(mapped));
        return;
      }

      const { data } = await supabase.from('hospitals').select('id, name, city').order('name', { ascending: true });
      if (data && data.length > 0) {
        const mapped = (data as HospitalQueryRow[]).map((row: HospitalQueryRow): HospitalOption => ({
          id: String(row.id ?? ''),
          name: String(row.name ?? ''),
          city: row.city ? String(row.city) : undefined,
        }));
        setHospitals(mapped);
        setSelectedHospitalId(pickDefaultHospitalId(mapped));
      }
    })();
  }, []);

  const selectedHospital = hospitals.find((hospital: HospitalOption) => hospital.id === selectedHospitalId);

  const completeLogin = (patient: PatientRecord) => {
    persistPatientAuthSession({
      id: patient.id,
      uhid: patient.uhid,
      email: patient.email,
      fullName: patient.full_name,
      hospitalId: selectedHospitalId,
      hospitalName: selectedHospital?.name || 'Regal Hospital',
      phone: patient.phone,
    });
    toast.success(`Welcome to ${selectedHospital?.name || 'Patient Portal'}`);
    router.push(redirectUrl.startsWith('/patient') ? redirectUrl : '/patient/dashboard');
  };

  const handleAuthSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.replace(/\D/g, '').slice(0, 10);
    const cleanPassword = password.trim();

    try {
      if (!selectedHospitalId) {
        throw new Error('Select your hospital node before continuing.');
      }

      if (authMode === 'signin') {
        if (!cleanEmail && !cleanPhone) {
          throw new Error('Please enter your registered email or phone number.');
        }
        if (!cleanPassword) {
          throw new Error('Password is required.');
        }

        if (cleanEmail) {
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: cleanPassword,
          });

          if (!authError && authData.user) {
            const emr = await lookupScopedPatient({
              hospitalId: selectedHospitalId,
              email: cleanEmail,
              phone: cleanPhone || undefined,
            });
            completeLogin({
              id: emr?.id || authData.user.id,
              uhid: emr?.uhid || mintUhid(),
              full_name: emr?.full_name || String(authData.user.user_metadata?.full_name ?? 'Verified Patient'),
              email: authData.user.email ?? cleanEmail,
              phone: emr?.phone || formatPhone(cleanPhone),
            });
            return;
          }
        }

        const emr = await lookupScopedPatient({
          hospitalId: selectedHospitalId,
          email: cleanEmail || undefined,
          phone: cleanPhone || undefined,
        });

        if (!emr || !emr.passcode || emr.passcode !== cleanPassword) {
          throw new Error('Invalid credentials for this hospital node.');
        }

        completeLogin(emr);
        return;
      }

      if (!fullName.trim() || !cleanPhone || !cleanPassword) {
        throw new Error('Full name, mobile number, and password are required for registration.');
      }

      const generatedUhid = mintUhid();
      const formattedPhone = formatPhone(cleanPhone);
      const ageNumber = age ? Number(age) : null;

      let patientId = crypto.randomUUID();

      if (cleanEmail) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: {
              full_name: fullName.trim(),
              phone: formattedPhone,
              hospital_id: selectedHospitalId,
              uhid: generatedUhid,
              gender,
              age: ageNumber,
            },
          },
        });

        if (signUpError) {
          throw signUpError;
        }
        if (signUpData.user?.id) {
          patientId = signUpData.user.id;
        }
      }

      const insertError = await insertPatientRecord({
        id: patientId,
        hospital_id: selectedHospitalId,
        uhid: generatedUhid,
        full_name: fullName.trim(),
        email: cleanEmail || null,
        phone: formattedPhone,
        gender,
        age: ageNumber,
        passcode: cleanPassword,
        status: 'Active',
      });

      if (insertError) {
        throw insertError;
      }

      toast.success(`Account registered with UHID ${generatedUhid}`);
      completeLogin({
        id: patientId,
        uhid: generatedUhid,
        full_name: fullName.trim(),
        email: cleanEmail,
        phone: formattedPhone,
      });
    } catch (err: unknown) {
      const msg =
        serializeAuthError(err) ||
        (typeof err === 'string' ? err : 'Failed to complete request.');
      setErrorMessage(msg === '{}' ? 'Failed to complete request.' : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans relative overflow-hidden select-none">
      <div className="absolute inset-0 bg-[radial-gradient(#153238_1.2px,transparent_1.2px)] [background-size:24px_24px] opacity-70 pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md mx-auto w-full flex items-center justify-between z-10 pt-2">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="text-xs font-semibold text-emerald-300/80 hover:text-emerald-200 transition-colors"
        >
          &larr; Workspace Directory
        </button>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800 text-[10px] font-mono font-bold text-emerald-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>PATIENT ENCOUNTER CLOUD</span>
        </div>
      </div>

      <div className="max-w-md w-full mx-auto my-auto p-8 rounded-3xl bg-white backdrop-blur-xl text-slate-950 shadow-2xl border border-slate-200 relative z-10 space-y-5">
        <div className="text-center space-y-1.5">
          <div className="inline-flex p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-xs mb-1">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950">Patient Portal</h1>
          <p className="text-xs font-medium text-slate-600">Secure access to appointments, queue tracking, and records</p>
        </div>

        <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100 border border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setAuthMode('signin');
              setErrorMessage(null);
            }}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              authMode === 'signin' ? 'bg-white text-emerald-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setErrorMessage(null);
            }}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              authMode === 'register' ? 'bg-white text-emerald-900 shadow-xs font-black' : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            Register New
          </button>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
            {typeof errorMessage === 'string' ? errorMessage : serializeAuthError(errorMessage)}
          </div>
        )}

        <form onSubmit={handleAuthSubmit} className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              Hospital / Healthcare Clinic
            </label>
            <div className="relative">
              <select
                value={selectedHospitalId}
                onChange={(e) => setSelectedHospitalId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-950 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition appearance-none cursor-pointer"
              >
                {hospitals.length === 0 ? (
                  <option value="HOSP-01">Regal Hospital (Bengaluru) - HOSP-01</option>
                ) : (
                  hospitals.map((hospital: HospitalOption) => (
                    <option key={hospital.id} value={hospital.id}>
                      {hospital.name} {hospital.city ? `(${hospital.city})` : ''} - {hospital.id}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {authMode === 'register' && (
            <>
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  Patient Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Gowda"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-950 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-900">Age</label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    placeholder="32"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-950 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-900">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-950 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-emerald-600" />
              Email Address {authMode === 'signin' ? '' : '(Optional)'}
            </label>
            <input
              type="email"
              required={authMode === 'signin' && phone.length === 0}
              placeholder="patient@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-950 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              Mobile Phone {authMode === 'signin' ? '(Optional)' : '* Required'}
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-xs font-mono font-bold text-slate-700">+91</span>
              <input
                type="tel"
                required={authMode === 'register'}
                maxLength={10}
                placeholder="98450 12345"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-3.5 py-2.5 text-xs font-mono font-bold text-slate-950 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              Password Key
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Enter access password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 pr-10 py-2.5 text-xs font-bold text-slate-950 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-emerald-700/20 active:scale-[0.99] transition cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            <span>
              {loading
                ? 'Validating Profile...'
                : authMode === 'signin'
                  ? 'Sign In To Patient Portal'
                  : 'Register & Enter Portal'}
            </span>
          </button>
        </form>

          <div className="pt-2 border-t border-slate-100 text-center text-[10px] text-slate-500 font-medium">
          Protected by End-to-End Hospital OS Encryption
        </div>
      </div>

      <footer className="max-w-md mx-auto w-full text-center text-[11px] text-emerald-300/70 py-2 z-10 font-mono">
        Regal Healthcare Network &bull; Patient Node {selectedHospitalId}
      </footer>
    </div>
  );
}

export default function PatientAuthPortal() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        </div>
      }
    >
      <PatientAuthForm />
    </Suspense>
  );
}
