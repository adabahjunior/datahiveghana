-- Subagent system
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'sub_agent'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'sub_agent';
  END IF;
END $$;

ALTER TABLE public.agent_stores
  ADD COLUMN IF NOT EXISTS subagent_fee_addon NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.subagent_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subagent_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  source_store_id UUID REFERENCES public.agent_stores(id) ON DELETE SET NULL,
  paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_via TEXT NOT NULL DEFAULT 'paystack',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subagent_package_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.data_packages(id) ON DELETE CASCADE,
  base_price NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_agent_id, package_id)
);

CREATE TRIGGER trg_subagent_assignments_updated
  BEFORE UPDATE ON public.subagent_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_subagent_package_prices_updated
  BEFORE UPDATE ON public.subagent_package_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.subagent_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subagent_package_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parent agents view own subagents"
  ON public.subagent_assignments FOR SELECT
  USING (parent_agent_id = auth.uid());

CREATE POLICY "Subagents view own assignment"
  ON public.subagent_assignments FOR SELECT
  USING (subagent_user_id = auth.uid());

CREATE POLICY "Parent agents manage own subagents"
  ON public.subagent_assignments FOR ALL
  USING (parent_agent_id = auth.uid());

CREATE POLICY "Admins manage all subagent assignments"
  ON public.subagent_assignments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Parent agents manage own subagent prices"
  ON public.subagent_package_prices FOR ALL
  USING (parent_agent_id = auth.uid());

CREATE POLICY "Subagents read assigned base prices"
  ON public.subagent_package_prices FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.subagent_assignments sa
      WHERE sa.subagent_user_id = auth.uid()
        AND sa.parent_agent_id = subagent_package_prices.parent_agent_id
        AND sa.status = 'active'
    )
  );

CREATE POLICY "Admins manage all subagent prices"
  ON public.subagent_package_prices FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
