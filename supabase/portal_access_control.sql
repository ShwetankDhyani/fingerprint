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
