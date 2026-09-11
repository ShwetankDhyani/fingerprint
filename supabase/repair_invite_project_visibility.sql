-- Repair: link client profiles to orgs that hold their invites / billing email.
-- Safe to re-run. App also syncs on each client login via syncClientMemberships.

insert into public.organization_members (
  organization_id,
  user_id,
  member_role,
  can_comment,
  can_approve,
  can_pay
)
select distinct
  i.organization_id,
  p.id,
  case when i.role = 'CLIENT_VIEWER' then 'viewer' else 'owner' end,
  true,
  i.role is distinct from 'CLIENT_VIEWER',
  i.role is distinct from 'CLIENT_VIEWER'
from public.profiles p
join public.invites i
  on lower(i.email) = lower(p.email)
where i.organization_id is not null
  and p.role in ('CLIENT', 'CLIENT_VIEWER')
on conflict (organization_id, user_id) do update
set
  can_comment = excluded.can_comment,
  can_approve = excluded.can_approve,
  can_pay = excluded.can_pay;

insert into public.organization_members (
  organization_id,
  user_id,
  member_role,
  can_comment,
  can_approve,
  can_pay
)
select distinct
  o.id,
  p.id,
  'owner',
  true,
  true,
  true
from public.profiles p
join public.organizations o
  on lower(o.billing_email) = lower(p.email)
where p.role in ('CLIENT', 'CLIENT_VIEWER')
on conflict (organization_id, user_id) do update
set
  can_comment = excluded.can_comment,
  can_approve = excluded.can_approve,
  can_pay = excluded.can_pay;

-- Clear plaintext invite tokens after acceptance.
update public.invites
set token_plain = null
where accepted_at is not null
  and token_plain is not null;

-- Scrub profiles where full_name looks like a password autofilled into the name field.
update public.profiles
set full_name = split_part(email, '@', 1)
where role in ('CLIENT', 'CLIENT_VIEWER')
  and full_name is not null
  and full_name !~ '[[:space:]]'
  and full_name ~ '[0-9]'
  and full_name ~ '[^A-Za-z0-9]'
  and char_length(full_name) >= 8;
