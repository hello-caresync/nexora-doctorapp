export interface DoctorSession {
  doctorId: string;
  doctorName: string;
  department?: string;
  specialization?: string;
  email?: string;
  hospitalCode?: string;
  portalRoute?: string;
  loggedInAt?: string;
  /** Profile portal aliases (historical session shape) */
  employeeId?: string;
  fullName?: string;
  doctor_name?: string;
  consultationFee?: number;
  opdRoom?: string;
  fee?: number;
  qualification?: string;
}

const SESSION_KEY = 'active_doctor_session';

export const DEFAULT_DOCTOR_EMPLOYEE_ID = 'RH-D01';
export const DEFAULT_DOCTOR_DISPLAY_NAME = 'Dr. Suriraju V';
export const DEFAULT_DOCTOR_DEPARTMENT = 'Clinical';

export type ResolvedDoctorSession = {
  employeeId: string;
  doctorId: string;
  fullName: string;
  doctorName: string;
  department: string;
  email?: string;
  specialization?: string;
};

/** Safe fallbacks when `getDoctorSession()` returns null or partial profile fields. */
export function resolveDoctorSessionIdentity(
  session: DoctorSession | null = getDoctorSession(),
): ResolvedDoctorSession {
  const employeeId = session?.employeeId || session?.doctorId || DEFAULT_DOCTOR_EMPLOYEE_ID;
  const fullName =
    session?.fullName ||
    session?.doctorName ||
    session?.doctor_name ||
    DEFAULT_DOCTOR_DISPLAY_NAME;
  const doctorName = session?.doctorName || fullName;

  return {
    employeeId,
    doctorId: session?.doctorId || employeeId,
    fullName,
    doctorName,
    department: session?.department || DEFAULT_DOCTOR_DEPARTMENT,
    email: session?.email,
    specialization: session?.specialization,
  };
}

export const DOCTOR_SESSION_CHANGED_EVENT = 'curasync:doctor-session-changed';

function dispatchSessionChanged(session: DoctorSession | null): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DOCTOR_SESSION_CHANGED_EVENT, { detail: session }));
}

function normalizeStoredSession(parsed: Partial<DoctorSession>): DoctorSession | null {
  const doctorId = parsed.doctorId ?? parsed.employeeId;
  const doctorName = parsed.doctorName ?? parsed.fullName ?? parsed.doctor_name;

  if (!doctorId || !doctorName) return null;

  return {
    ...parsed,
    doctorId,
    doctorName,
    employeeId: parsed.employeeId ?? doctorId,
    fullName: parsed.fullName ?? doctorName,
  };
}

export function getDoctorSession(): DoctorSession | null {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<DoctorSession>;
    return normalizeStoredSession(parsed);
  } catch {
    return null;
  }
}

/** Persist session to both localStorage and sessionStorage. */
export function setDoctorSession(session: DoctorSession): void {
  if (typeof window === 'undefined') return;

  const normalized = normalizeStoredSession(session) ?? session;
  const payload = JSON.stringify(normalized);
  localStorage.setItem(SESSION_KEY, payload);
  sessionStorage.setItem(SESSION_KEY, payload);
  dispatchSessionChanged(normalized);
}

/** Login helper — optionally skip persisting to localStorage when "Remember me" is off. */
export function saveDoctorSession(session: DoctorSession, remember = true): void {
  if (typeof window === 'undefined') return;

  const payload = normalizeStoredSession({ ...session, loggedInAt: new Date().toISOString() }) ?? {
    ...session,
    loggedInAt: new Date().toISOString(),
  };
  const serialized = JSON.stringify(payload);
  sessionStorage.setItem(SESSION_KEY, serialized);

  if (remember) {
    localStorage.setItem(SESSION_KEY, serialized);
  } else {
    localStorage.removeItem(SESSION_KEY);
  }

  dispatchSessionChanged(payload);
}

export function clearDoctorSession(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  dispatchSessionChanged(null);
}

/** Alias used by doctor shell and workspace components. */
export const getActiveDoctorSession = getDoctorSession;

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
  const sessionId = (session.doctorId || session.employeeId || '').trim().toUpperCase();
  const itemDocId = extractAppointmentDoctorCode(item);

  if (itemDocId && sessionId && itemDocId === sessionId) {
    return true;
  }

  const sessionDisplayName = session.doctorName || session.fullName || session.doctor_name || '';
  const itemName = normalizeDoctorName(String(item.doctor_name || ''));
  const sessionName = normalizeDoctorName(sessionDisplayName);

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
