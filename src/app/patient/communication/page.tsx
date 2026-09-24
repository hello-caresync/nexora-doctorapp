import { redirect } from 'next/navigation';

import { PATIENT_ROUTES } from '@/lib/patient/navigation';

/** Legacy Messages route ΓåÆ dashboard. */
export default function LegacyCommunicationRedirect() {
  redirect(PATIENT_ROUTES.dashboard);
}
