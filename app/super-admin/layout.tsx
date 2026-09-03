'use client';

import type { ReactNode } from 'react';
import { EcosystemRouteGuard } from '@/components/auth/EcosystemRouteGuard';

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <EcosystemRouteGuard role="superadmin" loginPath="/ops/platform-root">
      {children}
    </EcosystemRouteGuard>
  );
}
