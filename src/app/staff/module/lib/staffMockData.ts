import type { EmployeeStatus, SystemRole } from '../staffNav.types';

export type EmployeeRecord = {
  id: string;
  employeeCode: string;
  name: string;
  designation: string;
  department: string;
  reportingManager: string;
  role: SystemRole;
  status: EmployeeStatus;
  phone: string;
  email: string;
  joinDate: string;
  emergencyContact: string;
  medicalLicenseNo?: string;
  medicalLicenseExpiry?: string;
  nursingRegistration?: string;
  nursingExpiry?: string;
  licenseVerified: boolean;
  contractVerified: boolean;
  identityVerified: boolean;
  onCall: boolean;
  shiftToday: string;
  lastAppraisal: string;
  kpiScore: number;
  complianceCourses: { name: string; status: 'Complete' | 'Due' | 'Overdue'; dueDate?: string }[];
  salaryBand: string;
  payrollStatus: 'Processed' | 'Pending' | 'On Hold';
};

export type ShiftRosterEntry = {
  id: string;
  employeeName: string;
  department: string;
  shift: string;
  schedule: string;
  onCall: boolean;
  roomOrWard: string;
};

export type AttendanceEntry = {
  id: string;
  employeeName: string;
  employeeCode: string;
  checkIn: string;
  checkOut?: string;
  method: 'Biometric' | 'Manual';
  lateMinutes: number;
  leavePending?: string;
};

export type LeaveRequest = {
  id: string;
  employeeName: string;
  type: string;
  from: string;
  to: string;
  status: 'Pending' | 'Approved' | 'Rejected';
};

export type PermissionMatrixRow = {
  module: string;
  admin: boolean;
  hr: boolean;
  deptHead: boolean;
  it: boolean;
  employee: boolean;
};

export type PayslipLog = {
  id: string;
  employeeName: string;
  period: string;
  amount: number;
  status: 'Generated' | 'Sent' | 'Failed';
  generatedAt: string;
};

export const STAFF_CENSUS = {
  totalEmployees: 486,
  active: 462,
  onDuty: 186,
  offDuty: 198,
  onLeave: 24,
  newJoiners: 8,
  expiringLicenses: 11,
};

