-- Multi-tenant columns for hospital_staff_credentials
-- Safe to re-run in Supabase SQL Editor.

ALTER TABLE public.hospital_staff_credentials
  ADD COLUMN IF NOT EXISTS hospital_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS hospital_name VARCHAR(200);

UPDATE public.hospital_staff_credentials
SET
  hospital_id = COALESCE(hospital_id, 'HOSP-01'),
  hospital_name = COALESCE(hospital_name, facility_node, 'Regal Hospital Main')
WHERE hospital_id IS NULL OR hospital_name IS NULL;

ALTER TABLE public.hospital_staff_credentials
  ALTER COLUMN hospital_id SET DEFAULT 'HOSP-01',
  ALTER COLUMN hospital_name SET DEFAULT 'Regal Hospital Main';

CREATE INDEX IF NOT EXISTS idx_hospital_staff_credentials_hospital
  ON public.hospital_staff_credentials (hospital_id);

CREATE INDEX IF NOT EXISTS idx_hospital_staff_credentials_hospital_name
  ON public.hospital_staff_credentials (hospital_name);
