'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { EcosystemRouteGuard } from '@/components/auth/EcosystemRouteGuard';

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/super-admin/login') {
    return <>{children}</>;
  }

  return (
    <EcosystemRouteGuard role="superadmin" loginPath="/super-admin/login">
      {children}
    </EcosystemRouteGuard>
  );
}