export const MOCK_EMPLOYEES: EmployeeRecord[] = [
  {
    id: 'e1',
    employeeCode: 'NX-EMP-00412',
    name: 'Dr. Anita Roy',
    designation: 'Senior Consultant ΓÇö Cardiology',
    department: 'Cardiology',
    reportingManager: 'Dr. Menon ΓÇö HOD Cardiology',
    role: 'Dept Head',
    status: 'On Duty',
    phone: '+91 98765 11101',
    email: 'anita.roy@nexorahms.in',
    joinDate: '2018-04-12',
    emergencyContact: 'Vikram Roy (Spouse) ┬╖ +91 98xxx xx101',
    medicalLicenseNo: 'KMC-88421',
    medicalLicenseExpiry: '2026-09-30',
    licenseVerified: true,
    contractVerified: true,
    identityVerified: true,
    onCall: true,
    shiftToday: 'Morning (07:00ΓÇô15:00)',
    lastAppraisal: '2026-03-15 ΓÇö Exceeds Expectations',
    kpiScore: 94,
    complianceCourses: [
      { name: 'BLS Renewal', status: 'Complete' },
      { name: 'Infection Control 2026', status: 'Complete' },
      { name: 'Fire Safety Drill', status: 'Due', dueDate: '2026-08-01' },
    ],
    salaryBand: 'Band E ΓÇö Consultant',
    payrollStatus: 'Processed',
  },
  {
    id: 'e2',
    employeeCode: 'NX-EMP-00428',
    name: 'Priya Nair',
    designation: 'Front Office Executive',
    department: 'Front Office',
    reportingManager: 'Rajesh Kumar ΓÇö Admin Manager',
    role: 'Employee Self-Service',
    status: 'On Duty',
    phone: '+91 87654 22208',
    email: 'priya.nair@nexorahms.in',
    joinDate: '2022-01-08',
    emergencyContact: 'Lakshmi Nair (Mother) ┬╖ +91 87xxx xx208',
    licenseVerified: false,
    contractVerified: true,
    identityVerified: true,
    onCall: false,
    shiftToday: 'Morning (08:00ΓÇô16:00)',
    lastAppraisal: '2025-11-20 ΓÇö Meets Expectations',
    kpiScore: 88,
    complianceCourses: [
      { name: 'HIPAA / Data Privacy', status: 'Complete' },
      { name: 'Customer Service Excellence', status: 'Complete' },
    ],
    salaryBand: 'Band B ΓÇö Operations',
    payrollStatus: 'Processed',
  },
  {
    id: 'e3',
    employeeCode: 'NX-EMP-00391',
    name: 'Sister Meera Iyer',
    designation: 'Charge Nurse ΓÇö ICU',
    department: 'Nursing ΓÇö ICU',
    reportingManager: 'Matron Susan Joseph',
    role: 'Dept Head',
    status: 'On Duty',
    phone: '+91 91234 33319',
    email: 'meera.iyer@nexorahms.in',
    joinDate: '2015-06-20',
    emergencyContact: 'Joseph Iyer (Spouse) ┬╖ +91 91xxx xx319',
    nursingRegistration: 'INC-77204',
    nursingExpiry: '2026-07-28',
    licenseVerified: true,
    contractVerified: true,
    identityVerified: true,
    onCall: false,
    shiftToday: 'Morning (07:00ΓÇô15:00)',
    lastAppraisal: '2026-01-10 ΓÇö Exceeds Expectations',
    kpiScore: 91,
    complianceCourses: [
      { name: 'ACLS Certification', status: 'Complete' },
      { name: 'Needle Stick Protocol', status: 'Overdue', dueDate: '2026-07-01' },
    ],
    salaryBand: 'Band D ΓÇö Clinical Lead',
    payrollStatus: 'Pending',
  },
  {
    id: 'e4',
    employeeCode: 'NX-EMP-00455',
    name: 'Arjun Das',
    designation: 'IT Systems Administrator',
    department: 'Information Technology',
    reportingManager: 'Kiran Shah ΓÇö CIO',
    role: 'IT',
    status: 'Active',
    phone: '+91 99887 44455',
    email: 'arjun.das@nexorahms.in',
    joinDate: '2020-09-01',
    emergencyContact: 'Deepa Das (Spouse) ┬╖ +91 99xxx xx455',
    licenseVerified: false,
    contractVerified: true,
    identityVerified: true,
    onCall: true,
    shiftToday: 'General (09:00ΓÇô18:00)',
    lastAppraisal: '2026-02-28 ΓÇö Exceeds Expectations',
    kpiScore: 96,
    complianceCourses: [
      { name: 'Cybersecurity Awareness', status: 'Complete' },
      { name: 'ISO 27001 Refresher', status: 'Due', dueDate: '2026-09-15' },
    ],
    salaryBand: 'Band C ΓÇö Technical',
    payrollStatus: 'Processed',
  },
  {
    id: 'e5',
    employeeCode: 'NX-EMP-00461',
    name: 'Lakshmi Reddy',
    designation: 'HR Business Partner',
    department: 'Human Resources',
    reportingManager: 'Sanjay Rao ΓÇö CHRO',
    role: 'HR',
    status: 'On Leave',
    phone: '+91 99001 55561',
    email: 'lakshmi.reddy@nexorahms.in',
    joinDate: '2019-03-18',
    emergencyContact: 'Somnath Reddy (Spouse) ┬╖ +91 99xxx xx561',
    licenseVerified: false,
    contractVerified: true,
    identityVerified: true,
    onCall: false,
    shiftToday: 'ΓÇö',
    lastAppraisal: '2025-12-05 ΓÇö Exceeds Expectations',
    kpiScore: 92,
    complianceCourses: [
      { name: 'Labour Law Update 2026', status: 'Complete' },
      { name: 'POSH Refresher', status: 'Complete' },
    ],
    salaryBand: 'Band D ΓÇö HR Specialist',
    payrollStatus: 'On Hold',
  },
  {
    id: 'e6',
    employeeCode: 'NX-EMP-00478',
    name: 'Dr. B. Joseph',
    designation: 'Emergency Medicine Consultant',
    department: 'Emergency Medicine',
    reportingManager: 'Dr. Kapoor ΓÇö HOD Emergency',
    role: 'Admin',
    status: 'On Duty',
    phone: '+91 98102 66678',
    email: 'b.joseph@nexorahms.in',
    joinDate: '2016-11-02',
    emergencyContact: 'Mary Joseph (Spouse) ┬╖ +91 98xxx xx678',
    medicalLicenseNo: 'KMC-90124',
    medicalLicenseExpiry: '2026-07-22',
    licenseVerified: true,
    contractVerified: true,
    identityVerified: true,
    onCall: true,
    shiftToday: '24x7 Roster ΓÇö Day Lead',
    lastAppraisal: '2026-04-01 ΓÇö Exceeds Expectations',
    kpiScore: 97,
    complianceCourses: [
      { name: 'ATLS Renewal', status: 'Complete' },
      { name: 'Trauma Team Training', status: 'Complete' },
    ],
    salaryBand: 'Band E ΓÇö Consultant',
    payrollStatus: 'Processed',
  },
];

export const MOCK_SHIFT_ROSTER: ShiftRosterEntry[] = [
  { id: 'sr1', employeeName: 'Dr. Anita Roy', department: 'Cardiology', shift: 'Morning', schedule: 'MonΓÇôFri 07:00ΓÇô15:00', onCall: true, roomOrWard: 'OPD Block C' },
  { id: 'sr2', employeeName: 'Sister Meera Iyer', department: 'Nursing ΓÇö ICU', shift: 'Morning', schedule: 'Rotating 07:00ΓÇô15:00', onCall: false, roomOrWard: 'ICU-4' },
  { id: 'sr3', employeeName: 'Dr. B. Joseph', department: 'Emergency', shift: 'Day Lead', schedule: '24x7 roster', onCall: true, roomOrWard: 'ER Trauma' },
  { id: 'sr4', employeeName: 'Priya Nair', department: 'Front Office', shift: 'Morning', schedule: '08:00ΓÇô16:00', onCall: false, roomOrWard: 'Reception Desk-02' },
  { id: 'sr5', employeeName: 'Dr. Rajesh Kumar', department: 'General Medicine', shift: 'Evening', schedule: '14:00ΓÇô22:00', onCall: false, roomOrWard: 'OPD Block G' },
];

