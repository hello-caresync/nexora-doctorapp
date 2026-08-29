import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Access Denied',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function SuperVaultLayout({ children }: { children: React.ReactNode }) {
  return children;
}
