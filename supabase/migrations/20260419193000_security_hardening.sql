ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ban_reason TEXT;

CREATE OR REPLACE FUNCTION public.is_suspicious_email(_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  email_lower TEXT := lower(trim(coalesce(_email, '')));
  local_part TEXT;
  domain_part TEXT;
BEGIN
  IF email_lower = '' OR position('@' in email_lower) = 0 THEN
    RETURN true;
  END IF;

  local_part := split_part(email_lower, '@', 1);
  domain_part := split_part(email_lower, '@', 2);

  IF local_part = '' OR domain_part = '' THEN
    RETURN true;
  END IF;

  IF domain_part IN (
    'mailinator.com',
    'tempmail.com',
    '10minutemail.com',
    'guerrillamail.com',
    'yopmail.com',
    'sharklasers.com',
    'trashmail.com',
    'maildrop.cc',
    'dispostable.com',
    'fakeinbox.com'
  ) THEN
    RETURN true;
  END IF;

  IF domain_part = 'example.com' OR domain_part LIKE '%.example' THEN
    RETURN true;
  END IF;

  IF local_part LIKE '%test%' OR local_part LIKE '%fake%' OR local_part LIKE '%temp%' OR local_part LIKE '%spam%' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_suspicious_email(NEW.email) THEN
    RAISE EXCEPTION 'Suspicious email is not allowed';
  END IF;

  INSERT INTO public.profiles (user_id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
