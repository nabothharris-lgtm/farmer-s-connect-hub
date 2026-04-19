-- 1. Add subscription + specialty fields to profiles
DO $$ BEGIN
  CREATE TYPE public.subscription_tier AS ENUM ('free', 'pro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.farmer_specialty AS ENUM ('poultry', 'crops', 'dairy', 'fish', 'mixed', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_tier public.subscription_tier NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS pro_since timestamptz,
  ADD COLUMN IF NOT EXISTS farmer_specialty public.farmer_specialty;

-- 2. Farmer products / marketplace
CREATE TABLE IF NOT EXISTS public.farmer_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  category public.farmer_specialty NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'kg',
  quantity_available numeric NOT NULL DEFAULT 0,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.farmer_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active products viewable by authenticated"
  ON public.farmer_products FOR SELECT TO authenticated
  USING (is_active = true OR farmer_id = auth.uid());

CREATE POLICY "Farmers insert own products"
  ON public.farmer_products FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = farmer_id AND public.has_role(auth.uid(), 'farmer'::app_role));

CREATE POLICY "Farmers update own products"
  ON public.farmer_products FOR UPDATE TO authenticated
  USING (auth.uid() = farmer_id);

CREATE POLICY "Farmers delete own products"
  ON public.farmer_products FOR DELETE TO authenticated
  USING (auth.uid() = farmer_id);

CREATE TRIGGER set_farmer_products_updated_at
  BEFORE UPDATE ON public.farmer_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_farmer_products_farmer ON public.farmer_products(farmer_id);
CREATE INDEX IF NOT EXISTS idx_farmer_products_category ON public.farmer_products(category);
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON public.profiles(subscription_tier);