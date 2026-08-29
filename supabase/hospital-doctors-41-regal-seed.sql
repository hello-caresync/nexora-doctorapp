-- Regal Hospital · 41-clinician credential registry for EMR login portal
-- Run after hospital-doctors-auth.sql in Supabase SQL Editor.

ALTER TABLE public.hospital_doctors
  ADD COLUMN IF NOT EXISTS portal_route TEXT DEFAULT '/doctor';

INSERT INTO public.hospital_doctors
  (doctor_id, doctor_name, email, department, specialization, passcode, portal_route)
VALUES
  ('RH-D01', 'Dr. Suriraju V', 'dr.suriraju@regalhospital.com', 'Urology', 'Consultant Urologist', 'Suri@Uro9101', '/doctor'),
  ('RH-D02', 'Dr. Chandrakanth S. Kesari', 'dr.kesari@regalhospital.com', 'General Surgery', 'General Surgeon', 'Kesari@Gen9102', '/doctor'),
  ('RH-D03', 'Dr. Ananya R', 'dr.ananya@regalhospital.com', 'General Medicine', 'Physician', 'Anan@Med9103', '/doctor'),
  ('RH-D04', 'Dr. Vikramaditya Rao', 'dr.vikramaditya@regalhospital.com', 'Cardiology', 'Cardiologist', 'Reg@l042026', '/doctor'),
  ('RH-D05', 'Dr. Meera Nambiar', 'dr.meera@regalhospital.com', 'Cardiology', 'Cardiologist', 'Reg@l052026', '/doctor'),
  ('RH-D06', 'Dr. Rajesh Kumar Hegde', 'dr.rajesh@regalhospital.com', 'Orthopedics', 'Orthopedic Surgeon', 'Reg@l062026', '/doctor'),
  ('RH-D07', 'Dr. Shalini Deshmukh', 'dr.shalini@regalhospital.com', 'Orthopedics', 'Orthopedic Specialist', 'Reg@l072026', '/doctor'),
  ('RH-D08', 'Dr. Arvind Swamy', 'dr.arvind@regalhospital.com', 'Neurology', 'Neurologist', 'Reg@l082026', '/doctor'),
  ('RH-D09', 'Dr. Kavitha Reddy', 'dr.kavitha@regalhospital.com', 'Neurosurgery', 'Neurosurgeon', 'Reg@l092026', '/doctor'),
  ('RH-D10', 'Dr. Pradeep Verma', 'dr.pradeep@regalhospital.com', 'Gastroenterology', 'Gastroenterologist', 'Reg@l102026', '/doctor'),
  ('RH-D11', 'Dr. Sunitha Gopal', 'dr.sunitha@regalhospital.com', 'Gastroenterology', 'GI Specialist', 'Reg@l112026', '/doctor'),
  ('RH-D12', 'Dr. Anand Kulkarni', 'dr.anand@regalhospital.com', 'Nephrology', 'Nephrologist', 'Reg@l122026', '/doctor'),
  ('RH-D13', 'Dr. Archana Bhat', 'dr.archana@regalhospital.com', 'Pediatrics', 'Pediatrician', 'Reg@l132026', '/doctor'),
  ('RH-D14', 'Dr. Rohan D''Souza', 'dr.rohan@regalhospital.com', 'Pediatrics', 'Pediatrician', 'Reg@l142026', '/doctor'),
  ('RH-D15', 'Dr. Deepa Shankar', 'dr.deepa@regalhospital.com', 'Obstetrics & Gynecology', 'OB-GYN', 'Reg@l152026', '/doctor'),
  ('RH-D16', 'Dr. Priyanka Murthy', 'dr.priyanka@regalhospital.com', 'Obstetrics & Gynecology', 'OB-GYN', 'Reg@l162026', '/doctor'),
  ('RH-D17', 'Dr. Harish Prasad', 'dr.harish@regalhospital.com', 'Pulmonology', 'Pulmonologist', 'Reg@l172026', '/doctor'),
  ('RH-D18', 'Dr. Nandini Sen', 'dr.nandini@regalhospital.com', 'Dermatology', 'Dermatologist', 'Reg@l182026', '/doctor'),
  ('RH-D19', 'Dr. Karthik Subramanian', 'dr.karthik@regalhospital.com', 'ENT', 'ENT Specialist', 'Reg@l192026', '/doctor'),
  ('RH-D20', 'Dr. Smita Joshi', 'dr.smita@regalhospital.com', 'Ophthalmology', 'Ophthalmologist', 'Reg@l202026', '/doctor'),
  ('RH-D21', 'Dr. Manoj Kumar', 'dr.manoj@regalhospital.com', 'Ophthalmology', 'Ophthalmologist', 'Reg@l212026', '/doctor'),
  ('RH-D22', 'Dr. Sangeetha Iyengar', 'dr.sangeetha@regalhospital.com', 'Endocrinology', 'Endocrinologist', 'Reg@l222026', '/doctor'),
  ('RH-D23', 'Dr. Rakesh Nair', 'dr.rakesh@regalhospital.com', 'Oncology', 'Medical Oncologist', 'Reg@l232026', '/doctor'),
  ('RH-D24', 'Dr. Gautham Pai', 'dr.gautham@regalhospital.com', 'Oncology', 'Surgical Oncologist', 'Reg@l242026', '/doctor'),
  ('RH-D25', 'Dr. Vani S. Rao', 'dr.vani@regalhospital.com', 'Psychiatry', 'Psychiatrist', 'Reg@l252026', '/doctor'),
  ('RH-D26', 'Dr. Ashok Patel', 'dr.ashok@regalhospital.com', 'Rheumatology', 'Rheumatologist', 'Reg@l262026', '/doctor'),
  ('RH-D27', 'Dr. Varun Sundaram', 'dr.varun@regalhospital.com', 'Vascular Surgery', 'Vascular Surgeon', 'Reg@l272026', '/doctor'),
  ('RH-D28', 'Dr. Rashmi Kulkarni', 'dr.rashmi@regalhospital.com', 'Anaesthesiology', 'Anesthesiologist', 'Reg@l282026', '/doctor'),
  ('RH-D29', 'Dr. Sumeet Bhalla', 'dr.sumeet@regalhospital.com', 'Plastic Surgery', 'Plastic Surgeon', 'Reg@l292026', '/doctor'),
  ('RH-D30', 'Dr. Nithya Srinivas', 'dr.nithya@regalhospital.com', 'Pathology', 'Pathologist', 'Reg@l302026', '/doctor'),
  ('RH-D31', 'Dr. Jayakrishnan Nair', 'dr.jayakrishnan@regalhospital.com', 'Radiology', 'Radiologist', 'Reg@l312026', '/doctor'),
  ('RH-D32', 'Dr. Bhavana Shah', 'dr.bhavana@regalhospital.com', 'Radiology', 'Radiologist', 'Reg@l322026', '/doctor'),
  ('RH-D33', 'Dr. Santosh Shetty', 'dr.santosh@regalhospital.com', 'Emergency Medicine', 'Emergency Physician', 'Reg@l332026', '/doctor'),
  ('RH-D34', 'Dr. Madhavi Latha', 'dr.madhavi@regalhospital.com', 'Nuclear Medicine', 'Nuclear Medicine Specialist', 'Reg@l342026', '/doctor'),
  ('RH-D35', 'Dr. Chethan Gowda', 'dr.chethan@regalhospital.com', 'Physical Medicine & Rehab', 'PM&R Specialist', 'Reg@l352026', '/doctor'),
  ('RH-D36', 'Dr. Anushree Roy', 'dr.anushree@regalhospital.com', 'Clinical Immunology', 'Immunologist', 'Reg@l362026', '/doctor'),
  ('RH-D37', 'Dr. Girish Menon', 'dr.girish@regalhospital.com', 'Cardiothoracic Surgery', 'CT Surgeon', 'Reg@l372026', '/doctor'),
  ('RH-D38', 'Dr. Lavanya Krishnan', 'dr.lavanya@regalhospital.com', 'Pediatric Surgery', 'Pediatric Surgeon', 'Reg@l382026', '/doctor'),
  ('RH-D39', 'Dr. Hemanth Kumar', 'dr.hemanth@regalhospital.com', 'Geriatrics', 'Geriatrician', 'Reg@l392026', '/doctor'),
  ('RH-D40', 'Dr. Aparna Nair', 'dr.aparna@regalhospital.com', 'Infectious Diseases', 'Infectious Disease Specialist', 'Reg@l402026', '/doctor'),
  ('RH-D41', 'Dr. Balaji Venkat', 'dr.balaji@regalhospital.com', 'Pain Management', 'Pain Specialist', 'Reg@l412026', '/doctor')
ON CONFLICT (doctor_id) DO UPDATE SET
  doctor_name = EXCLUDED.doctor_name,
  email = EXCLUDED.email,
  department = EXCLUDED.department,
  specialization = EXCLUDED.specialization,
  passcode = EXCLUDED.passcode,
  portal_route = EXCLUDED.portal_route,
  updated_at = now();

NOTIFY pgrst, 'reload schema';
