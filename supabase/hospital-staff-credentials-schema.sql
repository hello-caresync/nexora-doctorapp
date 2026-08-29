-- Hospital Staff Credentials — persistent RBAC credential vault
-- Safe to re-run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.hospital_staff_credentials (
  id VARCHAR(20) PRIMARY KEY,
  hospital_id VARCHAR(50) NOT NULL DEFAULT 'HOSP-01',
  hospital_name VARCHAR(200) NOT NULL DEFAULT 'Regal Hospital Main',
  full_name VARCHAR(200) NOT NULL,
  staff_type VARCHAR(30) NOT NULL,
  department VARCHAR(150) NOT NULL,
  email VARCHAR(200) NOT NULL,
  temporary_passcode VARCHAR(100) NOT NULL,
  phone VARCHAR(30) DEFAULT '+91 98450 00000',
  facility_node VARCHAR(100) DEFAULT 'Regal Hospital Main',
  portal_access VARCHAR(100) NOT NULL,
  status VARCHAR(30) DEFAULT 'Active',
  is_logged_in BOOLEAN DEFAULT false,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hospital_staff_credentials_email_unique
  ON public.hospital_staff_credentials (email);

CREATE INDEX IF NOT EXISTS idx_hospital_staff_credentials_hospital
  ON public.hospital_staff_credentials (hospital_id);

CREATE INDEX IF NOT EXISTS idx_hospital_staff_credentials_hospital_name
  ON public.hospital_staff_credentials (hospital_name);

CREATE INDEX IF NOT EXISTS idx_hospital_staff_credentials_role
  ON public.hospital_staff_credentials (staff_type);

CREATE INDEX IF NOT EXISTS idx_hospital_staff_credentials_email
  ON public.hospital_staff_credentials (email);

CREATE INDEX IF NOT EXISTS idx_hospital_staff_credentials_created
  ON public.hospital_staff_credentials (created_at DESC);

ALTER TABLE public.hospital_staff_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_staff_credentials_operations" ON public.hospital_staff_credentials;
CREATE POLICY "allow_staff_credentials_operations" ON public.hospital_staff_credentials
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);
