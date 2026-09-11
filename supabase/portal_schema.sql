-- Lynx Web Solutions — Portal schema (additive)
-- Run after schema.sql in the Supabase SQL editor.
-- Extends leads/transactions with auth-aware org, project, quote, and invoice tables.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Roles & profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create type public.user_role as enum (
  'SUPER_ADMIN',
  'ADMIN',
  'STAFF',
  'CLIENT',
  'CLIENT_VIEWER'
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text not null,
  full_name text not null default '',
  role public.user_role not null default 'CLIENT',
  totp_secret text,
  totp_enabled boolean not null default false,
  avatar_url text,
  last_login_at timestamptz,
  account_status text not null default 'active'
    check (account_status in ('active', 'dormant')),
  dormant_at timestamptz,
  dormant_by uuid references public.profiles (id) on delete set null,
  dormant_reason text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_email_idx on public.profiles (email);

-- ---------------------------------------------------------------------------
-- Organizations (client companies)
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  slug text not null unique,
  website text,
  gstin text,
  billing_email text,
  health_score text not null default 'green'
    check (health_score in ('green', 'amber', 'red')),
  tags text[] not null default '{}',
  notes_internal text not null default '',
  lead_id uuid references public.leads (id) on delete set null,
  meta jsonb not null default '{}'::jsonb
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  member_role text not null default 'owner'
    check (member_role in ('owner', 'contact', 'viewer')),
  can_comment boolean not null default true,
  can_approve boolean not null default false,
  can_pay boolean not null default false,
  unique (organization_id, user_id)
);

create index if not exists org_members_user_idx on public.organization_members (user_id);
create index if not exists org_members_org_idx on public.organization_members (organization_id);

-- ---------------------------------------------------------------------------
-- Invites
-- ---------------------------------------------------------------------------
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  email text not null,
  full_name text not null default '',
  role public.user_role not null default 'CLIENT',
  organization_id uuid references public.organizations (id) on delete cascade,
  token_hash text not null unique,
  invited_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists invites_email_idx on public.invites (email);

-- ---------------------------------------------------------------------------
-- Projects & milestones
-- ---------------------------------------------------------------------------
create type public.project_status as enum (
  'intake',
  'active',
  'review',
  'launched',
  'maintenance',
  'paused',
  'archived'
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  code text not null unique,
  status public.project_status not null default 'intake',
  summary text not null default '',
  kickoff_at date,
  target_launch_at date,
  launched_at date,
  public_status_enabled boolean not null default false,
  public_status_token text unique,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists projects_org_idx on public.projects (organization_id);
create index if not exists projects_status_idx on public.projects (status);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  description text not null default '',
  due_at date,
  completed_at timestamptz,
  sort_order integer not null default 0,
  client_visible boolean not null default true,
  status text not null default 'upcoming'
    check (status in ('upcoming', 'in_progress', 'review', 'done', 'blocked')),
  payment_amount_minor integer,
  payment_currency text default 'INR',
  checklist jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists milestones_project_idx on public.milestones (project_id);

-- ---------------------------------------------------------------------------
-- Activity log (immutable audit / CRM timeline)
-- ---------------------------------------------------------------------------
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references public.profiles (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  summary text not null,
  before_state jsonb,
  after_state jsonb,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists activity_org_idx on public.activity_log (organization_id, created_at desc);
create index if not exists activity_project_idx on public.activity_log (project_id, created_at desc);
create index if not exists activity_created_idx on public.activity_log (created_at desc);

-- ---------------------------------------------------------------------------
-- Quotes
-- ---------------------------------------------------------------------------
create type public.quote_status as enum (
  'draft',
  'sent',
  'opened',
  'accepted',
  'declined',
  'expired',
  'converted'
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references public.organizations (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  quote_number text not null unique,
  title text not null,
  status public.quote_status not null default 'draft',
  currency text not null default 'INR',
  subtotal_minor integer not null default 0,
  tax_minor integer not null default 0,
  discount_minor integer not null default 0,
  total_minor integer not null default 0,
  advance_minor integer not null default 0,
  valid_until timestamptz,
  share_token_hash text unique,
  share_expires_at timestamptz,
  recipient_email text,
  recipient_name text,
  terms text not null default '',
  notes text not null default '',
  version integer not null default 1,
  parent_quote_id uuid references public.quotes (id) on delete set null,
  accepted_at timestamptz,
  accepted_signature text,
  accepted_ip text,
  opened_at timestamptz,
  open_count integer not null default 0,
  meta jsonb not null default '{}'::jsonb
);

create table if not exists public.quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  sort_order integer not null default 0,
  label text not null,
  description text not null default '',
  quantity numeric(12, 2) not null default 1,
  unit_amount_minor integer not null default 0,
  amount_minor integer not null default 0
);

create table if not exists public.quote_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  event_type text not null,
  summary text not null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists quotes_status_idx on public.quotes (status);
create index if not exists quotes_org_idx on public.quotes (organization_id);

-- ---------------------------------------------------------------------------
-- Invoices (extends existing Cashfree transactions)
-- ---------------------------------------------------------------------------
create type public.invoice_status as enum (
  'draft',
  'sent',
  'partial',
  'paid',
  'overdue',
  'void',
  'refunded'
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  quote_id uuid references public.quotes (id) on delete set null,
  milestone_id uuid references public.milestones (id) on delete set null,
  invoice_number text not null unique,
  status public.invoice_status not null default 'draft',
  currency text not null default 'INR',
  subtotal_minor integer not null default 0,
  tax_minor integer not null default 0,
  total_minor integer not null default 0,
  amount_paid_minor integer not null default 0,
  due_at date,
  issued_at date,
  paid_at timestamptz,
  notes text not null default '',
  meta jsonb not null default '{}'::jsonb
);

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  sort_order integer not null default 0,
  label text not null,
  description text not null default '',
  quantity numeric(12, 2) not null default 1,
  unit_amount_minor integer not null default 0,
  amount_minor integer not null default 0
);

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  transaction_id uuid references public.transactions (id) on delete set null,
  amount_minor integer not null check (amount_minor > 0),
  currency text not null default 'INR',
  method text not null default 'cashfree'
    check (method in ('cashfree', 'bank_transfer', 'other')),
  proof_url text,
  recorded_by uuid references public.profiles (id) on delete set null,
  note text not null default '',
  meta jsonb not null default '{}'::jsonb
);

