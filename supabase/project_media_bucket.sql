-- Public bucket for project progress screenshots.
-- Safe to re-run. The app also creates this bucket on first upload if missing.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-media',
  'project-media',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "project_media_public_read" on storage.objects;
create policy "project_media_public_read"
  on storage.objects for select
  using (bucket_id = 'project-media');

drop policy if exists "project_media_staff_write" on storage.objects;
create policy "project_media_staff_write"
  on storage.objects for insert
  with check (bucket_id = 'project-media');
