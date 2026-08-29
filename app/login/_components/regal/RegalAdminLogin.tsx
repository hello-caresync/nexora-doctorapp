'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useReducedMotion } from 'framer-motion';

import { getAdminRedirectPath, getAdminSession } from '@/lib/admin/auth';

import BrandPanel from './BrandPanel';
import LoginPanel from './LoginPanel';

export default function RegalAdminLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reducedMotion = useReducedMotion();
  const redirectUrl = getAdminRedirectPath(searchParams.get('redirect'));

  useEffect(() => {
    if (getAdminSession()) {
      router.replace(redirectUrl);
    }
  }, [router, redirectUrl]);

  return (
    <main className="flex h-[100svh] max-h-[100svh] min-h-[100svh] w-full flex-col overflow-hidden lg:flex-row">
      <BrandPanel reducedMotion={!!reducedMotion} />
      <LoginPanel redirectUrl={redirectUrl} />
    </main>
  );
}
