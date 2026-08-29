-- Super Admin hospital onboarding: tenant registry + admin credential provisioning
-- Safe to re-run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.hospital_tenants (
  hospital_id VARCHAR(50) PRIMARY KEY,
  hospital_name VARCHAR(200) NOT NULL,
  city VARCHAR(100) NOT NULL DEFAULT 'Bengaluru',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hospital_tenants_name
  ON public.hospital_tenants (hospital_name);

ALTER TABLE public.hospital_tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_hospital_tenants_operations" ON public.hospital_tenants;
CREATE POLICY "allow_hospital_tenants_operations" ON public.hospital_tenants
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.hospital_tenants REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'hospital_tenants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hospital_tenants;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.onboard_new_hospital(
  p_hospital_id TEXT,
  p_hospital_name TEXT,
  p_city TEXT,
  p_admin_name TEXT,
  p_admin_email TEXT,
  p_admin_passcode TEXT,
  p_admin_phone TEXT DEFAULT '+91 98450 00000'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hospital_id TEXT;
  v_admin_id TEXT;
BEGIN
  v_hospital_id := upper(trim(p_hospital_id));
  v_admin_id := v_hospital_id || '-ADM01';

  INSERT INTO public.hospital_tenants (hospital_id, hospital_name, city)
  VALUES (v_hospital_id, trim(p_hospital_name), trim(p_city))
  ON CONFLICT (hospital_id) DO UPDATE SET
    hospital_name = EXCLUDED.hospital_name,
    city = EXCLUDED.city;

  INSERT INTO public.hospital_staff_credentials (
    id,
    hospital_id,
    hospital_name,
    full_name,
    staff_type,
    department,
    email,
    temporary_passcode,
    phone,
    portal_access,
    status,
    is_logged_in
  ) VALUES (
    v_admin_id,
    v_hospital_id,
    trim(p_hospital_name),
    trim(p_admin_name),
    'Admin',
    'Hospital Operations',
    lower(trim(p_admin_email)),
    trim(p_admin_passcode),
    coalesce(nullif(trim(p_admin_phone), ''), '+91 98450 00000'),
    '/dashboard',
    'Active',
    false
  )
  ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    hospital_id = EXCLUDED.hospital_id,
    hospital_name = EXCLUDED.hospital_name,
    full_name = EXCLUDED.full_name,
    temporary_passcode = EXCLUDED.temporary_passcode,
    phone = EXCLUDED.phone,
    portal_access = EXCLUDED.portal_access,
    status = 'Active';

END;
$$;

GRANT EXECUTE ON FUNCTION public.onboard_new_hospital(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
