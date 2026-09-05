'use client';

import type { ReactNode } from 'react';
import { Toaster } from 'sonner';

import { useSupabaseClinicalRealtime } from '@/lib/doctor/hooks/useSupabaseClinicalRealtime';
import { useSseClinicalRealtime } from '@/lib/doctor/hooks/useSseClinicalRealtime';

function RealtimeBridge() {
  useSupabaseClinicalRealtime();
  useSseClinicalRealtime();
  return null;
}

export default function DoctorProviders({ children }: { children: ReactNode }) {
  return (
    <>
      <RealtimeBridge />
      {children}
      <Toaster richColors position="top-right" closeButton />
    </>
  );
}
