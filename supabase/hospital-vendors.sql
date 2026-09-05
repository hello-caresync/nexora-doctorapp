CREATE TABLE IF NOT EXISTS public.hospital_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id TEXT NOT NULL DEFAULT 'HOSP-01',
  vendor_name TEXT,
  company_name TEXT NOT NULL,
  email TEXT,
  vendor_email TEXT,
  rep_email TEXT,
  category TEXT NOT NULL DEFAULT 'Pharmaceuticals',
  passcode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS hospital_vendors_email_idx
  ON public.hospital_vendors ((lower(COALESCE(email, vendor_email, rep_email))))
  WHERE COALESCE(email, vendor_email, rep_email) IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hospital_vendors_hospital
  ON public.hospital_vendors (hospital_id, created_at DESC);

ALTER TABLE public.hospital_vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hospital_vendors_anon_all ON public.hospital_vendors;
CREATE POLICY hospital_vendors_anon_all
ON public.hospital_vendors
FOR ALL
TO public, anon, authenticated, service_role
USING (true)
WITH CHECK (true);

GRANT ALL ON public.hospital_vendors TO anon, authenticated, service_role;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'hospital_vendors'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hospital_vendors;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
