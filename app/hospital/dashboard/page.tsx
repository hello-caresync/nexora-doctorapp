import { redirect } from 'next/navigation';

/** Legacy nested route — canonical dashboard is /dashboard */
export default function HospitalDashboardRedirectPage() {
  redirect('/dashboard');
}
