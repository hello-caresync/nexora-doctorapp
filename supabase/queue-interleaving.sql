-- SmartQ interleaving engine persistence (safe to re-run)

alter table public.appointments add column if not exists check_in_status text;
alter table public.appointments add column if not exists checked_in_at timestamptz;
alter table public.appointments add column if not exists queue_type text;
alter table public.appointments add column if not exists triage_priority integer default 3;
alter table public.appointments add column if not exists estimated_duration_minutes integer default 15;
alter table public.appointments add column if not exists scheduled_time text;

create table if not exists public.queue_interleaving_state (
  id uuid primary key default gen_random_uuid(),
  doctor_id text not null unique,
  hospital_id text,
  last_served_type text,
  last_served_patient_id text,
  updated_at timestamptz not null default now()
);

alter table public.queue_interleaving_state enable row level security;

drop policy if exists "queue_interleaving_state_anon_all" on public.queue_interleaving_state;
create policy "queue_interleaving_state_anon_all"
  on public.queue_interleaving_state
  for all
  using (true)
  with check (true);
