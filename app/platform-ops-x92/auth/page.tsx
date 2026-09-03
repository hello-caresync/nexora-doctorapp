'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function LegacyPlatformOpsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/ops/platform-root');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
    </div>
  );
}
