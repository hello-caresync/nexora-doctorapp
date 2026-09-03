export type EnterprisePasscodeRole =
  | 'Doctor'
  | 'Nurse'
  | 'Receptionist'
  | 'Pharmacist'
  | 'Admin';

/**
 * Format: `[DEPT]-[HOSP_INIT]-[STAFF_INITIALS][YEAR]-[ROLE_CHAR][NODE_NUM][NAME_LEN]`
 * Example: `SURG-RH-CK26-D116` for Dr. Chandrakanth Kesari at Regal Hospital, Surgery.
 */
export function generateEnterprisePasscode(
  role: EnterprisePasscodeRole,
  department: string,
  fullName: string,
  hospitalId: string = 'HOSP-01',
  hospitalName: string = 'Regal Hospital Main',
): string {
  // 1. Department 4-letter code
  const d = department.trim().toUpperCase();
  let deptCode = 'MEDS';
  if (d.includes('SURG')) deptCode = 'SURG';
  else if (d.includes('ICU') || d.includes('EMERG')) deptCode = 'ICU';
  else if (d.includes('CARD')) deptCode = 'CARD';
  else if (d.includes('PHARM')) deptCode = 'PHAR';
  else if (d.includes('FRONT') || d.includes('RECEPT') || d.includes('DESK')) deptCode = 'DESK';
  else if (d.includes('PED')) deptCode = 'PEDS';
  else if (d.includes('URO')) deptCode = 'UROL';
  else if (d.includes('NEUR')) deptCode = 'NEUR';
  else if (d.includes('OPS') || d.includes('ADMIN')) deptCode = 'OPS';
  else deptCode = d.replace(/[^A-Z]/g, '').slice(0, 4).padEnd(4, 'X');

  // 2. Hospital initials
  let hospInit = 'RH';
  const hospitalNameLower = hospitalName.toLowerCase();
  if (hospitalId === 'HOSP-01' || hospitalNameLower.includes('regal')) hospInit = 'RH';
  else if (hospitalId === 'HOSP-02' || hospitalNameLower.includes('apollo')) hospInit = 'AP';
  else if (hospitalId === 'HOSP-03' || hospitalNameLower.includes('manipal')) hospInit = 'MN';
  else if (hospitalId === 'HOSP-04' || hospitalNameLower.includes('aster')) hospInit = 'AC';
  else {
    const words = hospitalName
      .replace(/hospital|super|speciality|main|institute/gi, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    hospInit = words.map((w) => w.charAt(0)).join('').slice(0, 3).toUpperCase() || 'HP';
  }

  // 3. Staff initials + year (2026)
  const cleanName = fullName.replace(/^(Dr\.|Sister|Mr\.|Mrs\.|Ms\.)\s+/i, '').trim();
  const nameWords = cleanName.split(/\s+/).filter(Boolean);
  const firstInit = nameWords[0]?.charAt(0).toUpperCase() || 'S';
  const lastInit =
    nameWords.length > 1 ? nameWords[nameWords.length - 1].charAt(0).toUpperCase() : 'X';
  const yearCode = '26';

  // 4. Deterministic token: Role + NodeNum + NameLength
  const roleMap: Record<EnterprisePasscodeRole, string> = {
    Doctor: 'D',
    Nurse: 'N',
    Receptionist: 'R',
    Pharmacist: 'P',
    Admin: 'A',
  };
  const roleChar = roleMap[role] || 'S';
  const nodeNum = hospitalId.replace(/[^0-9]/g, '').slice(-1) || '1';
  const nameLen = String(cleanName.length).padStart(2, '0');
  const token = `${roleChar}${nodeNum}${nameLen}`;

  return `${deptCode}-${hospInit}-${firstInit}${lastInit}${yearCode}-${token}`;
}
