-- Records & Pharmacy Command Center (HOSP-01)
-- Apply in Supabase SQL Editor. Enables medical records, prescriptions,
-- formulary, inventory movements, and atomic dispense.

CREATE TABLE IF NOT EXISTS public.hospital_medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id TEXT NOT NULL DEFAULT 'HOSP-01',
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Medicine',
  strength TEXT,
  unit TEXT DEFAULT 'strip',
  current_stock INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 10,
  batch_number TEXT,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'In Stock',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS hospital_medicines_hospital_sku_idx
  ON public.hospital_medicines (hospital_id, lower(sku));

CREATE INDEX IF NOT EXISTS hospital_medicines_hospital_idx
  ON public.hospital_medicines (hospital_id);

CREATE TABLE IF NOT EXISTS public.hospital_prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id TEXT NOT NULL DEFAULT 'HOSP-01',
  appointment_id TEXT,
  uhid TEXT,
  patient_name TEXT NOT NULL,
  doctor_id TEXT,
  doctor_name TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dispensed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS hospital_prescriptions_hospital_idx
  ON public.hospital_prescriptions (hospital_id, created_at DESC);

CREATE INDEX IF NOT EXISTS hospital_prescriptions_status_idx
  ON public.hospital_prescriptions (hospital_id, status);

CREATE TABLE IF NOT EXISTS public.hospital_prescription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES public.hospital_prescriptions(id) ON DELETE CASCADE,
  medicine_id UUID REFERENCES public.hospital_medicines(id) ON DELETE SET NULL,
  medicine_name TEXT NOT NULL,
  sku TEXT,
  dosage TEXT,
  frequency TEXT,
  qty_required INTEGER NOT NULL DEFAULT 1,
  qty_dispensed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hospital_prescription_items_rx_idx
  ON public.hospital_prescription_items (prescription_id);

CREATE TABLE IF NOT EXISTS public.hospital_clinical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id TEXT NOT NULL DEFAULT 'HOSP-01',
  uhid TEXT,
  patient_name TEXT NOT NULL,
  activity_type TEXT NOT NULL DEFAULT 'record_update',
  activity TEXT NOT NULL,
  doctor_name TEXT,
  status TEXT NOT NULL DEFAULT 'recorded',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hospital_clinical_records_hospital_idx
  ON public.hospital_clinical_records (hospital_id, created_at DESC);

CREATE INDEX IF NOT EXISTS hospital_clinical_records_uhid_idx
  ON public.hospital_clinical_records (hospital_id, uhid);

CREATE TABLE IF NOT EXISTS public.hospital_inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id TEXT NOT NULL DEFAULT 'HOSP-01',
  medicine_id UUID REFERENCES public.hospital_medicines(id) ON DELETE SET NULL,
  sku TEXT,
  medicine_name TEXT,
  txn_type TEXT NOT NULL DEFAULT 'adjust',
  quantity INTEGER NOT NULL DEFAULT 0,
  balance_after INTEGER,
  reference_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hospital_inventory_tx_hospital_idx
  ON public.hospital_inventory_transactions (hospital_id, created_at DESC);

DO $$
BEGIN
  IF to_regclass('public.hospital_pharmacy_inventory') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.hospital_medicines (
    hospital_id, name, sku, category, current_stock, reorder_level, status
  )
  SELECT
    COALESCE(inv.hospital_id, 'HOSP-01'),
    TRIM(COALESCE(inv.item_name, 'Medicine')),
    'SKU-' || UPPER(SUBSTRING(MD5(TRIM(COALESCE(inv.item_name, inv.id::text))) FROM 1 FOR 8)),
    COALESCE(NULLIF(TRIM(inv.category), ''), 'Medicine'),
    COALESCE(inv.stock, 0),
    10,
    CASE
      WHEN COALESCE(inv.stock, 0) <= 0 THEN 'Out of Stock'
      ELSE COALESCE(NULLIF(inv.status, ''), 'In Stock')
    END
  FROM public.hospital_pharmacy_inventory inv
  ON CONFLICT DO NOTHING;
