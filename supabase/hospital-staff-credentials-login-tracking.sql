-- Login session tracking + unique email upsert for hospital_staff_credentials
-- Safe to re-run in Supabase SQL Editor.

ALTER TABLE public.hospital_staff_credentials
  ADD COLUMN IF NOT EXISTS is_logged_in BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hospital_staff_credentials_email_unique
  ON public.hospital_staff_credentials (email);

ALTER TABLE public.hospital_staff_credentials REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'hospital_staff_credentials'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hospital_staff_credentials;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
