-- Lynx Web Solutions — Portal upgrade (additive, idempotent)
-- Run after schema.sql and portal_schema.sql.
-- Adds: shareable tokens, contact phones, support tickets, email delivery log,
-- automatic project snapshots, and trigram indexes for fast admin search.

create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- Quotes: keep the plaintext share token so staff can re-copy the link later
-- ---------------------------------------------------------------------------
alter table public.quotes
  add column if not exists share_token text,
  add column if not exists paid_advance_minor integer not null default 0,
  add column if not exists sent_at timestamptz,
  add column if not exists last_emailed_at timestamptz;

-- ---------------------------------------------------------------------------
-- Contact details used for search / Cashfree customer payloads
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists phone text,
  add column if not exists primary_contact_name text;

alter table public.profiles
  add column if not exists phone text;

alter table public.quotes
  add column if not exists recipient_phone text;

alter table public.invoices
  add column if not exists share_token text;

-- ---------------------------------------------------------------------------
-- Invites: let staff re-copy / re-send an invite without minting a new row
-- ---------------------------------------------------------------------------
alter table public.invites
  add column if not exists token_plain text,
  add column if not exists last_sent_at timestamptz,
  add column if not exists send_error text,
  add column if not exists phone text;

-- ---------------------------------------------------------------------------
-- Payments: tie a Cashfree transaction back to the quote it settles
-- ---------------------------------------------------------------------------
alter table public.transactions
  add column if not exists quote_id uuid references public.quotes (id) on delete set null;

create index if not exists transactions_quote_idx
  on public.transactions (quote_id);

-- ---------------------------------------------------------------------------
-- Support tickets ride on threads (kind = 'support')
-- ---------------------------------------------------------------------------
alter table public.threads
  add column if not exists ticket_number text,
  add column if not exists priority text not null default 'normal',
  add column if not exists category text not null default 'general',
  add column if not exists created_by uuid references public.profiles (id) on delete set null,
  add column if not exists assigned_to uuid references public.profiles (id) on delete set null,
  add column if not exists last_reply_at timestamptz,
  add column if not exists closed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'threads_priority_check'
  ) then
    alter table public.threads
      add constraint threads_priority_check
      check (priority in ('low', 'normal', 'high', 'urgent'));
  end if;
end $$;

create unique index if not exists threads_ticket_number_key
  on public.threads (ticket_number)
  where ticket_number is not null;

create index if not exists threads_status_idx on public.threads (status);
create index if not exists threads_kind_idx on public.threads (kind);

-- ---------------------------------------------------------------------------
-- Email delivery log — every outbound mail is recorded, sent or not
-- ---------------------------------------------------------------------------
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  template text not null,
  to_email text not null,
  subject text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'skipped')),
  provider text not null default 'resend',
  provider_message_id text,
  error text,
  organization_id uuid references public.organizations (id) on delete set null,
  entity_type text,
  entity_id uuid,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists email_log_created_idx on public.email_log (created_at desc);
create index if not exists email_log_status_idx on public.email_log (status);
create index if not exists email_log_to_idx on public.email_log (to_email);

alter table public.email_log enable row level security;

-- ---------------------------------------------------------------------------
-- Snapshots: mark machine-generated progress digests
-- ---------------------------------------------------------------------------
alter table public.snapshots
  add column if not exists auto_generated boolean not null default false,
  add column if not exists period_start timestamptz,
  add column if not exists period_end timestamptz;

create index if not exists snapshots_project_idx
  on public.snapshots (project_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Search indexes — admin filtering by name, email, phone, number
-- ---------------------------------------------------------------------------
create index if not exists organizations_name_trgm
  on public.organizations using gin (name gin_trgm_ops);
create index if not exists organizations_email_trgm
  on public.organizations using gin (coalesce(billing_email, '') gin_trgm_ops);
create index if not exists organizations_phone_trgm
  on public.organizations using gin (coalesce(phone, '') gin_trgm_ops);

create index if not exists profiles_name_trgm
  on public.profiles using gin (full_name gin_trgm_ops);
create index if not exists profiles_email_trgm2
  on public.profiles using gin (email gin_trgm_ops);

create index if not exists quotes_number_trgm
  on public.quotes using gin (quote_number gin_trgm_ops);
create index if not exists quotes_title_trgm
  on public.quotes using gin (title gin_trgm_ops);
create index if not exists quotes_recipient_trgm
  on public.quotes using gin (coalesce(recipient_email, '') gin_trgm_ops);

create index if not exists invoices_number_trgm
  on public.invoices using gin (invoice_number gin_trgm_ops);

create index if not exists projects_name_trgm
  on public.projects using gin (name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Backfill: give existing quotes a share token so old links keep working
-- ---------------------------------------------------------------------------
update public.quotes
set share_token = encode(gen_random_bytes(24), 'base64')
where share_token is null;

update public.quotes
set share_token = replace(replace(replace(share_token, '+', '-'), '/', '_'), '=', '')
where share_token like '%+%' or share_token like '%/%' or share_token like '%=%';

update public.quotes
set share_token_hash = encode(digest(share_token, 'sha256'), 'hex')
where share_token is not null;

-- ---------------------------------------------------------------------------
-- Backfill: pending invites predating token_plain get a fresh, copyable token
-- so staff can share the link without waiting on email. Any link already sent
-- for these invites is replaced.
-- ---------------------------------------------------------------------------
update public.invites
set token_plain = replace(
      replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'),
      '=', ''
    )
where accepted_at is null and token_plain is null;

update public.invites
set token_hash = encode(digest(token_plain, 'sha256'), 'hex')
where accepted_at is null and token_plain is not null and token_hash is distinct from
      encode(digest(token_plain, 'sha256'), 'hex');


-- Access control (Super Admin, dormant logins, WhatsApp log)
-- Super Admin, dormant accounts, WhatsApp delivery log
-- Applied to production 2026-09-05. Safe to re-run.

DO $$ BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS dormant_at timestamptz,
  ADD COLUMN IF NOT EXISTS dormant_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dormant_reason text;

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_account_status_check
    CHECK (account_status IN ('active', 'dormant'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS profiles_account_status_idx ON public.profiles (account_status);

CREATE TABLE IF NOT EXISTS public.whatsapp_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  to_phone text NOT NULL,
  template text NOT NULL,
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  provider text NOT NULL DEFAULT 'meta',
  provider_message_id text,
  error text,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  entity_type text,
  entity_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS whatsapp_log_created_idx ON public.whatsapp_log (created_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_log_status_idx ON public.whatsapp_log (status);

ALTER TABLE public.whatsapp_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_log_staff_select ON public.whatsapp_log;
CREATE POLICY whatsapp_log_staff_select ON public.whatsapp_log
  FOR SELECT USING (public.is_staff());

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce(
    (
      SELECT role IN ('SUPER_ADMIN', 'ADMIN', 'STAFF')
      FROM public.profiles
      WHERE id = auth.uid()
    ),
    false
  );
$function$;
