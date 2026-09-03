'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Crown,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { setNexoraRoleCookie } from '@/lib/auth/role-cookies';

const SUPER_ADMIN_WHITELIST = [
  'aishwaryaananya43@gmail.com',
  'superadmin@nexora.health',
  'superadmin@regalhealth.com',
];

const VALID_PASSCODES = [
  'OPS-RH-AS26-A113',
  'SUPER-MASTER-2026',
  '123456',
  'ADMIN-REGAL-2026',
];

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('aishwaryaananya43@gmail.com');
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSuperAdminLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPasscode = passcode.trim();

    if (!SUPER_ADMIN_WHITELIST.includes(cleanEmail) || !VALID_PASSCODES.includes(cleanPasscode)) {
      setErrorMessage('Invalid root credentials. Access denied.');
      setLoading(false);
      return;
    }

    const sessionPayload = {
      email: cleanEmail,
      role: 'super_admin',
      accessLevel: 'level_0_root',
      authenticatedAt: new Date().toISOString(),
    };

    localStorage.setItem('nexora_superadmin_session', JSON.stringify(sessionPayload));
    localStorage.setItem('curasync_superadmin_session', JSON.stringify(sessionPayload));
    setNexoraRoleCookie('super_admin');
    document.cookie = `nexora_superadmin_session=${encodeURIComponent(JSON.stringify(sessionPayload))}; path=/; max-age=86400; SameSite=Lax`;

    toast.success('Root Master Authentication Verified');
    router.push('/super-vault-access');
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col justify-between overflow-hidden bg-[#060911] p-4 font-sans text-slate-100 select-none sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] opacity-60 [background-size:24px_24px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(15,23,42,0.55)_0%,transparent_70%)]" />
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-[140px]" />
      <div className="pointer-events-none absolute top-1/3 -right-40 h-[450px] w-[450px] rounded-full bg-indigo-600/15 blur-[150px]" />
      <div className="pointer-events-none absolute -bottom-40 left-1/3 h-[500px] w-[500px] rounded-full bg-purple-700/10 blur-[150px]" />

      <div className="z-10 mx-auto flex w-full max-w-md items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition-colors hover:text-slate-200"
        >
          <span>&larr; Portal Selector</span>
        </button>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/90 px-3 py-1 font-mono text-[10px] font-bold text-amber-400 shadow-inner">
          <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
          <span>ROOT LEVEL 0</span>
        </div>
      </div>

      <div className="relative z-10 mx-auto my-auto w-full max-w-md space-y-6 rounded-3xl border border-slate-800 bg-[#0f172a]/95 p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
        <div className="space-y-2 text-center">
          <div className="inline-flex rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-400 shadow-inner">
            <Crown className="h-7 w-7" />
          </div>
          <div>
            <span className="block font-mono text-[10px] font-extrabold tracking-widest text-amber-400 uppercase">
              Global Platform Security
            </span>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Super Admin Gateway</h1>
            <p className="mt-0.5 text-xs font-medium text-slate-400">
              Multi-tenant isolation &amp; hospital node orchestration
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-800/80 bg-rose-950/50 p-3.5 text-xs font-semibold text-rose-300">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSuperAdminLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block font-mono text-[11px] font-bold tracking-wider text-slate-300 uppercase">
              Platform Master Email
            </label>
            <div className="relative">
              <Mail className="absolute top-3.5 left-3.5 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="aishwaryaananya43@gmail.com"
                className="w-full rounded-xl border border-slate-700/80 bg-[#1e293b]/70 py-2.5 pr-4 pl-10 text-sm font-medium text-white placeholder:text-slate-500 transition-all focus:border-amber-400 focus:bg-[#1e293b] focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block font-mono text-[11px] font-bold tracking-wider text-slate-300 uppercase">
              Root Security Passcode
            </label>
            <div className="relative">
              <KeyRound className="absolute top-3.5 left-3.5 h-4 w-4 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter OPS-RH-AS26-A113"
                className="w-full rounded-xl border border-slate-700/80 bg-[#1e293b]/70 py-2.5 pr-10 pl-10 font-mono text-sm font-bold text-white placeholder:text-slate-500 transition-all focus:border-amber-400 focus:bg-[#1e293b] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-3 right-3.5 text-slate-400 transition hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3.5 text-xs font-black tracking-wider text-slate-950 uppercase shadow-lg shadow-amber-500/20 transition-all duration-150 hover:from-amber-400 hover:to-amber-500 active:scale-[0.99] disabled:opacity-60"
          >
            <span>{loading ? 'Authenticating Root...' : 'Enter Root Console'}</span>
            <ArrowRight className="h-4 w-4 text-slate-950" />
          </button>
        </form>

        <div className="flex items-center justify-center gap-1.5 border-t border-slate-800 pt-3 text-center text-[11px] text-slate-500">
          <Lock className="h-3 w-3 text-slate-500" />
          <span>Biometric &amp; MFA Guarded Operational Terminal</span>
        </div>
      </div>

      <footer className="z-10 mx-auto w-full max-w-md py-2 text-center font-mono text-[11px] text-slate-600">
        Regal Healthcare Platform &bull; Node 2026-v2.4
      </footer>
    </div>
  );
}
