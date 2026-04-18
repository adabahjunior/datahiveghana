-- Grant admin access to a specific existing auth user by email.
-- Update the email below to the account that should become admin.
DO $$
DECLARE
  target_email text := 'admin@datahiveghana.com';
  target_user_id uuid;
BEGIN
  SELECT id
  INTO target_user_id
  FROM auth.users
  WHERE lower(email) = lower(target_email)
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Cannot grant admin role: no auth user found for email %', target_email;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END
$$;
