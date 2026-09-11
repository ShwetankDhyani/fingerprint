-- One login per email. Auth already enforces unique emails on auth.users;
-- keep profiles.email unique so client/staff identity cannot fork.
create unique index if not exists profiles_email_unique
  on public.profiles (lower(email));
