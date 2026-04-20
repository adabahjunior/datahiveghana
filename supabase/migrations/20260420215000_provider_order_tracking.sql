ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS provider_reference TEXT,
  ADD COLUMN IF NOT EXISTS provider_order_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_status TEXT,
  ADD COLUMN IF NOT EXISTS provider_response JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_provider_reference_unique
  ON public.orders(provider_reference)
  WHERE provider_reference IS NOT NULL;
