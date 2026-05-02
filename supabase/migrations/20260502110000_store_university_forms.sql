-- Agent store university form pricing and order capture

CREATE TABLE IF NOT EXISTS public.store_university_form_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.agent_stores(id) ON DELETE CASCADE,
  form_type_id UUID NOT NULL REFERENCES public.university_form_types(id) ON DELETE CASCADE,
  selling_price NUMERIC(10,2) NOT NULL CHECK (selling_price >= 0),
  is_listed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, form_type_id)
);

CREATE TABLE IF NOT EXISTS public.store_university_form_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.agent_stores(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.university_schools(id) ON DELETE RESTRICT,
  form_type_id UUID NOT NULL REFERENCES public.university_form_types(id) ON DELETE RESTRICT,
  school_name TEXT NOT NULL,
  form_type_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  amount_paid NUMERIC(10,2) NOT NULL,
  cost_price NUMERIC(10,2) NOT NULL,
  seller_profit NUMERIC(10,2) NOT NULL DEFAULT 0,
  status public.order_status NOT NULL DEFAULT 'processing',
  paid_via TEXT NOT NULL DEFAULT 'paystack',
  paystack_reference TEXT UNIQUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_store_university_form_prices_updated ON public.store_university_form_prices;
CREATE TRIGGER trg_store_university_form_prices_updated
  BEFORE UPDATE ON public.store_university_form_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_store_university_form_orders_updated ON public.store_university_form_orders;
CREATE TRIGGER trg_store_university_form_orders_updated
  BEFORE UPDATE ON public.store_university_form_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.store_university_form_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_university_form_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads store university form prices" ON public.store_university_form_prices;
CREATE POLICY "Anyone reads store university form prices"
  ON public.store_university_form_prices FOR SELECT USING (true);

DROP POLICY IF EXISTS "Agents manage own store university form prices" ON public.store_university_form_prices;
CREATE POLICY "Agents manage own store university form prices"
  ON public.store_university_form_prices FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.agent_stores s
      WHERE s.id = store_id
        AND s.agent_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins manage all store university form prices" ON public.store_university_form_prices;
CREATE POLICY "Admins manage all store university form prices"
  ON public.store_university_form_prices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Agents view own store university form orders" ON public.store_university_form_orders;
CREATE POLICY "Agents view own store university form orders"
  ON public.store_university_form_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.agent_stores s
      WHERE s.id = store_id
        AND s.agent_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins view all store university form orders" ON public.store_university_form_orders;
CREATE POLICY "Admins view all store university form orders"
  ON public.store_university_form_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins manage all store university form orders" ON public.store_university_form_orders;
CREATE POLICY "Admins manage all store university form orders"
  ON public.store_university_form_orders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );
