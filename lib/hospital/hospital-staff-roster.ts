import type { SupabaseClient } from '@supabase/supabase-js';

import { HOSPITAL_TENANT_ID } from '@/lib/regal/constants';

export type DoctorStaffRecord = {
  id: string;
  full_name: string;
  department: string;
  qualification: string;
  consultation_fee: number;
};

export type HospitalStaffRoleCount = {
  accounts: number;
  doctors: number;
  staff: number;
  admins: number;
};

export const FALLBACK_HOSPITAL_DOCTORS: DoctorStaffRecord[] = [
  { id: 'RH-D01', full_name: 'Dr. Suriraju V', department: 'Urology & Andrology', qualification: 'MBBS, MS, MCh (Urology)', consultation_fee: 750 },
  { id: 'RH-D02', full_name: 'Dr. Ramesh Kumar', department: 'General Medicine', qualification: 'MBBS, MD (General Medicine)', consultation_fee: 500 },
  { id: 'RH-D03', full_name: 'Dr. Ananya Sharma', department: 'Obstetrics & Gynaecology', qualification: 'MBBS, DGO, MS (OBG)', consultation_fee: 600 },
  { id: 'RH-D04', full_name: 'Dr. Arvind Swamy', department: 'Orthopaedics & Joint Replacement', qualification: 'MBBS, MS (Ortho), DNB', consultation_fee: 700 },
  { id: 'RH-D05', full_name: 'Dr. Priya Raghavan', department: 'Paediatrics & Neonatology', qualification: 'MBBS, MD (Paediatrics)', consultation_fee: 550 },
  { id: 'RH-D06', full_name: 'Dr. Mohammed Farooq', department: 'Cardiology', qualification: 'MBBS, MD, DM (Cardiology)', consultation_fee: 900 },
  { id: 'RH-D07', full_name: 'Dr. Deepa Natarajan', department: 'Dermatology & Cosmetology', qualification: 'MBBS, DVD, MD', consultation_fee: 650 },
  { id: 'RH-D08', full_name: 'Dr. Suresh Babu', department: 'General & Laparoscopic Surgery', qualification: 'MBBS, MS (General Surgery)', consultation_fee: 700 },
  { id: 'RH-D09', full_name: 'Dr. Meera Nambiar', department: 'Neurology', qualification: 'MBBS, MD, DM (Neurology)', consultation_fee: 850 },
  { id: 'RH-D10', full_name: 'Dr. Vikramaditya Rao', department: 'Neurosurgery', qualification: 'MBBS, MS, MCh (Neuro)', consultation_fee: 1000 },
  { id: 'RH-D11', full_name: 'Dr. Shalini Hegde', department: 'ENT, Head & Neck Surgery', qualification: 'MBBS, MS (ENT)', consultation_fee: 550 },
  { id: 'RH-D12', full_name: 'Dr. Rajesh Deshmukh', department: 'Gastroenterology', qualification: 'MBBS, MD, DM (Gastro)', consultation_fee: 800 },
  { id: 'RH-D13', full_name: 'Dr. Neha Kulkarni', department: 'Pulmonology & Chest Medicine', qualification: 'MBBS, DTCD, MD (Pulmo)', consultation_fee: 650 },
  { id: 'RH-D14', full_name: 'Dr. Karthik Prasad', department: 'Nephrology', qualification: 'MBBS, MD, DM (Nephrology)', consultation_fee: 850 },
  { id: 'RH-D15', full_name: 'Dr. Sunita Acharya', department: 'Ophthalmology', qualification: 'MBBS, MS (Ophthalmology)', consultation_fee: 500 },
  { id: 'RH-D16', full_name: 'Dr. Vinay Mohan', department: 'Psychiatry & Deaddiction', qualification: 'MBBS, MD (Psychiatry)', consultation_fee: 700 },
  { id: 'RH-D17', full_name: 'Dr. Rekha Kamath', department: 'Endocrinology & Diabetology', qualification: 'MBBS, MD, DM (Endo)', consultation_fee: 800 },
  { id: 'RH-D18', full_name: 'Dr. Anand Joshi', department: 'Medical Oncology', qualification: 'MBBS, MD, DM (Oncology)', consultation_fee: 950 },
  { id: 'RH-D19', full_name: 'Dr. Sowmya Reddy', department: 'Surgical Oncology', qualification: 'MBBS, MS, MCh (Surg Onco)', consultation_fee: 1000 },
  { id: 'RH-D20', full_name: 'Dr. Harish Gowda', department: 'Rheumatology', qualification: 'MBBS, MD, Fellowship Rheumatology', consultation_fee: 750 },
  { id: 'RH-D21', full_name: 'Dr. Divya Iyer', department: 'Physical Medicine & Rehabilitation', qualification: 'MBBS, DPMR, DNB', consultation_fee: 500 },
  { id: 'RH-D22', full_name: 'Dr. Chetan Patil', department: 'Plastic & Reconstructive Surgery', qualification: 'MBBS, MS, MCh (Plastic)', consultation_fee: 900 },
  { id: 'RH-D23', full_name: 'Dr. Poornima Shenoy', department: 'Pathology & Lab Medicine', qualification: 'MBBS, MD (Pathology)', consultation_fee: 450 },
  { id: 'RH-D24', full_name: 'Dr. Sandeep Verma', department: 'Radiodiagnosis & Imaging', qualification: 'MBBS, MD (Radiology)', consultation_fee: 550 },
  { id: 'RH-D25', full_name: 'Dr. Geetha Venkatesh', department: 'Anaesthesiology & Pain Clinic', qualification: 'MBBS, DA, MD', consultation_fee: 600 },
  { id: 'RH-D26', full_name: 'Dr. Manoj Prabhakar', department: 'Emergency Medicine & Trauma', qualification: 'MBBS, MEM, MRCEM', consultation_fee: 650 },
  { id: 'RH-D27', full_name: 'Dr. Roopa Mahadev', department: 'Vascular Surgery', qualification: 'MBBS, MS, MCh (Vascular)', consultation_fee: 850 },
  { id: 'RH-D28', full_name: 'Dr. Kiran Somayaji', department: 'Paediatric Surgery', qualification: 'MBBS, MS, MCh (Paed Surg)', consultation_fee: 800 },
  { id: 'RH-D29', full_name: 'Dr. Archana Bhat', department: 'Clinical Haematology', qualification: 'MBBS, MD, DM (Haematology)', consultation_fee: 850 },
  { id: 'RH-D30', full_name: 'Dr. Gautham Baliga', department: 'Infectious Diseases', qualification: 'MBBS, MD, FNB (Infectious)', consultation_fee: 700 },
  { id: 'RH-D31', full_name: 'Dr. Shilpa Shetty', department: 'Nuclear Medicine', qualification: 'MBBS, DRM, DNB', consultation_fee: 750 },
  { id: 'RH-D32', full_name: 'Dr. Praveen Nayak', department: 'Critical Care Medicine (ICU)', qualification: 'MBBS, IDCCM, EDIC', consultation_fee: 700 },
  { id: 'RH-D33', full_name: 'Dr. Snehalatha K', department: 'Geriatric Medicine', qualification: 'MBBS, MD (Geriatrics)', consultation_fee: 550 },
  { id: 'RH-D34', full_name: 'Dr. Bharat Mallikarjun', department: 'Interventional Radiology', qualification: 'MBBS, MD, FVIR', consultation_fee: 900 },
  { id: 'RH-D35', full_name: 'Dr. Tanuja Murthy', department: 'Fetal Medicine & Genetics', qualification: 'MBBS, MS, Fellowship Fetal Med', consultation_fee: 800 },
  { id: 'RH-D36', full_name: 'Dr. Shashi Kiran', department: 'Sports Medicine & Arthroscopy', qualification: 'MBBS, MS (Ortho), Fellowship Sports', consultation_fee: 750 },
  { id: 'RH-D37', full_name: 'Dr. Lakshmi Prasanna', department: 'Allergy & Clinical Immunology', qualification: 'MBBS, MD, Fellowship Allergy', consultation_fee: 600 },
  { id: 'RH-D38', full_name: 'Dr. Ajay Narang', department: 'Cardiothoracic Surgery', qualification: 'MBBS, MS, MCh (CTVS)', consultation_fee: 1100 },
  { id: 'RH-D39', full_name: 'Dr. Nandini Urs', department: 'Dentistry & Maxillofacial', qualification: 'BDS, MDS (Maxillofacial)', consultation_fee: 500 },
  { id: 'RH-D40', full_name: 'Dr. Jagadish Chandra', department: 'Hepato-Pancreato-Biliary (HPB)', qualification: 'MBBS, MS, MCh (HPB Surgery)', consultation_fee: 1050 },
  { id: 'RH-D41', full_name: 'Dr. Suhasini Rao', department: 'Medical Genetics & Counseling', qualification: 'MBBS, MD (Genetics)', consultation_fee: 700 },
];

