import { redirect } from 'next/navigation';

export default function PatientRecordsPage() {
  redirect('/patient/prescriptions');
}
