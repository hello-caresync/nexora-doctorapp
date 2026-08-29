import React from 'react';

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] text-slate-800 antialiased selection:bg-teal-500 selection:text-white">
      {children}
    </div>
  );
}