alter table public.transactions
  add column if not exists invoice_id uuid references public.invoices (id) on delete set null;

alter table public.transactions
  add column if not exists organization_id uuid references public.organizations (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Communication
-- ---------------------------------------------------------------------------
create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  subject text not null,
  kind text not null default 'project'
    check (kind in ('project', 'general', 'support', 'internal')),
  status text not null default 'open'
    check (status in ('open', 'pending', 'resolved', 'closed')),
  meta jsonb not null default '{}'::jsonb
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  internal_only boolean not null default false,
  attachments jsonb not null default '[]'::jsonb,
  read_by uuid[] not null default '{}',
  meta jsonb not null default '{}'::jsonb
);

create index if not exists messages_thread_idx on public.messages (thread_id, created_at);

-- ---------------------------------------------------------------------------
-- Snapshots (live development previews)
-- ---------------------------------------------------------------------------
create table if not exists public.snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id uuid not null references public.projects (id) on delete cascade,
  milestone_id uuid references public.milestones (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  title text not null,
  changelog text not null default '',
  staging_url text,
  media jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'approved', 'changes_requested')),
  published_at timestamptz,
  meta jsonb not null default '{}'::jsonb
);

create table if not exists public.snapshot_remarks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  snapshot_id uuid not null references public.snapshots (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  parent_id uuid references public.snapshot_remarks (id) on delete cascade,
  body text not null,
  pin_x numeric(6, 4),
  pin_y numeric(6, 4),
  resolved boolean not null default false,
  meta jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  href text,
  read_at timestamptz,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'organizations', 'projects', 'milestones',
    'quotes', 'invoices', 'threads'
  ]
  loop
    execute format(
      'drop trigger if exists %I_set_updated_at on public.%I;
       create trigger %I_set_updated_at
         before update on public.%I
         for each row execute function public.set_updated_at();',
      t, t, t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS: deny-by-default; service role bypasses. Authenticated policies below.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.invites enable row level security;
alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.activity_log enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_line_items enable row level security;
alter table public.quote_events enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.threads enable row level security;
alter table public.messages enable row level security;
alter table public.snapshots enable row level security;
alter table public.snapshot_remarks enable row level security;
alter table public.notifications enable row level security;

-- Helper: current user's role
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select role in ('SUPER_ADMIN', 'ADMIN', 'STAFF')
      from public.profiles
      where id = auth.uid()
    ),
    false
  );
