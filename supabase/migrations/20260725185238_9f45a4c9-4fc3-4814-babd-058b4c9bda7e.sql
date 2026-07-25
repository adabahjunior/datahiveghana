ALTER TABLE public.checker_products ADD COLUMN IF NOT EXISTS byteboss_product_id text;
ALTER TABLE public.checker_orders ADD COLUMN IF NOT EXISTS provider_order_id text;
ALTER TABLE public.checker_orders ADD COLUMN IF NOT EXISTS provider_status text;