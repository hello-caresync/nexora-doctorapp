'use client';

import type { ReactNode } from 'react';
import { EcosystemRouteGuard } from '@/components/auth/EcosystemRouteGuard';

export default function SuperVaultAccessLayout({ children }: { children: ReactNode }) {
  return (
    <EcosystemRouteGuard role="superadmin" loginPath="/super-admin/login">
      {children}
    </EcosystemRouteGuard>
  );
}
