
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'agent', 'sub_agent');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  parent_agent_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public profiles are viewable" ON public.profiles FOR SELECT USING (true);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Networks table
CREATE TABLE public.networks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.networks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Networks are viewable by everyone" ON public.networks FOR SELECT USING (true);
CREATE POLICY "Admins can manage networks" ON public.networks FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Seed networks
INSERT INTO public.networks (id, name) VALUES
  ('mtn', 'MTN'),
  ('airteltigo', 'AirtelTigo'),
  ('telecel', 'Telecel');

-- Data packages table
CREATE TABLE public.data_packages (
  id TEXT PRIMARY KEY,
  network_id TEXT NOT NULL REFERENCES public.networks(id),
  name TEXT NOT NULL,
  size_mb INTEGER NOT NULL,
  base_price NUMERIC(10,2) NOT NULL,
  agent_price NUMERIC(10,2) NOT NULL,
  sub_agent_price NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.data_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active packages viewable by everyone" ON public.data_packages FOR SELECT USING (true);
CREATE POLICY "Admins can manage packages" ON public.data_packages FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Seed some packages
INSERT INTO public.data_packages (id, network_id, name, size_mb, base_price, agent_price, sub_agent_price) VALUES
  ('mtn_1gb', 'mtn', '1GB', 1024, 5.00, 4.00, 4.50),
  ('mtn_2gb', 'mtn', '2GB', 2048, 10.00, 8.00, 9.00),
  ('mtn_5gb', 'mtn', '5GB', 5120, 20.00, 16.00, 18.00),
  ('mtn_10gb', 'mtn', '10GB', 10240, 35.00, 28.00, 31.00),
  ('airteltigo_1gb', 'airteltigo', '1GB', 1024, 5.00, 4.00, 4.50),
  ('airteltigo_2gb', 'airteltigo', '2GB', 2048, 10.00, 8.00, 9.00),
  ('airteltigo_5gb', 'airteltigo', '5GB', 5120, 20.00, 16.00, 18.00),
  ('telecel_1gb', 'telecel', '1GB', 1024, 4.50, 3.50, 4.00),
  ('telecel_2gb', 'telecel', '2GB', 2048, 9.00, 7.00, 8.00),
  ('telecel_5gb', 'telecel', '5GB', 5120, 18.00, 14.00, 16.00);

-- Agent stores table
CREATE TABLE public.agent_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  store_name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  contact_info TEXT,
  markup_type TEXT NOT NULL DEFAULT 'fixed' CHECK (markup_type IN ('fixed', 'percentage')),
  markup_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stores viewable by everyone" ON public.agent_stores FOR SELECT USING (true);
CREATE POLICY "Agents can manage own store" ON public.agent_stores FOR ALL USING (
  agent_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Admins can manage all stores" ON public.agent_stores FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Wallets table
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage wallets" ON public.wallets FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Wallet transactions
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id),
  amount NUMERIC(10,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.wallet_transactions FOR SELECT USING (
  wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid())
);
CREATE POLICY "Admins can manage transactions" ON public.wallet_transactions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id TEXT NOT NULL REFERENCES public.data_packages(id),
  phone_number TEXT NOT NULL,
  buyer_type TEXT NOT NULL CHECK (buyer_type IN ('guest', 'agent', 'sub_agent', 'store_customer')),
  agent_id UUID REFERENCES public.profiles(id),
  store_id UUID REFERENCES public.agent_stores(id),
  user_id UUID REFERENCES auth.users(id),
  final_price NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Agents can view store orders" ON public.orders FOR SELECT USING (
  agent_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Admins can manage all orders" ON public.orders FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can create guest orders" ON public.orders FOR INSERT WITH CHECK (buyer_type = 'guest');

-- Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  -- Create wallet for new user
  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_data_packages_updated_at BEFORE UPDATE ON public.data_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_agent_stores_updated_at BEFORE UPDATE ON public.agent_stores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
