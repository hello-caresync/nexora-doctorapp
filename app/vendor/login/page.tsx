'use client';

import React, { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Truck,
} from 'lucide-react';
import { authenticateVendorCredential } from '@/lib/auth/vendor-auth';
import { persistVendorSession } from '@/lib/auth/ecosystem-sessions';

function VendorLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const result = await authenticateVendorCredential(email, passcode);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    persistVendorSession(result.vendor);
    router.push('/vendor/portal');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-orange-50 p-6 font-sans">
      <div className="w-full max-w-md rounded-3xl border border-orange-200 bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
            <Truck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Vendor Portal</h1>
          <p className="mt-1 text-xs text-slate-500">Hospital supply chain partner access</p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">
              Vendor Rep Email
            </label>
            <div className="relative">
              <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-3 pr-3 pl-10 text-sm outline-none focus:border-orange-400"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase">
              Vendor Passcode
            </label>
            <div className="relative">
              <Lock className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPasscode ? 'text' : 'password'}
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-3 pr-10 pl-10 text-sm outline-none focus:border-orange-400"
              />
              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400"
              >
                {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 text-sm font-bold text-white hover:bg-orange-500 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Enter Vendor Workspace
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

export default function VendorLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>}>
      <VendorLoginForm />
    </Suspense>
  );
}