$$;

create or replace function public.member_of_org(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id and user_id = auth.uid()
  ) or public.is_staff();
$$;

-- Profiles: users read/update self; staff read all
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select using (id = auth.uid() or public.is_staff());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid() or public.is_staff());

-- Organizations
drop policy if exists orgs_select_member on public.organizations;
create policy orgs_select_member on public.organizations
  for select using (public.member_of_org(id));

drop policy if exists orgs_write_staff on public.organizations;
create policy orgs_write_staff on public.organizations
  for all using (public.is_staff());

-- Members
drop policy if exists org_members_select on public.organization_members;
create policy org_members_select on public.organization_members
  for select using (public.member_of_org(organization_id));

drop policy if exists org_members_write_staff on public.organization_members;
create policy org_members_write_staff on public.organization_members
  for all using (public.is_staff());

-- Projects / milestones
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select using (public.member_of_org(organization_id));

drop policy if exists projects_write_staff on public.projects;
create policy projects_write_staff on public.projects
  for all using (public.is_staff());

drop policy if exists milestones_select on public.milestones;
create policy milestones_select on public.milestones
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and public.member_of_org(p.organization_id)
    )
  );

drop policy if exists milestones_write_staff on public.milestones;
create policy milestones_write_staff on public.milestones
  for all using (public.is_staff());

-- Activity: members read own org; staff write
drop policy if exists activity_select on public.activity_log;
create policy activity_select on public.activity_log
  for select using (
    public.is_staff()
    or (organization_id is not null and public.member_of_org(organization_id))
  );

drop policy if exists activity_insert_staff on public.activity_log;
create policy activity_insert_staff on public.activity_log
  for insert with check (public.is_staff() or actor_id = auth.uid());

-- Quotes / invoices
drop policy if exists quotes_select on public.quotes;
create policy quotes_select on public.quotes
  for select using (
    public.is_staff()
    or (organization_id is not null and public.member_of_org(organization_id))
  );

drop policy if exists quotes_write_staff on public.quotes;
create policy quotes_write_staff on public.quotes
  for all using (public.is_staff());

drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices
  for select using (public.member_of_org(organization_id));

drop policy if exists invoices_write_staff on public.invoices;
create policy invoices_write_staff on public.invoices
  for all using (public.is_staff());

-- Threads / messages: hide internal_only from clients
drop policy if exists threads_select on public.threads;
create policy threads_select on public.threads
  for select using (public.member_of_org(organization_id));

drop policy if exists threads_write on public.threads;
create policy threads_write on public.threads
  for all using (public.member_of_org(organization_id));

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select using (
    exists (
      select 1 from public.threads t
      where t.id = thread_id and public.member_of_org(t.organization_id)
    )
    and (internal_only = false or public.is_staff())
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert with check (
    exists (
      select 1 from public.threads t
      where t.id = thread_id and public.member_of_org(t.organization_id)
    )
    and (internal_only = false or public.is_staff())
  );

-- Snapshots
drop policy if exists snapshots_select on public.snapshots;
create policy snapshots_select on public.snapshots
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and public.member_of_org(p.organization_id)
    )
    and (status <> 'draft' or public.is_staff())
  );

drop policy if exists snapshots_write_staff on public.snapshots;
create policy snapshots_write_staff on public.snapshots
  for all using (public.is_staff());

drop policy if exists remarks_select on public.snapshot_remarks;
create policy remarks_select on public.snapshot_remarks
  for select using (
    exists (
      select 1 from public.snapshots s
      join public.projects p on p.id = s.project_id
      where s.id = snapshot_id and public.member_of_org(p.organization_id)
    )
  );

drop policy if exists remarks_insert on public.snapshot_remarks;
create policy remarks_insert on public.snapshot_remarks
  for insert with check (
    exists (
      select 1 from public.snapshots s
      join public.projects p on p.id = s.project_id
      where s.id = snapshot_id and public.member_of_org(p.organization_id)
    )
  );

-- Notifications
drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications
  for all using (user_id = auth.uid());

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_app_meta_data->>'role')::public.user_role, 'CLIENT')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