EXCEPTION
  WHEN undefined_column THEN
    NULL;
  WHEN undefined_table THEN
    NULL;
END $$;

CREATE OR REPLACE FUNCTION public.dispense_prescription_atomic(
  p_prescription_id UUID,
  p_hospital_id TEXT,
  p_lines JSONB,
  p_dispensed_by TEXT DEFAULT 'Pharmacy Desk'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  line JSONB;
  v_qty INTEGER;
  v_medicine_id UUID;
  v_sku TEXT;
  v_name TEXT;
  v_item_id UUID;
  v_stock INTEGER;
  v_reorder INTEGER;
  v_new_stock INTEGER;
  v_all_filled BOOLEAN := TRUE;
  v_any_filled BOOLEAN := FALSE;
  v_status TEXT;
  v_patient_name TEXT;
  v_uhid TEXT;
BEGIN
  SELECT patient_name, uhid
  INTO v_patient_name, v_uhid
  FROM public.hospital_prescriptions
  WHERE id = p_prescription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prescription not found';
  END IF;

  FOR line IN SELECT * FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb))
  LOOP
    v_qty := GREATEST(0, COALESCE((line->>'qty')::INTEGER, 0));
    IF v_qty <= 0 THEN
      CONTINUE;
    END IF;

    v_medicine_id := NULLIF(line->>'medicine_id', '')::UUID;
    v_sku := NULLIF(line->>'sku', '');
    v_name := COALESCE(NULLIF(line->>'medicine_name', ''), 'Medicine');
    v_item_id := NULLIF(line->>'item_id', '')::UUID;

    IF v_medicine_id IS NOT NULL THEN
      SELECT current_stock, reorder_level, name, sku
      INTO v_stock, v_reorder, v_name, v_sku
      FROM public.hospital_medicines
      WHERE id = v_medicine_id
      FOR UPDATE;
    ELSIF v_sku IS NOT NULL THEN
      SELECT id, current_stock, reorder_level, name
      INTO v_medicine_id, v_stock, v_reorder, v_name
      FROM public.hospital_medicines
      WHERE hospital_id = p_hospital_id AND lower(sku) = lower(v_sku)
      FOR UPDATE;
    ELSE
      SELECT id, current_stock, reorder_level, sku
      INTO v_medicine_id, v_stock, v_reorder, v_sku
      FROM public.hospital_medicines
      WHERE hospital_id = p_hospital_id AND lower(name) = lower(v_name)
      LIMIT 1
      FOR UPDATE;
    END IF;

    IF v_medicine_id IS NULL THEN
      RAISE EXCEPTION 'Medicine not found: %', v_name;
    END IF;

    IF COALESCE(v_stock, 0) < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for %: have %, need %', v_name, v_stock, v_qty;
    END IF;

    v_new_stock := v_stock - v_qty;
    v_reorder := COALESCE(v_reorder, 10);

    UPDATE public.hospital_medicines
    SET
      current_stock = v_new_stock,
      status = CASE
        WHEN v_new_stock <= 0 THEN 'Out of Stock'
        WHEN v_new_stock <= v_reorder THEN 'Low Stock'
        ELSE 'In Stock'
      END,
      updated_at = NOW()
    WHERE id = v_medicine_id;

    UPDATE public.hospital_pharmacy_inventory
    SET
      stock = v_new_stock,
      status = CASE WHEN v_new_stock <= 0 THEN 'Out of Stock' ELSE 'In Stock' END
    WHERE hospital_id = p_hospital_id
      AND (
        id::text = v_medicine_id::text
        OR lower(item_name) = lower(v_name)
      );

    IF v_item_id IS NOT NULL THEN
      UPDATE public.hospital_prescription_items
      SET qty_dispensed = COALESCE(qty_dispensed, 0) + v_qty
      WHERE id = v_item_id;
    ELSE
      UPDATE public.hospital_prescription_items
      SET qty_dispensed = COALESCE(qty_dispensed, 0) + v_qty
      WHERE prescription_id = p_prescription_id
        AND lower(medicine_name) = lower(v_name);
    END IF;

    INSERT INTO public.hospital_inventory_transactions (
      hospital_id, medicine_id, sku, medicine_name, txn_type, quantity, balance_after, reference_id, notes
    ) VALUES (
      p_hospital_id,
      v_medicine_id,
      v_sku,
      v_name,
      'dispense',
      -v_qty,
      v_new_stock,
      p_prescription_id,
      format('Dispensed %s × %s by %s', v_qty, v_name, COALESCE(p_dispensed_by, 'Pharmacy Desk'))
    );
  END LOOP;

  SELECT
    COALESCE(BOOL_AND(COALESCE(qty_dispensed, 0) >= GREATEST(qty_required, 1)), FALSE),
    COALESCE(BOOL_OR(COALESCE(qty_dispensed, 0) > 0), FALSE)
  INTO v_all_filled, v_any_filled
  FROM public.hospital_prescription_items
  WHERE prescription_id = p_prescription_id;

  v_status := CASE
    WHEN v_all_filled THEN 'dispensed'
    WHEN v_any_filled THEN 'partially_dispensed'
    ELSE 'new'
  END;

  UPDATE public.hospital_prescriptions
  SET
    status = v_status,
    dispensed_at = CASE WHEN v_status = 'dispensed' THEN NOW() ELSE dispensed_at END,
    updated_at = NOW()
  WHERE id = p_prescription_id;

  INSERT INTO public.hospital_clinical_records (
    hospital_id, uhid, patient_name, activity_type, activity, doctor_name, status, details
  ) VALUES (
    p_hospital_id,
    v_uhid,
    COALESCE(v_patient_name, 'Patient'),
    'dispense',
    format('Pharmacy fulfilled prescription for %s', COALESCE(v_patient_name, 'patient')),
    COALESCE(p_dispensed_by, 'Pharmacy Desk'),
    v_status,
    jsonb_build_object('prescription_id', p_prescription_id, 'status', v_status)
  );

  RETURN jsonb_build_object('ok', TRUE, 'status', v_status);
