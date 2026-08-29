-- Patient App → Doctor Dashboard Realtime Sync
-- Run in Supabase SQL Editor. Safe to re-run.

-- ─── 1. Ensure patient_appointments table (Patient App primary write target) ─
CREATE TABLE IF NOT EXISTS public.patient_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID,
  patient_name TEXT,
  doctor_name TEXT,
  department TEXT,
  hospital_name TEXT DEFAULT 'Regal Hospital',
  appointment_date DATE,
  slot_time TEXT,
  appointment_time TEXT,
  fee TEXT,
  consultation_fee NUMERIC,
  reason TEXT,
  reason_for_visit TEXT,
  chief_complaint TEXT,
  token_number INT,
  queue_status TEXT DEFAULT 'SCHEDULED',
  status TEXT DEFAULT 'SCHEDULED',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.patient_appointments
  ADD COLUMN IF NOT EXISTS patient_id UUID,
  ADD COLUMN IF NOT EXISTS patient_name TEXT,
  ADD COLUMN IF NOT EXISTS doctor_name TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS hospital_name TEXT DEFAULT 'Regal Hospital',
  ADD COLUMN IF NOT EXISTS appointment_date DATE,
  ADD COLUMN IF NOT EXISTS slot_time TEXT,
  ADD COLUMN IF NOT EXISTS appointment_time TEXT,
  ADD COLUMN IF NOT EXISTS fee TEXT,
  ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS reason_for_visit TEXT,
  ADD COLUMN IF NOT EXISTS chief_complaint TEXT,
  ADD COLUMN IF NOT EXISTS token_number INT,
  ADD COLUMN IF NOT EXISTS queue_status TEXT DEFAULT 'SCHEDULED',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'SCHEDULED',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_patient_appointments_doctor
  ON public.patient_appointments (doctor_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_appointments_token
  ON public.patient_appointments (token_number ASC);

CREATE INDEX IF NOT EXISTS idx_patient_appointments_queue
  ON public.patient_appointments (queue_status, created_at DESC);

-- ─── 2. Broadcast full row payloads to Realtime subscribers ─────────────────
ALTER TABLE public.patient_appointments REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'patient_appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_appointments;
  END IF;
END $$;

-- ─── 3. Mirror for appointments ledger (dual-table doctor queue ingestion) ─
ALTER TABLE public.appointments REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  END IF;
END $$;

-- ─── 4. Row Level Security — allow Patient + Doctor portals to read/write ─
ALTER TABLE public.patient_appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_patient_appointments_access" ON public.patient_appointments;
CREATE POLICY "open_patient_appointments_access" ON public.patient_appointments
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
