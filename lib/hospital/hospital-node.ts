import {
  HOSPITAL_TENANT_ID,
  REGAL_FACILITY_CODE,
  REGAL_HOSPITAL_ID,
} from '@/lib/regal/constants';

export { HOSPITAL_TENANT_ID, REGAL_FACILITY_CODE, REGAL_HOSPITAL_ID };

const TENANT_ALIASES: Record<string, string> = {
  [HOSPITAL_TENANT_ID]: HOSPITAL_TENANT_ID,
  [REGAL_FACILITY_CODE]: HOSPITAL_TENANT_ID,
  [REGAL_HOSPITAL_ID]: HOSPITAL_TENANT_ID,
};

export function isUuidValue(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
  );
}

export function canonicalHospitalId(raw?: string | null): string {
  const value = String(raw ?? '').trim();
  if (!value) return HOSPITAL_TENANT_ID;
  return TENANT_ALIASES[value] ?? TENANT_ALIASES[value.toUpperCase()] ?? value;
}

/** All known identifiers for a hospital node so queries catch UUID and code rows. */
export function hospitalIdQueryValues(raw?: string | null): string[] {
  const canonical = canonicalHospitalId(raw);
  const values = new Set<string>([canonical]);
  const original = String(raw ?? '').trim();
  if (original) values.add(original);

  if (canonical === HOSPITAL_TENANT_ID) {
    values.add(HOSPITAL_TENANT_ID);
    values.add(REGAL_FACILITY_CODE);
    values.add(REGAL_HOSPITAL_ID);
  }

  return [...values];
}

export function hospitalIdsMatch(left?: string | null, right?: string | null): boolean {
  if (!left || !right) return false;
  return canonicalHospitalId(left) === canonicalHospitalId(right);
}

export function isUuidColumnError(message?: string | null): boolean {
  const lower = String(message ?? '').toLowerCase();
  return lower.includes('invalid input syntax for type uuid');
}
