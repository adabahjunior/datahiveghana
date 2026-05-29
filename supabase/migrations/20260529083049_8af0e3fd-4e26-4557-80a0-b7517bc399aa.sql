
CREATE TABLE public.data_provider_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  base_url TEXT NOT NULL DEFAULT '',
  api_key TEXT NOT NULL DEFAULT '',
  webhook_url TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_provider_settings TO authenticated;
GRANT ALL ON public.data_provider_settings TO service_role;

ALTER TABLE public.data_provider_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage data providers"
ON public.data_provider_settings FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_data_provider_settings_updated_at
BEFORE UPDATE ON public.data_provider_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure only one provider is active at a time
CREATE OR REPLACE FUNCTION public.enforce_single_active_data_provider()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active THEN
    UPDATE public.data_provider_settings
      SET is_active = false
      WHERE id <> NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_single_active_data_provider_trg
AFTER INSERT OR UPDATE OF is_active ON public.data_provider_settings
FOR EACH ROW WHEN (NEW.is_active = true)
EXECUTE FUNCTION public.enforce_single_active_data_provider();

-- Seed the three providers (active = spendless, since it's the current one)
INSERT INTO public.data_provider_settings (provider_key, display_name, base_url, api_key, webhook_url, is_active, notes)
VALUES
  ('spendless',   'Spendless (current)',     'https://spendless.top/api/purchase', '', '', true,  'Default provider using SPENDLESS_API_KEY env if api_key is empty.'),
  ('superdata',   'SuperData Ghana',         'https://superbdatafy.com/api/v1',    '', '', false, 'Uses Authorization: Bearer <api_key>. POST /buy-data with {bundle_id, phone_number}.'),
  ('diceconsult', 'DiceConsult Multi-Network','https://diceconsultgh.com/api/api_router.php', '', '', false, 'Uses X-API-KEY header. POST with {network, phone, bundle}.')
ON CONFLICT (provider_key) DO NOTHING;
