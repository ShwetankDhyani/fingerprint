-- Keep the audit trail when a client is wiped.
-- activity_log used to CASCADE with organizations/projects, which erased the
-- history we need after a client delete. Logs stay; organization_id / project_id
-- are cleared instead.

do $$
declare
  rec record;
begin
  for rec in
    select con.conname, rel.relname as table_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and con.contype = 'f'
      and rel.relname = 'activity_log'
      and pg_get_constraintdef(con.oid) ilike '%organization_id%'
  loop
    execute format('alter table public.activity_log drop constraint %I', rec.conname);
  end loop;

  for rec in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and con.contype = 'f'
      and rel.relname = 'activity_log'
      and pg_get_constraintdef(con.oid) ilike '%project_id%'
  loop
    execute format('alter table public.activity_log drop constraint %I', rec.conname);
  end loop;
end $$;

alter table public.activity_log
  add constraint activity_log_organization_id_fkey
  foreign key (organization_id) references public.organizations (id) on delete set null;

alter table public.activity_log
  add constraint activity_log_project_id_fkey
  foreign key (project_id) references public.projects (id) on delete set null;
