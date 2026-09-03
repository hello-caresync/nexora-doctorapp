'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle,
  Eye,
  EyeOff,
  HeartPulse,
  Lock,
  Sparkles,
  Stethoscope,
} from 'lucide-react';

import { authenticateHospitalDoctor } from '@/lib/doctor/hospital-auth';
import { saveDoctorSession } from '@/lib/doctor/session';

export default function DoctorLoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const result = await authenticateHospitalDoctor(identifier, passcode);

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      saveDoctorSession(result.session, rememberMe);

      setTimeout(() => {
        router.push('/doctor/workspace');
      }, 500);
    } catch (err) {
      console.error('Login error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Authentication error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F0FDF9] p-4 font-sans sm:p-8">
      <style jsx global>{`
        @keyframes floatSlow {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        @keyframes floatDelayed {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(8px);
          }
        }
        @keyframes circularPulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.04);
            opacity: 0.25;
          }
        }
        @keyframes doctorBreathe {
          0%,
          100% {
            transform: translateY(0px) scale(1.02);
          }
          50% {
            transform: translateY(-6px) scale(1.05);
          }
        }
        .anim-badge-1 {
          animation: floatSlow 4s ease-in-out infinite;
        }
        .anim-badge-2 {
          animation: floatDelayed 4.5s ease-in-out infinite;
        }
        .anim-pulse-ring {
          animation: circularPulse 3.5s ease-in-out infinite;
        }
        .anim-doctor-avatar {
          animation: doctorBreathe 3.5s ease-in-out infinite;
        }
      `}</style>

      <div className="grid min-h-[640px] w-full max-w-5xl grid-cols-1 overflow-hidden rounded-3xl border border-teal-100 bg-white shadow-2xl lg:grid-cols-12">
        <div className="z-10 flex flex-col justify-between bg-white p-8 sm:p-12 lg:col-span-5">
          <div>
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-600 to-cyan-500 text-white shadow-md shadow-teal-500/20">
                <Stethoscope className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <span className="flex items-center gap-1.5 text-xl font-black tracking-tight text-slate-900">
                  Regal<span className="font-extrabold text-teal-600">Health</span>
                </span>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  EMR Clinician Portal
                </p>
              </div>
            </div>

            <div className="mb-6">
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Login To Your Station</h1>
              <p className="mt-1 text-xs text-slate-500">Sign in with hospital-issued clinician credentials</p>
            </div>

            {errorMessage && (
              <div className="mb-5 flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs text-teal-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-teal-600" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="doctor-identifier"
                  className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-600"
                >
                  Doctor ID or Hospital Email
                </label>
                <div className="relative">
                  <Building2
                    className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="doctor-identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. dr.suriraju@regalhospital.com or RH-D01"
                    required
                    autoComplete="username"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-xs font-semibold text-slate-900 outline-none transition-all focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-100"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="doctor-passcode"
                  className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-600"
                >
                  Security Passcode
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                  <input
                    id="doctor-passcode"
                    type={showPasscode ? 'text' : 'password'}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Enter security passcode"
                    required
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-10 text-xs font-semibold text-slate-900 outline-none transition-all focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode((v) => !v)}
                    className="absolute right-3.5 top-3.5 cursor-pointer text-slate-400 hover:text-slate-600"
                    aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
                  >
                    {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-xs">
                <label className="flex cursor-pointer select-none items-center gap-2 font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded accent-teal-600"
                  />
                  Remember Session
                </label>
                <span className="cursor-pointer font-bold text-teal-600 hover:text-teal-700">Forgot PIN?</span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 via-teal-700 to-cyan-700 py-3.5 text-xs font-black text-white shadow-lg shadow-teal-600/25 transition-all hover:from-teal-700 hover:to-cyan-800 active:scale-[0.99] disabled:opacity-50"
              >
                {isLoading ? (
                  <span>Authenticating Hospital Records...</span>
                ) : (
                  <>
                    <span>Enter Doctor Workspace</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-tr from-[#005B52] via-[#00897B] to-[#0284C7] p-8 text-white sm:p-12 lg:col-span-7">
          <div className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute right-10 top-10 h-48 w-48 rounded-full bg-teal-400/20 blur-xl" />

          <div className="z-10 flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3.5 py-1.5 text-xs font-bold shadow-inner backdrop-blur-md">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
              <span>Hospital Cloud Online</span>
            </div>
            <span className="font-mono text-xs font-bold text-teal-100 opacity-90">HIPAA & ABDM Protected</span>
          </div>

          <div className="relative z-10 my-auto flex items-center justify-center py-4">
            <div className="anim-pulse-ring pointer-events-none absolute h-72 w-72 rounded-full border-2 border-cyan-300/30 sm:h-84 sm:w-84" />
            <div className="pointer-events-none absolute h-80 w-80 rounded-full border border-sky-400/20 sm:h-92 sm:w-92" />

            <div className="relative flex h-64 w-64 items-center justify-center rounded-full border-4 border-white/40 bg-gradient-to-b from-[#38BDF8] via-[#0284C7] to-[#0369A1] p-3 shadow-2xl sm:h-76 sm:w-76">
              <div className="relative flex h-full w-full items-end justify-center overflow-hidden rounded-full bg-gradient-to-b from-sky-100 via-white to-sky-50 shadow-inner">
                <div className="anim-doctor-avatar flex h-[95%] w-[95%] translate-y-2 items-center justify-center">
                  <Stethoscope className="h-24 w-24 text-teal-600 drop-shadow-lg sm:h-32 sm:w-32" strokeWidth={1.25} />
                </div>
                <div className="absolute bottom-5 right-6 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-cyan-600 shadow-lg">
                  <span className="text-xs font-black leading-none text-white">+</span>
                </div>
              </div>
            </div>

            <div className="anim-badge-1 absolute -left-2 -top-3 z-20 flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-slate-900 shadow-2xl sm:left-2 sm:p-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-teal-100 bg-teal-50 text-teal-600">
                <HeartPulse className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Live OPD Sync</p>
                <p className="text-xs font-black text-slate-900">0s Prescription Sync</p>
              </div>
            </div>

            <div className="anim-badge-2 absolute -bottom-3 -right-2 z-20 flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-slate-900 shadow-2xl sm:right-2 sm:p-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-100 bg-cyan-50 text-cyan-700">
                <CheckCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Data Isolation</p>
                <p className="text-xs font-black text-slate-900">Private Patient Dossier</p>
              </div>
            </div>
          </div>

          <div className="z-10 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
            <h4 className="flex items-center gap-1.5 text-xs font-extrabold text-white">
              <Sparkles className="h-3.5 w-3.5 text-cyan-200" aria-hidden="true" />
              Zero-Cross Data Security Guarantee
            </h4>
            <p className="mt-1 text-[11px] leading-relaxed text-teal-100">
              Every clinician logs into an encrypted, isolated workstation. Appointments booked for other doctors
              are strictly shielded.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
