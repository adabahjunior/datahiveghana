-- Add account revocation support and seed admin-controlled site settings.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_revoked BOOLEAN NOT NULL DEFAULT false;

INSERT INTO public.app_settings (key, value)
VALUES
  ('maintenance_mode', '{"enabled": false, "message": "BenzosData Ghana is under maintenance and will be back shortly."}'::jsonb),
  ('whatsapp_channel_url', '""'::jsonb),
  ('customer_care_contact', '""'::jsonb),
  ('notification_users', '{"enabled": false, "title": "Notice", "message": ""}'::jsonb),
  ('notification_agents', '{"enabled": false, "title": "Agent Notice", "message": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;

