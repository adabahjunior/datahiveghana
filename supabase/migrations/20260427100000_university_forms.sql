-- University schools
CREATE TABLE IF NOT EXISTS public.university_schools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_published BOOLEAN DEFAULT false NOT NULL,
  display_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- University form types (per school)
CREATE TABLE IF NOT EXISTS public.university_form_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.university_schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- University form orders
CREATE TABLE IF NOT EXISTS public.university_form_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  school_id UUID NOT NULL REFERENCES public.university_schools(id),
  form_type_id UUID NOT NULL REFERENCES public.university_form_types(id),
  school_name TEXT NOT NULL,
  form_type_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  amount_paid NUMERIC(10,2) NOT NULL,
  reference TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.university_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_form_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_form_orders ENABLE ROW LEVEL SECURITY;

-- Schools RLS: authenticated users can read published schools
CREATE POLICY "published_schools_readable" ON public.university_schools
  FOR SELECT USING (is_published = true AND auth.role() = 'authenticated');

-- Schools RLS: admin can do anything (bypassed by service role in edge functions)
CREATE POLICY "admin_manage_schools" ON public.university_schools
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Form types RLS: authenticated users can read active types of published schools
CREATE POLICY "active_form_types_readable" ON public.university_form_types
  FOR SELECT USING (
    is_active = true
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.university_schools s
      WHERE s.id = school_id AND s.is_published = true
    )
  );

-- Form types RLS: admin can do anything
CREATE POLICY "admin_manage_form_types" ON public.university_form_types
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Orders RLS: users see their own orders
CREATE POLICY "user_own_form_orders" ON public.university_form_orders
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_insert_form_orders" ON public.university_form_orders
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Orders RLS: admin sees all
CREATE POLICY "admin_all_form_orders" ON public.university_form_orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Insert default WhatsApp setting for university forms
INSERT INTO public.app_settings (key, value)
VALUES ('university_forms_whatsapp', '"233000000000"')
ON CONFLICT (key) DO NOTHING;
