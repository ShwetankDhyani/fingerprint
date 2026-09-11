-- Lynx Web Solutions — Supabase schema
-- Run in the Supabase SQL editor. Enable RLS; service-role bypasses RLS for server writes.

create extension if not exists "pgcrypto";

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  email text not null,
  company text not null,
  project_type text not null,
  budget text not null,
  timeline text not null,
  selected_plan text,
  scope text not null,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'converted', 'archived')),
  source text not null default 'contact_form',
  phone text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_email_idx on public.leads (email);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider text not null check (provider in ('razorpay', 'stripe')),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded')),
  plan_slug text not null,
  plan_name text not null,
  amount_minor integer not null check (amount_minor > 0),
  currency text not null,
  customer_name text,
  customer_email text,
  customer_phone text,
  invoice_number text unique,
  provider_order_id text,
  provider_payment_id text,
  provider_session_id text,
  idempotency_key text unique,
  lead_id uuid references public.leads (id) on delete set null,
  raw jsonb not null default '{}'::jsonb
);

create unique index if not exists transactions_provider_order_uidx
  on public.transactions (provider, provider_order_id)
  where provider_order_id is not null;

create unique index if not exists transactions_provider_payment_uidx
  on public.transactions (provider, provider_payment_id)
  where provider_payment_id is not null;

create unique index if not exists transactions_provider_session_uidx
  on public.transactions (provider, provider_session_id)
  where provider_session_id is not null;

create index if not exists transactions_status_idx on public.transactions (status);

alter table public.leads enable row level security;
alter table public.transactions enable row level security;

-- No public anon policies: writes go through the service-role server client only.
-- Authenticated dashboard access can be added later with explicit policies.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();


-- WhatsApp notification toggles + quotation/invoice documents

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  type text not null check (type in ('quotation', 'invoice')),
  number text not null unique,
  public_token text not null unique,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  company text,
  amount_minor integer not null check (amount_minor > 0),
  currency text not null,
  summary text not null,
  status text not null default 'sent'
    check (status in ('draft', 'sent', 'accepted', 'paid', 'void'))
);

create index if not exists documents_created_at_idx on public.documents (created_at desc);
create index if not exists documents_type_idx on public.documents (type);
create index if not exists documents_customer_phone_idx on public.documents (customer_phone);

alter table public.documents enable row level security;

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- Optional: add phone to existing leads deployments
alter table public.leads add column if not exists phone text;
