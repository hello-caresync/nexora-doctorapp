import { redirect } from 'next/navigation';

/** Legacy admin login ΓÇö unified Regal Hospital portal lives at /hospital/login */
export default function AdminLoginRedirectPage() {
  redirect('/hospital/login');
}
