import React from 'react';

import DoctorProviders from '@/components/doctor/DoctorProviders';

export const dynamic = 'force-dynamic';

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DoctorProviders>
      <div className="min-h-screen w-full bg-[#F8FAFC] text-slate-800 antialiased selection:bg-teal-500 selection:text-white">
        {children}
      </div>
    </DoctorProviders>
  );
}
