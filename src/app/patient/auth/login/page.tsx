import { redirect } from 'next/navigation';

/** Legacy route ΓÇö canonical patient auth lives at /patient/login */
export default function LegacyPatientAuthLoginPage() {
  redirect('/patient/login');
}
