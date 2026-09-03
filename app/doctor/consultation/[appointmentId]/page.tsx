export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import LegacyConsultationRedirectClient from './LegacyConsultationRedirectClient';

export default async function LegacyConsultationRedirectPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;
  return <LegacyConsultationRedirectClient appointmentId={appointmentId} />;
}