END;
$$;

ALTER TABLE public.hospital_medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_clinical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_inventory_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_hospital_medicines" ON public.hospital_medicines;
CREATE POLICY "allow_all_hospital_medicines" ON public.hospital_medicines
  FOR ALL TO public, anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_hospital_prescriptions" ON public.hospital_prescriptions;
CREATE POLICY "allow_all_hospital_prescriptions" ON public.hospital_prescriptions
  FOR ALL TO public, anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_hospital_prescription_items" ON public.hospital_prescription_items;
CREATE POLICY "allow_all_hospital_prescription_items" ON public.hospital_prescription_items
  FOR ALL TO public, anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_hospital_clinical_records" ON public.hospital_clinical_records;
CREATE POLICY "allow_all_hospital_clinical_records" ON public.hospital_clinical_records
  FOR ALL TO public, anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_hospital_inventory_tx" ON public.hospital_inventory_transactions;
CREATE POLICY "allow_all_hospital_inventory_tx" ON public.hospital_inventory_transactions
  FOR ALL TO public, anon, authenticated, service_role USING (true) WITH CHECK (true);

GRANT ALL ON public.hospital_medicines TO anon, authenticated, service_role;
GRANT ALL ON public.hospital_prescriptions TO anon, authenticated, service_role;
GRANT ALL ON public.hospital_prescription_items TO anon, authenticated, service_role;
GRANT ALL ON public.hospital_clinical_records TO anon, authenticated, service_role;
GRANT ALL ON public.hospital_inventory_transactions TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dispense_prescription_atomic(UUID, TEXT, JSONB, TEXT) TO anon, authenticated, service_role;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'hospital_medicines'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hospital_medicines;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'hospital_prescriptions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hospital_prescriptions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'hospital_clinical_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hospital_clinical_records;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'hospital_inventory_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hospital_inventory_transactions;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
