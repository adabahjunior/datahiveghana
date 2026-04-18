-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('user', 'agent', 'admin');
CREATE TYPE public.network_type AS ENUM ('mtn', 'telecel', 'airteltigo_ishare', 'airteltigo_bigtime');
CREATE TYPE public.transaction_type AS ENUM ('wallet_topup', 'data_purchase', 'agent_activation', 'withdrawal', 'store_sale');
CREATE TYPE public.transaction_status AS ENUM ('pending', 'success', 'failed');
CREATE TYPE public.order_status AS ENUM ('pending', 'processing', 'delivered', 'failed');
CREATE TYPE public.withdrawal_status AS ENUM ('pending', 'approved', 'paid', 'rejected');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  wallet_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  profit_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_agent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ USER ROLES (separate table, never on profiles) ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- ============ DATA PACKAGES (admin-managed base catalog) ============
CREATE TABLE public.data_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network network_type NOT NULL,
  name TEXT NOT NULL,
  volume_mb INTEGER NOT NULL,
  validity_days INTEGER,
  guest_price NUMERIC(10,2) NOT NULL,
  agent_price NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ AGENT STORES ============
CREATE TABLE public.agent_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  store_name TEXT NOT NULL,
  support_phone TEXT NOT NULL,
  whatsapp_link TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ STORE PACKAGE PRICES (agent custom pricing) ============
CREATE TABLE public.store_package_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.agent_stores(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.data_packages(id) ON DELETE CASCADE,
  selling_price NUMERIC(10,2) NOT NULL,
  is_listed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, package_id)
);

-- ============ ORDERS (data purchases) ============
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.agent_stores(id) ON DELETE SET NULL,
  package_id UUID NOT NULL REFERENCES public.data_packages(id),
  recipient_phone TEXT NOT NULL,
  network network_type NOT NULL,
  volume_mb INTEGER NOT NULL,
  amount_paid NUMERIC(10,2) NOT NULL,
  cost_price NUMERIC(10,2) NOT NULL,
  agent_profit NUMERIC(10,2) NOT NULL DEFAULT 0,
  status order_status NOT NULL DEFAULT 'pending',
  paid_via TEXT NOT NULL DEFAULT 'wallet',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ TRANSACTIONS (wallet ledger) ============
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  status transaction_status NOT NULL DEFAULT 'success',
  amount NUMERIC(12,2) NOT NULL,
  paystack_charge NUMERIC(10,2) NOT NULL DEFAULT 0,
  reference TEXT,
  description TEXT,
  related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ WITHDRAWALS ============
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 50),
  momo_number TEXT NOT NULL,
  momo_name TEXT NOT NULL,
  network network_type NOT NULL,
  status withdrawal_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- ============ ISSUE REPORTS ============
CREATE TABLE public.issue_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ APP SETTINGS (admin-tunable) ============
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (key, value) VALUES
  ('agent_activation_fee', '80'::jsonb),
  ('min_withdrawal', '50'::jsonb),
  ('paystack_percent', '1.95'::jsonb),
  ('paystack_flat', '0'::jsonb),
  ('paystack_cap', '100'::jsonb);

-- ============ SECURITY DEFINER: has_role ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============ TIMESTAMP TRIGGER ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_data_packages_updated BEFORE UPDATE ON public.data_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_agent_stores_updated BEFORE UPDATE ON public.agent_stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_store_prices_updated BEFORE UPDATE ON public.store_package_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AUTO-CREATE PROFILE + ROLE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ ENABLE RLS ============
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_package_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins update profiles" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- data_packages: public read, admin write
CREATE POLICY "Anyone reads active packages" ON public.data_packages FOR SELECT USING (true);
CREATE POLICY "Admins manage packages" ON public.data_packages FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- agent_stores: public read, agent owns own
CREATE POLICY "Anyone reads active stores" ON public.agent_stores FOR SELECT USING (true);
CREATE POLICY "Agents create own store" ON public.agent_stores FOR INSERT WITH CHECK (auth.uid() = agent_id);
CREATE POLICY "Agents update own store" ON public.agent_stores FOR UPDATE USING (auth.uid() = agent_id);
CREATE POLICY "Admins manage stores" ON public.agent_stores FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- store_package_prices: public read, agent owns
CREATE POLICY "Anyone reads store prices" ON public.store_package_prices FOR SELECT USING (true);
CREATE POLICY "Agents manage own store prices" ON public.store_package_prices FOR ALL
  USING (EXISTS (SELECT 1 FROM public.agent_stores s WHERE s.id = store_id AND s.agent_id = auth.uid()));
CREATE POLICY "Admins manage all store prices" ON public.store_package_prices FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- orders: buyer + store owner + admin
CREATE POLICY "Buyers view own orders" ON public.orders FOR SELECT USING (auth.uid() = buyer_user_id);
CREATE POLICY "Agents view own store orders" ON public.orders FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.agent_stores s WHERE s.id = store_id AND s.agent_id = auth.uid()));
CREATE POLICY "Admins view all orders" ON public.orders FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage orders" ON public.orders FOR ALL USING (public.has_role(auth.uid(), 'admin'));
-- INSERTs come exclusively from edge functions using service role.

-- transactions: user reads own, admin reads all
CREATE POLICY "Users view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all transactions" ON public.transactions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage transactions" ON public.transactions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- withdrawals
CREATE POLICY "Agents view own withdrawals" ON public.withdrawals FOR SELECT USING (auth.uid() = agent_id);
CREATE POLICY "Agents request withdrawal" ON public.withdrawals FOR INSERT WITH CHECK (auth.uid() = agent_id);
CREATE POLICY "Admins view all withdrawals" ON public.withdrawals FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage withdrawals" ON public.withdrawals FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- issue_reports
CREATE POLICY "Users view own reports" ON public.issue_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create reports" ON public.issue_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage reports" ON public.issue_reports FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- app_settings: public read of non-sensitive, admin write
CREATE POLICY "Anyone reads settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage settings" ON public.app_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ============ SEED PACKAGES ============
INSERT INTO public.data_packages (network, name, volume_mb, validity_days, guest_price, agent_price, display_order) VALUES
  ('mtn', '1GB', 1024, 7, 6.00, 5.20, 1),
  ('mtn', '2GB', 2048, 14, 11.00, 9.80, 2),
  ('mtn', '3GB', 3072, 30, 16.00, 14.50, 3),
  ('mtn', '5GB', 5120, 30, 26.00, 23.50, 4),
  ('mtn', '10GB', 10240, 60, 49.00, 44.00, 5),
  ('telecel', '1GB', 1024, 7, 5.50, 4.80, 1),
  ('telecel', '2GB', 2048, 14, 10.50, 9.20, 2),
  ('telecel', '5GB', 5120, 30, 25.00, 22.50, 3),
  ('telecel', '10GB', 10240, 60, 47.00, 42.00, 4),
  ('airteltigo_ishare', '1GB', 1024, 7, 5.80, 5.00, 1),
  ('airteltigo_ishare', '2GB', 2048, 14, 10.80, 9.50, 2),
  ('airteltigo_ishare', '5GB', 5120, 30, 25.50, 23.00, 3),
  ('airteltigo_bigtime', '5GB', 5120, 30, 24.00, 21.50, 1),
  ('airteltigo_bigtime', '10GB', 10240, 60, 45.00, 40.50, 2),
  ('airteltigo_bigtime', '20GB', 20480, 90, 85.00, 76.00, 3);