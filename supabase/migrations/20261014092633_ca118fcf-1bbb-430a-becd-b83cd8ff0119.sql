CREATE OR REPLACE FUNCTION public.generate_manual_topup_code()
 RETURNS text LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE candidate TEXT; attempts INTEGER := 0;
BEGIN
  LOOP
    attempts := attempts + 1;
    candidate := (10000 + floor(random() * 90000))::int::text;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE manual_topup_code = candidate) THEN
      RETURN candidate;
    END IF;
    IF attempts >= 200 THEN RAISE EXCEPTION 'Unable to generate a unique manual top-up code'; END IF;
  END LOOP;
END;
$function$;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_manual_topup_code_format_check;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE manual_topup_code IS NULL OR manual_topup_code !~ '^\d{5}$' LOOP
    UPDATE public.profiles SET manual_topup_code = public.generate_manual_topup_code() WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.profiles ALTER COLUMN manual_topup_code SET DEFAULT public.generate_manual_topup_code();
ALTER TABLE public.profiles ADD CONSTRAINT profiles_manual_topup_code_format_check CHECK (manual_topup_code ~ '^\d{5}$');