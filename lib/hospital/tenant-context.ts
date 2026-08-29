export const HOSPITAL_ADMIN_SESSION_KEY = 'curasync_hospital_admin_session';

export interface HospitalTenantContext {
  hospital_id: string;
  hospital_name: string;
}

const DEFAULT_TENANT: HospitalTenantContext = {
  hospital_id: 'HOSP-01',
  hospital_name: 'Regal Hospital Main',
};

export function getHospitalTenantContext(): HospitalTenantContext {
  if (typeof window === 'undefined') {
    return DEFAULT_TENANT;
  }

  const raw = localStorage.getItem(HOSPITAL_ADMIN_SESSION_KEY);
  if (!raw) {
    return DEFAULT_TENANT;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<HospitalTenantContext>;
    if (parsed.hospital_id && parsed.hospital_name) {
      return {
        hospital_id: parsed.hospital_id,
        hospital_name: parsed.hospital_name,
      };
    }
  } catch {
    // fall through to default tenant
  }

  return DEFAULT_TENANT;
}

export function getTenantScopedStorageKey(baseKey: string, hospitalId: string): string {
  return `${baseKey}_${hospitalId}`;
}
