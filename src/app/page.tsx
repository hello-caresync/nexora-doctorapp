'use client';

export const dynamic = 'force-static';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Building2, 
  ShieldCheck, 
  Stethoscope, 
  UserCheck, 
  ArrowRight, 
  Activity, 
  Lock 
} from 'lucide-react';

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0a0f1d] flex flex-col items-center justify-center text-slate-300 gap-3 font-sans">
        <Activity className="w-8 h-8 text-cyan-500 animate-spin" />
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Initializing Nexora Healthcare Node...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-slate-100 font-sans antialiased flex flex-col justify-between selection:bg-cyan-500 selection:text-white">
      {/* Top Navigation */}
      <header className="w-full border-b border-slate-800/80 bg-[#0a0f1d]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-cyan-500" />
            <div className="flex flex-col">
              <span className="text-base font-black tracking-tight text-white leading-tight">
                NEXORA
              </span>
              <span className="text-[9px] font-bold tracking-[0.25em] text-red-500 uppercase leading-none">
                REGAL HEALTHCARE
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Node Active
            </span>
          </div>
        </div>
      </header>

      {/* Hero & Portal Selection */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 my-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-4">
            Unified Clinical & Administrative Gateway
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Regal Healthcare Operational Terminals
          </h1>
          <p className="mt-4 text-sm sm:text-base text-slate-400 leading-relaxed max-w-2xl mx-auto">
            Select your assigned node terminal to access medical registries, patient queue orchestration, clinical diagnostics, or platform governance.
          </p>
        </div>

        {/* Portal Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Doctor Portal */}
          <Link
            href="/doctor/login/"
            className="group relative bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-3xl p-6 sm:p-8 transition-all duration-300 flex flex-col justify-between hover:shadow-2xl hover:shadow-cyan-500/10"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6 group-hover:scale-110 transition-transform">
                <Stethoscope className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">
                Physician & Doctor
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
                Consultation schedules, EHR diagnostic access, automated prescription engines, and real-time patient charts.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-cyan-400">
              <span>Access Clinic Terminal</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Hospital Staff Portal */}
          <Link
            href="/staff/login/"
            className="group relative bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-3xl p-6 sm:p-8 transition-all duration-300 flex flex-col justify-between hover:shadow-2xl hover:shadow-emerald-500/10"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                Hospital Staff & Reception
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
                Front-desk registration, OPD token dispatch, patient check-in workflows, and appointment desk management.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-emerald-400">
              <span>Access Desk Terminal</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Super Admin Vault */}
          <Link
            href="/superadmin/login/"
            className="group relative bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-3xl p-6 sm:p-8 transition-all duration-300 flex flex-col justify-between hover:shadow-2xl hover:shadow-amber-500/10"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-6 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                  Super Admin
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-wider">
                  ROOT 0
                </span>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
                Hospital node orchestration, master access control, personnel database management, and platform security.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-amber-400">
              <span>Enter Root Gateway</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </main>

      {/* Global Footer */}
      <footer className="w-full border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Lock className="w-3.5 h-3.5 text-slate-500" />
          <span>Encrypted Multi-Tenant Hospital Node Infrastructure</span>
        </div>
        <p className="text-[11px] text-slate-600">
          Regal Healthcare Platform • Version 2026-v2.4 • Authorized Personnel Only
        </p>
      </footer>
    </div>
  );
}