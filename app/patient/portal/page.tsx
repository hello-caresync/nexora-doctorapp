'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** Patient portal booking lives on the 41-doctor OPD book flow. */
export default function PatientPortalPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/patient/appointments/book');
  }, [router]);

  return (
    <div className="min-h-[40vh]">
      <header className="bg-white border-b border-gray-100 py-3 px-6 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-lg border border-gray-200/80 shadow-xs flex items-center justify-center">
              <img
                src="/regal-logo.png"
                alt="Regal Hospital"
                className="h-9 w-auto object-contain"
              />
            </div>
            <span className="hidden sm:inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
              SmartQ Patient Portal
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500 hidden md:inline font-mono">
              Helpline: <strong className="text-gray-700">+91 98450 12345</strong>
            </span>
            <div className="text-xs font-medium px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>OPD Live Desk Active</span>
            </div>
          </div>
        </div>
      </header>
      <div className="flex min-h-[30vh] items-center justify-center">
        <div className="flex items-center gap-2 text-xs font-bold text-[#4B736B]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Opening appointment booking…
        </div>
      </div>
    </div>
  );
}
