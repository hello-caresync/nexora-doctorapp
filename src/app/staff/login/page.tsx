import { redirect } from 'next/navigation';

/** Legacy staff login ΓÇö unified Regal Hospital portal lives at /hospital/login */
export default function StaffLoginRedirectPage() {
  redirect('/hospital/login');
}
