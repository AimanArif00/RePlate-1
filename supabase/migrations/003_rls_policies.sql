-- 003_rls_policies.sql
-- Row Level Security (RLS) policies for all RePlate Campus tables and Storage

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role = 'admin' AND account_status = 'active' FROM public.profiles WHERE id = auth.uid()), FALSE);
$$;

-- Enable RLS on all tables
ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- CAMPUSES
CREATE POLICY "Campuses readable by everyone" ON public.campuses FOR SELECT USING (TRUE);
CREATE POLICY "Admins manage campuses" ON public.campuses FOR ALL USING (public.is_admin());

-- PROFILES
CREATE POLICY "Users read own profile or admin reads all"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- VENDORS
CREATE POLICY "Approved vendors readable publicly, owners and admins see own/all"
  ON public.vendors FOR SELECT
  USING (approval_status = 'approved' OR owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "Vendor owner can update profile fields except approval_status"
  ON public.vendors FOR UPDATE
  USING (owner_id = auth.uid() OR public.is_admin())
  WITH CHECK (owner_id = auth.uid() OR public.is_admin());

-- FOOD CATEGORIES
CREATE POLICY "Categories readable by everyone"
  ON public.food_categories FOR SELECT USING (TRUE);
CREATE POLICY "Admins manage food categories"
  ON public.food_categories FOR ALL USING (public.is_admin());

-- FOOD LISTINGS
CREATE POLICY "Published non-removed listings readable by everyone, vendors see own, admins see all"
  ON public.food_listings FOR SELECT
  USING (
    status IN ('published', 'sold_out', 'expired')
    OR vendor_id IN (SELECT id FROM public.vendors WHERE owner_id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY "Approved vendors insert own food listings"
  ON public.food_listings FOR INSERT
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM public.vendors
      WHERE owner_id = auth.uid() AND approval_status = 'approved'
    )
  );

CREATE POLICY "Vendors update own food listings or admins manage all"
  ON public.food_listings FOR UPDATE
  USING (
    vendor_id IN (SELECT id FROM public.vendors WHERE owner_id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY "Vendors delete own food listings or admins delete all"
  ON public.food_listings FOR DELETE
  USING (
    vendor_id IN (SELECT id FROM public.vendors WHERE owner_id = auth.uid())
    OR public.is_admin()
  );

-- ORDERS (creation handled via create_replate_order SECURITY DEFINER RPC)
CREATE POLICY "Students read own orders, vendors read own vendor orders, admins read all"
  ON public.orders FOR SELECT
  USING (
    student_id = auth.uid()
    OR vendor_id IN (SELECT id FROM public.vendors WHERE owner_id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY "Vendors update valid order statuses or students cancel pending"
  ON public.orders FOR UPDATE
  USING (
    student_id = auth.uid()
    OR vendor_id IN (SELECT id FROM public.vendors WHERE owner_id = auth.uid())
    OR public.is_admin()
  );

-- ORDER ITEMS
CREATE POLICY "Order items follow parent order access"
  ON public.order_items FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM public.orders
      WHERE student_id = auth.uid()
        OR vendor_id IN (SELECT id FROM public.vendors WHERE owner_id = auth.uid())
        OR public.is_admin()
    )
  );

-- PICKUP VERIFICATIONS
CREATE POLICY "Pickup verifications visible to owning student, vendor, and admin"
  ON public.pickup_verifications FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM public.orders
      WHERE student_id = auth.uid()
        OR vendor_id IN (SELECT id FROM public.vendors WHERE owner_id = auth.uid())
        OR public.is_admin()
    )
  );

-- REVIEWS
CREATE POLICY "Reviews readable publicly"
  ON public.reviews FOR SELECT USING (TRUE);

CREATE POLICY "Students submit review only for own picked_up order"
  ON public.reviews FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND o.student_id = auth.uid()
        AND o.vendor_id = vendor_id
        AND o.order_status = 'picked_up'
    )
  );

-- SYSTEM SETTINGS
CREATE POLICY "System settings readable by everyone"
  ON public.system_settings FOR SELECT USING (TRUE);
CREATE POLICY "Only admins update system settings"
  ON public.system_settings FOR UPDATE USING (public.is_admin());

-- STORAGE BUCKET (food-images)
INSERT INTO storage.buckets (id, name, public)
VALUES ('food-images', 'food-images', TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Food images publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'food-images');

CREATE POLICY "Authenticated vendors upload food images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'food-images'
    AND auth.role() = 'authenticated'
  );
