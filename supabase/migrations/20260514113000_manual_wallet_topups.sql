CREATE OR REPLACE FUNCTION public.generate_manual_topup_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  candidate TEXT;
  attempts INTEGER := 0;
BEGIN
  LOOP
    attempts := attempts + 1;
    candidate := lpad((1000 + floor(random() * 9000))::int::text, 4, '0');

    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE manual_topup_code = candidate
    ) THEN
      RETURN candidate;
    END IF;

    IF attempts >= 100 THEN
      RAISE EXCEPTION 'Unable to generate a unique manual top-up code';
    END IF;
  END LOOP;
END;
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS manual_topup_code TEXT;

ALTER TABLE public.profiles
  ALTER COLUMN manual_topup_code SET DEFAULT public.generate_manual_topup_code();

UPDATE public.profiles
SET manual_topup_code = public.generate_manual_topup_code()
WHERE manual_topup_code IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN manual_topup_code SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_manual_topup_code_format_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_manual_topup_code_format_check
      CHECK (manual_topup_code ~ '^[0-9]{4}$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_manual_topup_code_key
  ON public.profiles (manual_topup_code);
