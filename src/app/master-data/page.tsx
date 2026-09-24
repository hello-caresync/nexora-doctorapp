import { redirect } from 'next/navigation';

import { APP_ROUTES } from '../lib/routes';

/** Legacy path ΓÇö forwards to /admin/master-data */
export default function LegacyMasterDataRedirect() {
  redirect(APP_ROUTES.masterData);
}
