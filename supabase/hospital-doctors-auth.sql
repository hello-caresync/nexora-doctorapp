-- Hospital clinician registry for Doctor EMR login portal
-- Run in Supabase SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.hospital_doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id VARCHAR(20) NOT NULL UNIQUE,
  doctor_name TEXT NOT NULL,
  email TEXT UNIQUE,
  department TEXT,
  specialization TEXT,
  passcode VARCHAR(32) NOT NULL DEFAULT '123456',
  hospital_code VARCHAR(50) DEFAULT 'RH-BLR-01',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hospital_doctors_doctor_id
  ON public.hospital_doctors (doctor_id);

CREATE INDEX IF NOT EXISTS idx_hospital_doctors_email
  ON public.hospital_doctors (email);

INSERT INTO public.hospital_doctors
  (doctor_id, doctor_name, email, department, specialization, passcode)
VALUES
  (
    'RH-D06',
    'Dr. Chandrakanth S. Kesari',
    'chandrakanth@regalhospital.com',
    'General Surgery',
    'General Surgeon',
    'KESARI8821'
  ),
  (
    'RH-D07',
    'Dr. Sneha Reddy',
    'sneha@regalhospital.com',
    'Cardiology',
    'Interventional Cardiologist',
    'SNEHA7742'
  ),
  (
    'RH-D08',
    'Dr. Arvind Kumar',
    'arvind@regalhospital.com',
    'Orthopedics',
    'Orthopedic Surgeon',
    'ARVIND5591'
  )
ON CONFLICT (doctor_id) DO UPDATE SET
  doctor_name = EXCLUDED.doctor_name,
  email = EXCLUDED.email,
  department = EXCLUDED.department,
  specialization = EXCLUDED.specialization,
  passcode = EXCLUDED.passcode,
  updated_at = now();

ALTER TABLE public.hospital_doctors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_hospital_doctors_read" ON public.hospital_doctors;
CREATE POLICY "open_hospital_doctors_read" ON public.hospital_doctors
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

ALTER TABLE public.hospital_doctors REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'hospital_doctors'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hospital_doctors;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
