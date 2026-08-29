import { redirect } from 'next/navigation';

/** Legacy route — unified Regal Hospital login lives at /login */
export default function HospitalLoginRedirectPage() {
  redirect('/login');
}
