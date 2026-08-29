import { redirect } from 'next/navigation';

/** Legacy hospital index — canonical dashboard is /dashboard */
export default function HospitalIndexPage() {
  redirect('/dashboard');
}
