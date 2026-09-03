'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Crown,
  Eye,
  EyeOff,
  KeyRound,
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

    const isEmailValid = SUPER_ADMIN_WHITELIST.includes(cleanEmail);
    const isPasscodeValid = VALID_PASSCODES.includes(cleanPasscode);

    if (!isEmailValid || !isPasscodeValid) {
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
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0b0f19] p-4 font-sans text-slate-100 select-none">
      <div className="pointer-events-none absolute top-1/4 left-1/2 h-[350px] w-[650px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-amber-500/15 via-purple-600/10 to-blue-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] opacity-40 [background-size:24px_24px]" />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/80 bg-white text-slate-900 shadow-2xl">
        <div className="relative border-b border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900 p-7 text-center text-white">
          <div className="mb-2 inline-flex rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-400 shadow-inner">
            <Crown className="h-7 w-7" />
          </div>
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
            <ShieldCheck className="h-3 w-3 text-amber-400" />
            LEVEL 0 PLATFORM ROOT
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Super Admin Gateway</h1>
          <p className="mt-1 text-xs text-slate-400">
            Multi-tenant isolation &amp; hospital node orchestration
          </p>
        </div>

        <div className="space-y-5 p-7">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-700">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSuperAdminLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold tracking-wider text-slate-600 uppercase">
                Platform Master Email
              </label>
              <div className="relative">
                <Mail className="absolute top-3.5 left-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="aishwaryaananya43@gmail.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-4 pl-10 text-sm font-medium text-slate-900 transition-all focus:border-amber-500 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold tracking-wider text-slate-600 uppercase">
                Root Security Passcode
              </label>
              <div className="relative">
                <KeyRound className="absolute top-3.5 left-3.5 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter OPS-RH-AS26-A113"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-10 pl-10 font-mono text-sm font-bold text-slate-900 transition-all focus:border-amber-500 focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-3 right-3.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/10 transition-all duration-150 hover:bg-slate-950 active:scale-[0.99] disabled:opacity-60"
            >
              <span>{loading ? 'Authenticating...' : 'Enter Root Console'}</span>
              <ArrowRight className="h-4 w-4 text-amber-400" />
            </button>
          </form>

          <div className="border-t border-slate-100 pt-2 text-center">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="text-xs font-semibold text-slate-400 transition-colors hover:text-slate-700"
            >
              &larr; Back to Workspace Selector
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
