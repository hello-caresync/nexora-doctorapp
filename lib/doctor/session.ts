export interface DoctorSession {
  doctorId: string;
  doctorName: string;
  department?: string;
  specialization?: string;
  email?: string;
  hospitalCode?: string;
  portalRoute?: string;
  loggedInAt?: string;
}

const SESSION_KEY = 'active_doctor_session';

export function getDoctorSession(): DoctorSession | null {
  if (typeof window === 'undefined') return null;

  const raw =
    sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as DoctorSession;
    if (!parsed?.doctorId || !parsed?.doctorName) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDoctorSession(session: DoctorSession, remember = true): void {
  const payload = { ...session, loggedInAt: new Date().toISOString() };
  const serialized = JSON.stringify(payload);
  sessionStorage.setItem(SESSION_KEY, serialized);
  if (remember) {
    localStorage.setItem(SESSION_KEY, serialized);
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function clearDoctorSession(): void {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

function normalizeDoctorName(name: string): string {
  return name
    .replace(/^dr\.?\s*/i, '')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractAppointmentDoctorCode(item: Record<string, unknown>): string {
  const candidates = [item.doctor_employee_id, item.doctor_code, item.doctor_id].map((value) =>
    String(value ?? '')
      .trim()
      .toUpperCase(),
  );

  const regalId = candidates.find((value) => /^RH-D\d+$/i.test(value));
  if (regalId) return regalId;

  return candidates.find(Boolean) ?? '';
}

/** Strict match — appointments without a doctor binding are never shown. */
export function appointmentBelongsToDoctor(
  item: Record<string, unknown>,
  session: DoctorSession,
): boolean {
  const sessionId = session.doctorId.trim().toUpperCase();
  const itemDocId = extractAppointmentDoctorCode(item);

  if (itemDocId && sessionId && itemDocId === sessionId) {
    return true;
  }

  const itemName = normalizeDoctorName(String(item.doctor_name || ''));
  const sessionName = normalizeDoctorName(session.doctorName);

  if (!itemName || !sessionName) return false;

  if (itemName === sessionName) return true;

  const sessionTokens = sessionName.split(' ').filter((token) => token.length >= 3);
  const itemTokens = itemName.split(' ').filter((token) => token.length >= 3);

  if (sessionTokens.length === 0 || itemTokens.length === 0) return false;

  const primarySession = sessionTokens[0];
  const primaryItem = itemTokens[0];

  return (
    primaryItem === primarySession ||
    itemName.includes(primarySession) ||
    sessionName.includes(primaryItem)
  );
}
