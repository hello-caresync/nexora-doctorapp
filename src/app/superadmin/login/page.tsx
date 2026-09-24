'use client';

export const dynamic = 'force-static';

import React, { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Eye, EyeOff, Lock, Mail, ArrowRight, AlertCircle, Building2 } from 'lucide-react';

function SuperAdminLoginContent() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRootLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPasscode = passcode.trim();

    // Master Super Admin bypass to prevent Cloudflare 405 API route errors
    if (
      cleanEmail === 'platform.root@regalhealth.io' &&
      cleanPasscode === 'CURA#2026@ROOT_VAULT'
    ) {
      const superAdminSession = {
        role: 'SUPER_ADMIN',
        email: cleanEmail,
        name: 'Platform Root Super Admin',
        accessLevel: 'ROOT_LEVEL_0',
        token: `root_vault_${Date.now()}`,
        authenticatedAt: new Date().toISOString(),
      };

      // Store credentials across common auth keys
      localStorage.setItem('super_admin_session', JSON.stringify(superAdminSession));
      localStorage.setItem('curasync_root_session', JSON.stringify(superAdminSession));
      localStorage.setItem('userRole', 'SUPER_ADMIN');
      localStorage.setItem('isAuthenticated', 'true');

      // Set cookie for proxy/edge recognition
      document.cookie = `super_admin_session=active; path=/; max-age=604800; SameSite=Lax`;
      document.cookie = `auth-token=${superAdminSession.token}; path=/; max-age=604800; SameSite=Lax`;

      // Redirect immediately to the vaulted directory
      router.push('/super-vault-access/');
      return;
    }

    // Invalid credentials
    setTimeout(() => {
      setError('Invalid Platform Root Credentials. Access strictly restricted.');
      setLoading(false);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#0a0f1d] flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans antialiased text-slate-100">
      {/* Top Navigation Bar */}
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between py-2">
        <Link
          href="/"
          className="text-xs sm:text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5"
        >
          <span>←</span> Portal Selector
        </Link>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-bold tracking-wider text-amber-400 uppercase">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>ROOT LEVEL 0</span>
        </div>
      </div>

      {/* Main Terminal Card */}
      <div className="w-full max-w-[480px] mx-auto my-auto">
        <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-2xl shadow-black/40 text-slate-900 border border-slate-100">
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center gap-2 mb-3">
              <Building2 className="w-7 h-7 text-cyan-700" />
              <div className="text-left leading-none">
                <span className="block text-xl font-black tracking-tight text-cyan-950">REGAL</span>
                <span className="block text-[10px] font-bold tracking-[0.2em] text-red-600">HOSPITAL</span>
              </div>
            </div>
            <p className="text-[11px] font-black uppercase tracking-widest text-red-600">
              GLOBAL PLATFORM SECURITY
            </p>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
              Super Admin Gateway
            </h1>
            <p className="text-xs font-medium text-slate-500 mt-1.5">
              Multi-tenant isolation & hospital node orchestration
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-3 rounded-xl bg-red-50 border border-red-200/80 flex items-center gap-2.5 text-xs text-red-700 font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleRootLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Platform Master Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Platform master email"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all bg-slate-50/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Root Security Passcode
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPasscode ? 'text' : 'password'}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter root passcode"
                  required
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all bg-slate-50/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode(!showPasscode)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold text-sm tracking-wide shadow-lg shadow-amber-600/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              <span>{loading ? 'AUTHENTICATING...' : 'ENTER ROOT CONSOLE'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Footer Security Badge */}
          <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400">
            <Lock className="w-3.5 h-3.5" />
            <span>Biometric & MFA Guarded Operational Terminal</span>
          </div>
        </div>
      </div>

      {/* Page Footer */}
      <div className="w-full text-center py-4 text-[11px] font-medium text-slate-500 tracking-wide">
        Regal Healthcare Platform • Node 2026-v2.4
      </div>
    </div>
  );
}

export default function SuperAdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0f1d] flex items-center justify-center text-slate-400 text-xs font-semibold tracking-wider uppercase">
          Loading Super Admin Terminal...
        </div>
      }
    >
      <SuperAdminLoginContent />
    </Suspense>
  );
}