export const MOCK_ATTENDANCE: AttendanceEntry[] = [
  { id: 'a1', employeeName: 'Priya Nair', employeeCode: 'NX-EMP-00428', checkIn: '08:02', checkOut: 'ΓÇö', method: 'Biometric', lateMinutes: 2 },
  { id: 'a2', employeeName: 'Dr. Anita Roy', employeeCode: 'NX-EMP-00412', checkIn: '06:55', method: 'Biometric', lateMinutes: 0 },
  { id: 'a3', employeeName: 'Sister Meera Iyer', employeeCode: 'NX-EMP-00391', checkIn: '07:18', method: 'Biometric', lateMinutes: 18 },
  { id: 'a4', employeeName: 'Arjun Das', employeeCode: 'NX-EMP-00455', checkIn: '09:00', method: 'Manual', lateMinutes: 0, leavePending: 'Half-day 19 Jul ΓÇö pending approval' },
  { id: 'a5', employeeName: 'Lakshmi Reddy', employeeCode: 'NX-EMP-00461', checkIn: 'ΓÇö', method: 'Manual', lateMinutes: 0, leavePending: 'Annual leave 17ΓÇô19 Jul ΓÇö approved' },
];

export const MOCK_LEAVE_REQUESTS: LeaveRequest[] = [
  { id: 'LR-901', employeeName: 'Arjun Das', type: 'Half-day', from: '2026-07-19', to: '2026-07-19', status: 'Pending' },
  { id: 'LR-898', employeeName: 'Vikram Shah', type: 'Casual', from: '2026-07-20', to: '2026-07-21', status: 'Pending' },
  { id: 'LR-895', employeeName: 'Deepa Singh', type: 'Sick', from: '2026-07-18', to: '2026-07-18', status: 'Approved' },
];

export const PERMISSION_MATRIX: PermissionMatrixRow[] = [
  { module: 'Patient Records (Read)', admin: true, hr: false, deptHead: true, it: false, employee: false },
  { module: 'Patient Records (Write)', admin: true, hr: false, deptHead: true, it: false, employee: false },
  { module: 'Staff Directory (Manage)', admin: true, hr: true, deptHead: false, it: false, employee: false },
  { module: 'Payroll Processing', admin: true, hr: true, deptHead: false, it: false, employee: false },
  { module: 'System Configuration', admin: true, hr: false, deptHead: false, it: true, employee: false },
  { module: 'Self-Service Portal', admin: true, hr: true, deptHead: true, it: true, employee: true },
  { module: 'Audit Logs (View)', admin: true, hr: false, deptHead: false, it: true, employee: false },
  { module: 'Device / Terminal Access', admin: true, hr: false, deptHead: false, it: true, employee: false },
];

export const MOCK_PAYSLIP_LOGS: PayslipLog[] = [
  { id: 'PS-8847', employeeName: 'Dr. Anita Roy', period: 'Jun 2026', amount: 285000, status: 'Sent', generatedAt: '2026-07-01T09:00:00' },
  { id: 'PS-8842', employeeName: 'Priya Nair', period: 'Jun 2026', amount: 42000, status: 'Sent', generatedAt: '2026-07-01T09:05:00' },
  { id: 'PS-8839', employeeName: 'Sister Meera Iyer', period: 'Jun 2026', amount: 68000, status: 'Generated', generatedAt: '2026-07-01T09:10:00' },
  { id: 'PS-8831', employeeName: 'Lakshmi Reddy', period: 'Jun 2026', amount: 92000, status: 'Failed', generatedAt: '2026-07-01T09:15:00' },
];

export const SALARY_STRUCTURES = [
  { band: 'Band E ΓÇö Consultant', base: 'Γé╣2,40,000 ΓÇô Γé╣3,20,000', components: 'Basic + HRA + Clinical Allowance + On-call' },
  { band: 'Band D ΓÇö Clinical Lead', base: 'Γé╣55,000 ΓÇô Γé╣85,000', components: 'Basic + HRA + Shift Differential' },
  { band: 'Band C ΓÇö Technical', base: 'Γé╣45,000 ΓÇô Γé╣75,000', components: 'Basic + HRA + IT Allowance' },
  { band: 'Band B ΓÇö Operations', base: 'Γé╣28,000 ΓÇô Γé╣48,000', components: 'Basic + HRA + Transport' },
];

export function searchEmployees(query: string, employees = MOCK_EMPLOYEES): EmployeeRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return employees;
  return employees.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      e.employeeCode.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q) ||
      e.designation.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q),
  );
}

export function getEmployeeById(id: string): EmployeeRecord | undefined {
  return MOCK_EMPLOYEES.find((e) => e.id === id);
}

export { formatINR as formatInr } from '@/lib/utils/currency';
