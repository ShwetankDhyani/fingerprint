-- Repair: link client emails to orgs that already hold their quotes/invoices.
-- Prefer application-side ensureEmailMembership for new sends/payments.
-- Safe to re-run.

-- Link setu.d47@gmail.com (and any other recipient) to every org that has
-- their quotes, so org-scoped portal lists also show paid status.
insert into public.organization_members (
  organization_id,
  user_id,
  member_role,
  can_comment,
  can_approve,
  can_pay
)
select distinct
  q.organization_id,
  p.id,
  'owner',
  true,
  true,
  true
from public.profiles p
join public.quotes q
  on lower(q.recipient_email) = lower(p.email)
where q.organization_id is not null
  and p.role = 'CLIENT'
on conflict (organization_id, user_id) do update
set
  can_comment = excluded.can_comment,
  can_approve = excluded.can_approve,
  can_pay = excluded.can_pay;

-- Attach orphan quotes (null organization_id) to the client's earliest membership.
update public.quotes q
set organization_id = m.organization_id
from public.profiles p
join lateral (
  select om.organization_id
  from public.organization_members om
  where om.user_id = p.id
  order by om.created_at asc
  limit 1
) m on true
where lower(q.recipient_email) = lower(p.email)
  and q.organization_id is null;
