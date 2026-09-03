-- Hospital OS node-scoped operational tables (safe to re-run)
-- Aligns dashboard inserts with hospital_id = active facility node (e.g. HOSP-01).

CREATE TABLE IF NOT EXISTS public.hospital_opd_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id TEXT NOT NULL,
  hospital_name TEXT,
  token_number TEXT,
  uhid TEXT,
  patient_name TEXT NOT NULL,
  phone TEXT,
  department TEXT NOT NULL DEFAULT 'OPD',
  doctor_name TEXT,
  status TEXT NOT NULL DEFAULT 'WAITING',
  source TEXT,
  appointment_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hospital_pharmacy_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Medicine',
  stock INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'In Stock',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hospital_beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id TEXT NOT NULL,
  ward TEXT,
  ward_name TEXT,
  bed_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Available',
  is_occupied BOOLEAN NOT NULL DEFAULT false,
  patient_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hospital_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id TEXT NOT NULL,
  invoice_number TEXT,
  patient_name TEXT NOT NULL,
  service_type TEXT NOT NULL DEFAULT 'OPD Consultation',
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hospital_supply_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id TEXT NOT NULL,
  po_number TEXT,
  vendor_name TEXT NOT NULL,
  item_description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ISSUED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hospital_emergencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  chief_complaint TEXT,
  priority TEXT NOT NULL DEFAULT 'P3',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hospital_beds ADD COLUMN IF NOT EXISTS hospital_id TEXT;
ALTER TABLE public.hospital_beds ADD COLUMN IF NOT EXISTS ward_name TEXT;
ALTER TABLE public.hospital_beds ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.hospital_beds ADD COLUMN IF NOT EXISTS is_occupied BOOLEAN;
ALTER TABLE public.hospital_beds ADD COLUMN IF NOT EXISTS patient_name TEXT;

CREATE INDEX IF NOT EXISTS idx_hospital_opd_queue_hospital ON public.hospital_opd_queue (hospital_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_hospital ON public.hospital_pharmacy_inventory (hospital_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hospital_beds_hospital ON public.hospital_beds (hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_invoices_hospital ON public.hospital_invoices (hospital_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hospital_supply_orders_hospital ON public.hospital_supply_orders (hospital_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hospital_emergencies_hospital ON public.hospital_emergencies (hospital_id, created_at DESC);

ALTER TABLE public.hospital_opd_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_pharmacy_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_supply_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_emergencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hospital_opd_queue_anon ON public.hospital_opd_queue;
CREATE POLICY hospital_opd_queue_anon ON public.hospital_opd_queue FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hospital_pharmacy_inventory_anon ON public.hospital_pharmacy_inventory;
CREATE POLICY hospital_pharmacy_inventory_anon ON public.hospital_pharmacy_inventory FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hospital_beds_anon ON public.hospital_beds;
CREATE POLICY hospital_beds_anon ON public.hospital_beds FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hospital_invoices_anon ON public.hospital_invoices;
CREATE POLICY hospital_invoices_anon ON public.hospital_invoices FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hospital_supply_orders_anon ON public.hospital_supply_orders;
CREATE POLICY hospital_supply_orders_anon ON public.hospital_supply_orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hospital_emergencies_anon ON public.hospital_emergencies;
CREATE POLICY hospital_emergencies_anon ON public.hospital_emergencies FOR ALL USING (true) WITH CHECK (true);

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'hospital_opd_queue',
    'hospital_pharmacy_inventory',
    'hospital_invoices',
    'hospital_supply_orders',
    'hospital_beds',
    'hospital_emergencies',
    'appointments',
    'hospital_staff_credentials'
  ])
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
             WHEN undefined_object THEN NULL;
    END;
  END LOOP;
END $$;
