export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import PatientProfileWorkspace from '@/components/doctor/command-center/PatientProfileWorkspace';

export default async function DoctorPatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PatientProfileWorkspace patientId={id} />;
}
