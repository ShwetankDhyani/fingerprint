-- WhatsApp event toggles (Admin → Settings)
-- Safe to re-run.

create table if not exists public.portal_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.portal_settings enable row level security;

drop policy if exists portal_settings_staff_select on public.portal_settings;
create policy portal_settings_staff_select on public.portal_settings
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('SUPER_ADMIN', 'ADMIN', 'STAFF')
        and coalesce(p.account_status, 'active') <> 'dormant'
    )
  );

-- Writes go through the service-role server client only.
