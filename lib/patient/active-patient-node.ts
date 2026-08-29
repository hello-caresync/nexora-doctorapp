export const ACTIVE_PATIENT_ID_KEY = 'curasync_active_patient_id';
export const ACTIVE_PATIENT_NAME_KEY = 'curasync_patient_name';

export const getActivePatientId = (): string => {
  if (typeof window === 'undefined') return 'PT-NODE-SESSION';
  let id = localStorage.getItem(ACTIVE_PATIENT_ID_KEY);
  if (!id) {
    id = `PT-${Math.floor(100000 + Math.random() * 900000)}`;
    localStorage.setItem(ACTIVE_PATIENT_ID_KEY, id);
  }
  return id;
};

export const getActivePatientName = (): string => {
  if (typeof window === 'undefined') return 'Aishwarya D S';
  return localStorage.getItem(ACTIVE_PATIENT_NAME_KEY) || 'Aishwarya D S';
};

export function persistActivePatientNode(id: string, name: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_PATIENT_ID_KEY, id);
  localStorage.setItem(ACTIVE_PATIENT_NAME_KEY, name.trim());
}
