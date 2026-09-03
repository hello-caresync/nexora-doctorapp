'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function LegacyLoginRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const redirect = searchParams.get('redirect');
    const qs = searchParams.toString();

    // Prevent /login <-> /staff/login redirect loops
    if (redirect === '/staff/login' || redirect?.startsWith('/staff/login')) {
      router.replace('/staff/login');
      return;
    }

    router.replace(qs ? `/staff/login?${qs}` : '/staff/login');
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
    </div>
  );
}

/** Legacy `/login` route — forwards to the dedicated operational staff login portal. */
export default function LegacyLoginRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-100">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      }
    >
      <LegacyLoginRedirectInner />
    </Suspense>
  );
}
