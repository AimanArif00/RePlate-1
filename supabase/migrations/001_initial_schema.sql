-- 001_initial_schema.sql
-- RePlate Campus PostgreSQL Schema for Supabase

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Campuses
CREATE TABLE IF NOT EXISTS public.campuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_name VARCHAR(150) NOT NULL UNIQUE,
  location TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  student_id VARCHAR(50),
  phone_number VARCHAR(20) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'vendor', 'admin')),
  campus_id UUID REFERENCES public.campuses(id) ON DELETE SET NULL,
  account_status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (account_status IN ('pending', 'active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Vendors
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  campus_id UUID REFERENCES public.campuses(id) ON DELETE SET NULL,
  business_name VARCHAR(150) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL,
  contact_phone VARCHAR(20) NOT NULL,
  approval_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Food Categories
CREATE TABLE IF NOT EXISTS public.food_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Food Listings
CREATE TABLE IF NOT EXISTS public.food_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.food_categories(id) ON DELETE RESTRICT,
  food_name VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT NOT NULL,
  original_price NUMERIC(10, 2) NOT NULL CHECK (original_price > 0),
  discounted_price NUMERIC(10, 2) NOT NULL CHECK (discounted_price >= 0),
  quantity_available INTEGER NOT NULL CHECK (quantity_available >= 0),
  pickup_start_at TIMESTAMPTZ NOT NULL,
  pickup_end_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'sold_out', 'expired', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_discounted_lower_than_original CHECK (discounted_price < original_price),
  CONSTRAINT chk_pickup_window_valid CHECK (pickup_end_at > pickup_start_at)
);

-- 6. Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) NOT NULL UNIQUE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
  total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
  order_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (
    order_status IN ('pending', 'confirmed', 'ready_for_pickup', 'picked_up', 'cancelled', 'expired')
  ),
  payment_method VARCHAR(30) NOT NULL DEFAULT 'pay_at_pickup' CHECK (payment_method IN ('pay_at_pickup')),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  pickup_code_hash TEXT NOT NULL,
  pickup_deadline TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Order Items
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  food_listing_id UUID NOT NULL REFERENCES public.food_listings(id) ON DELETE RESTRICT,
  food_name_snapshot VARCHAR(150) NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Pickup Verifications
CREATE TABLE IF NOT EXISTS public.pickup_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  verified_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  verification_method VARCHAR(20) NOT NULL CHECK (verification_method IN ('code', 'qr')),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. System Settings (configurable waste estimate parameters)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  estimated_kg_per_meal NUMERIC(6, 3) NOT NULL DEFAULT 0.450 CHECK (estimated_kg_per_meal > 0),
  estimated_co2_per_kg NUMERIC(6, 3) NOT NULL DEFAULT 2.500 CHECK (estimated_co2_per_kg > 0),
  platform_contact_email VARCHAR(255) NOT NULL DEFAULT 'support@replatecampus.edu.my',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_campus ON public.profiles(campus_id);
CREATE INDEX IF NOT EXISTS idx_vendors_approval ON public.vendors(approval_status);
CREATE INDEX IF NOT EXISTS idx_listings_vendor ON public.food_listings(vendor_id);
CREATE INDEX IF NOT EXISTS idx_listings_category ON public.food_listings(category_id);
CREATE INDEX IF NOT EXISTS idx_listings_status_end ON public.food_listings(status, pickup_end_at);
CREATE INDEX IF NOT EXISTS idx_orders_student ON public.orders(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_vendor ON public.orders(vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_vendor ON public.reviews(vendor_id);
