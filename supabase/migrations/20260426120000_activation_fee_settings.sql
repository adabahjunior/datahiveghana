-- Migrate agent_activation_fee to structured format {enabled, amount}
-- and add subagent_activation_fee with the same structure.

UPDATE public.app_settings
  SET value = '{"enabled": true, "amount": 80}'::jsonb
  WHERE key = 'agent_activation_fee';

INSERT INTO public.app_settings (key, value)
  VALUES ('subagent_activation_fee', '{"enabled": true, "amount": 30}'::jsonb)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
