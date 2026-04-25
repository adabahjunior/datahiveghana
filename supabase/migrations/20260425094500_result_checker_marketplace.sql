-- Result checker marketplace: admin pricing, agent/subagent base pricing, store listings, and purchases.

CREATE TABLE IF NOT EXISTS public.checker_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_type TEXT NOT NULL CHECK (exam_type IN ('wassce', 'bece')),
  name TEXT NOT NULL,
  user_price NUMERIC(10,2) NOT NULL CHECK (user_price >= 0),
  agent_price NUMERIC(10,2) NOT NULL CHECK (agent_price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_checker_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.agent_stores(id) ON DELETE CASCADE,
  checker_id UUID NOT NULL REFERENCES public.checker_products(id) ON DELETE CASCADE,
  selling_price NUMERIC(10,2) NOT NULL CHECK (selling_price >= 0),
  is_listed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, checker_id)
);

CREATE TABLE IF NOT EXISTS public.subagent_checker_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checker_id UUID NOT NULL REFERENCES public.checker_products(id) ON DELETE CASCADE,
  base_price NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_agent_id, checker_id)
);

CREATE TABLE IF NOT EXISTS public.checker_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.agent_stores(id) ON DELETE SET NULL,
  checker_id UUID NOT NULL REFERENCES public.checker_products(id) ON DELETE RESTRICT,
  recipient_phone TEXT NOT NULL,
  exam_type TEXT NOT NULL CHECK (exam_type IN ('wassce', 'bece')),
  amount_paid NUMERIC(10,2) NOT NULL,
  cost_price NUMERIC(10,2) NOT NULL,
  agent_profit NUMERIC(10,2) NOT NULL DEFAULT 0,
  seller_profit NUMERIC(10,2) NOT NULL DEFAULT 0,
  upstream_agent_profit NUMERIC(10,2) NOT NULL DEFAULT 0,
  status public.order_status NOT NULL DEFAULT 'delivered',
  paid_via TEXT NOT NULL DEFAULT 'wallet',
  paystack_reference TEXT UNIQUE,
  checker_serial TEXT,
  checker_pin TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_checker_products_updated ON public.checker_products;
CREATE TRIGGER trg_checker_products_updated
  BEFORE UPDATE ON public.checker_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_store_checker_prices_updated ON public.store_checker_prices;
CREATE TRIGGER trg_store_checker_prices_updated
  BEFORE UPDATE ON public.store_checker_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_subagent_checker_prices_updated ON public.subagent_checker_prices;
CREATE TRIGGER trg_subagent_checker_prices_updated
  BEFORE UPDATE ON public.subagent_checker_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_checker_orders_updated ON public.checker_orders;
CREATE TRIGGER trg_checker_orders_updated
  BEFORE UPDATE ON public.checker_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.checker_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_checker_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subagent_checker_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checker_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads active checker products" ON public.checker_products;
CREATE POLICY "Anyone reads active checker products"
  ON public.checker_products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage checker products" ON public.checker_products;
CREATE POLICY "Admins manage checker products"
  ON public.checker_products FOR ALL USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone reads store checker prices" ON public.store_checker_prices;
CREATE POLICY "Anyone reads store checker prices"
  ON public.store_checker_prices FOR SELECT USING (true);

DROP POLICY IF EXISTS "Agents manage own store checker prices" ON public.store_checker_prices;
CREATE POLICY "Agents manage own store checker prices"
  ON public.store_checker_prices FOR ALL
  USING (EXISTS (SELECT 1 FROM public.agent_stores s WHERE s.id = store_id AND s.agent_id = auth.uid()));

DROP POLICY IF EXISTS "Admins manage all store checker prices" ON public.store_checker_prices;
CREATE POLICY "Admins manage all store checker prices"
  ON public.store_checker_prices FOR ALL USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Parent agents manage own subagent checker prices" ON public.subagent_checker_prices;
CREATE POLICY "Parent agents manage own subagent checker prices"
  ON public.subagent_checker_prices FOR ALL USING (parent_agent_id = auth.uid());

DROP POLICY IF EXISTS "Subagents read assigned checker base prices" ON public.subagent_checker_prices;
CREATE POLICY "Subagents read assigned checker base prices"
  ON public.subagent_checker_prices FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.subagent_assignments sa
      WHERE sa.subagent_user_id = auth.uid()
        AND sa.parent_agent_id = subagent_checker_prices.parent_agent_id
        AND sa.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins manage all subagent checker prices" ON public.subagent_checker_prices;
CREATE POLICY "Admins manage all subagent checker prices"
  ON public.subagent_checker_prices FOR ALL USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Buyers view own checker orders" ON public.checker_orders;
CREATE POLICY "Buyers view own checker orders"
  ON public.checker_orders FOR SELECT USING (auth.uid() = buyer_user_id);

DROP POLICY IF EXISTS "Agents view own store checker orders" ON public.checker_orders;
CREATE POLICY "Agents view own store checker orders"
  ON public.checker_orders FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.agent_stores s WHERE s.id = store_id AND s.agent_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins view all checker orders" ON public.checker_orders;
CREATE POLICY "Admins view all checker orders"
  ON public.checker_orders FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage checker orders" ON public.checker_orders;
CREATE POLICY "Admins manage checker orders"
  ON public.checker_orders FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.checker_products (exam_type, name, user_price, agent_price, display_order, is_active)
VALUES
  ('wassce', 'WASSCE Checker', 18.00, 14.00, 1, true),
  ('bece', 'BECE Checker', 16.00, 12.00, 2, true)
ON CONFLICT DO NOTHING;
