'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';

import { DoctorsStaffCommandCenter } from '@/components/hospital/DoctorsStaffCommandCenter';
import { markHospitalSetupCompleted } from '@/lib/auth/admin-setup';
import { HOSPITAL_TENANT_ID } from '@/lib/regal/constants';

function StaffCredentialsSetup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hospitalId = searchParams.get('hospitalId') || HOSPITAL_TENANT_ID;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f1f5f9]">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-6 font-sans text-slate-800 sm:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Hospital OS
          </button>
          <button
            type="button"
            onClick={() => {
              void markHospitalSetupCompleted(hospitalId);
              router.push('/dashboard');
            }}
            className="rounded-xl bg-cyan-700 px-4 py-2 text-xs font-bold text-white"
          >
            Continue to Dashboard
          </button>
        </div>
        <DoctorsStaffCommandCenter
          hospitalId={hospitalId}
          hospitalName="Regal Hospital"
          canManage
        />
      </div>
    </div>
  );
}

export default function StaffCredentialsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f1f5f9]">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-700" />
        </div>
      }
    >
      <StaffCredentialsSetup />
    </Suspense>
  );
}
