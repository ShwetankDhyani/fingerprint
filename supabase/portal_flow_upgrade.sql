-- Lynx Web Solutions — Unified customer flow (additive, idempotent)
-- Run after schema.sql, portal_schema.sql and portal_upgrade.sql.
--
-- What this adds:
--   1. Timeline lookups by entity (lead/org/quote/invoice/project/ticket)
--   2. Internal admin notifications (bell) with dedupe keys
--   3. Follow-up / reminder stamps so lifecycle mail never double-sends
--   4. A real "completed" project state with a completion timestamp

-- ---------------------------------------------------------------------------
-- 1. Timeline: activity_log is read per entity, not just per org/project
-- ---------------------------------------------------------------------------
create index if not exists activity_entity_idx
  on public.activity_log (entity_type, entity_id, created_at desc);

create index if not exists activity_actor_idx
  on public.activity_log (actor_id, created_at desc);

-- Outbound mail and WhatsApp render inline in the timeline.
create index if not exists email_log_entity_idx
  on public.email_log (entity_type, entity_id, created_at desc);

create index if not exists email_log_org_idx
  on public.email_log (organization_id, created_at desc);

create index if not exists whatsapp_log_entity_idx
  on public.whatsapp_log (entity_type, entity_id, created_at desc);

create index if not exists whatsapp_log_org_idx
  on public.whatsapp_log (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Internal notifications: who needs to look at what, right now
-- ---------------------------------------------------------------------------
alter table public.notifications
  add column if not exists kind text not null default 'system',
  add column if not exists organization_id uuid references public.organizations (id) on delete cascade,
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  -- One row per (user, event). Re-running a cron must not re-notify.
  add column if not exists dedupe_key text;

create unique index if not exists notifications_user_dedupe_key
  on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists notifications_unread_idx
  on public.notifications (user_id, read_at, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Lifecycle communication stamps
-- ---------------------------------------------------------------------------
alter table public.leads
  add column if not exists last_contacted_at timestamptz,
  add column if not exists nudged_at timestamptz;

alter table public.quotes
  add column if not exists followup_sent_at timestamptz;

alter table public.invoices
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists overdue_notice_at timestamptz;

alter table public.milestones
  add column if not exists client_notified_at timestamptz;

-- ---------------------------------------------------------------------------
-- 4. Project completion — an explicit "done" state, not an implied one
-- ---------------------------------------------------------------------------
-- Standalone, not wrapped in a DO block: ALTER TYPE ... ADD VALUE is already
-- idempotent here, and Postgres will not let a new enum value be used inside
-- the transaction that created it.
alter type public.project_status add value if not exists 'completed';

alter table public.projects
  add column if not exists completed_at timestamptz,
  add column if not exists handover_note text not null default '',
  add column if not exists handover_sent_at timestamptz;
