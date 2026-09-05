import { redirect } from 'next/navigation';

export default function PatientMedicalRecordsPage() {
  redirect('/patient/prescriptions');
}
