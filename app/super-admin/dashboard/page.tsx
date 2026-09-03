'use client';

import { useRouter } from 'next/navigation';
import { Building2, Crown, Hospital, Users } from 'lucide-react';

export default function SuperAdminDashboardPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-950 p-6 font-sans text-slate-100 sm:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-bold tracking-widest text-amber-300 uppercase">
            <Crown className="h-3.5 w-3.5" />
            Level-0 Super Admin Console
          </div>
          <h1 className="mt-4 text-3xl font-black">Platform Operations Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Provision hospital nodes, create initial Hospital Admin credentials, and manage the
            multi-tenant clinical ecosystem.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => router.push('/super-admin/staff-credentials')}
            className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 text-left transition hover:border-teal-500/40"
          >
            <Hospital className="mb-3 h-8 w-8 text-teal-400" />
            <h2 className="text-lg font-bold">Hospital Provisioning</h2>
            <p className="mt-1 text-xs text-slate-400">
              Onboard hospitals and generate initial Hospital Admin login credentials.
            </p>
          </button>
          <button
            type="button"
            onClick={() => router.push('/super-admin/staff-credentials')}
            className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 text-left transition hover:border-indigo-500/40"
          >
            <Users className="mb-3 h-8 w-8 text-indigo-400" />
            <h2 className="text-lg font-bold">Credential Registry</h2>
            <p className="mt-1 text-xs text-slate-400">
              View and manage all provisioned hospital admin and staff credential blocks.
            </p>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Building2 className="h-4 w-4" />
          Regal Platform Root • Secured Operations Layer
        </div>
      </div>
    </div>
  );
}
