import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Administrator Login | NEXORA Healthcare OS',
  description: 'Enterprise Administrative Access Terminal',
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-[#030712]">
      {children}
    </div>
  );
}