export function mapDoctorStaffRecord(row: Record<string, unknown>): DoctorStaffRecord {
  return {
    id: String(row.id ?? ''),
    full_name: String(row.full_name ?? row.doctor_name ?? row.name ?? ''),
    department: String(row.department ?? 'General Medicine'),
    qualification: String(row.qualification ?? ''),
    consultation_fee: Number(row.consultation_fee ?? row.fee ?? 500) || 500,
  };
}

export function formatConsultationFee(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export async function fetchActiveHospitalDoctors(
  supabase: SupabaseClient,
  hospitalId = HOSPITAL_TENANT_ID,
): Promise<DoctorStaffRecord[]> {
  const { data, error } = await supabase
    .from('hospital_staff')
    .select('id, full_name, department, qualification, consultation_fee, role, is_active, hospital_id')
    .eq('hospital_id', hospitalId)
    .eq('role', 'doctor')
    .eq('is_active', true)
    .order('full_name', { ascending: true });

  if (error || !Array.isArray(data) || data.length === 0) {
    return FALLBACK_HOSPITAL_DOCTORS;
  }

  return data.map((row) => mapDoctorStaffRecord(row as Record<string, unknown>)).filter((row) => row.full_name);
}

export async function fetchHospitalStaffCounts(
  supabase: SupabaseClient,
  hospitalId = HOSPITAL_TENANT_ID,
): Promise<HospitalStaffRoleCount> {
  const { data, error } = await supabase
    .from('hospital_staff')
    .select('role')
    .eq('hospital_id', hospitalId)
    .eq('is_active', true);

  if (error || !Array.isArray(data)) {
    return { accounts: 45, doctors: 41, staff: 3, admins: 1 };
  }

  const roles = data.map((row) => String((row as { role?: string }).role ?? '').toLowerCase());
  const doctors = roles.filter((role) => role === 'doctor').length;
  const staff = roles.filter((role) => role === 'staff').length;
  const admins = roles.filter((role) => role === 'admin').length;
  return {
    accounts: data.length,
    doctors,
    staff,
    admins,
  };
}
