CREATE TABLE IF NOT EXISTS public.agent_package_base_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.data_packages(id) ON DELETE CASCADE,
  base_price NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_user_id, package_id)
);

CREATE TRIGGER trg_agent_package_base_prices_updated
  BEFORE UPDATE ON public.agent_package_base_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.agent_package_base_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents read own package base prices"
  ON public.agent_package_base_prices FOR SELECT
  USING (auth.uid() = agent_user_id);

CREATE POLICY "Admins manage agent package base prices"
  ON public.agent_package_base_prices FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
