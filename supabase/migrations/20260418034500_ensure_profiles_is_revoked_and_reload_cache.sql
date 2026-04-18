-- Safety migration: ensure profiles.is_revoked exists and refresh API schema cache.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_revoked BOOLEAN NOT NULL DEFAULT false;

UPDATE public.profiles
SET is_revoked = false
WHERE is_revoked IS NULL;

-- Force PostgREST to pick up schema changes immediately.
SELECT pg_notify('pgrst', 'reload schema');
