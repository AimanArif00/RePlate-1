-- 002_functions_triggers.sql
-- Automatic timestamps, role protection, atomic order placement, and pickup verification

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_vendors_updated_at ON public.vendors;
CREATE TRIGGER trg_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_listings_updated_at ON public.food_listings;
CREATE TRIGGER trg_listings_updated_at
  BEFORE UPDATE ON public.food_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Prevent non-admin users from escalating their role or modifying account_status
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Unauthorized: role cannot be modified by user';
    END IF;
    IF NEW.account_status IS DISTINCT FROM OLD.account_status THEN
      RAISE EXCEPTION 'Unauthorized: account_status cannot be modified by user';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_role_guard ON public.profiles;
CREATE TRIGGER trg_profiles_role_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_escalation();

-- Sync new auth.users signups into profiles (admin is never allowed on public signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requested_role TEXT;
  v_safe_role TEXT;
  v_status TEXT;
BEGIN
  v_requested_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  IF v_requested_role = 'vendor' THEN
    v_safe_role := 'vendor';
    v_status := 'pending';
  ELSE
    v_safe_role := 'student';
    v_status := 'active';
  END IF;

  INSERT INTO public.profiles (
    id, full_name, email, student_id, phone_number, role, campus_id, account_status
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'student_id', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
    v_safe_role,
    NULLIF(NEW.raw_user_meta_data->>'campus_id', '')::UUID,
    v_status
  );

  IF v_safe_role = 'vendor' THEN
    INSERT INTO public.vendors (
      owner_id, campus_id, business_name, description, location, contact_phone, approval_status
    ) VALUES (
      NEW.id,
      NULLIF(NEW.raw_user_meta_data->>'campus_id', '')::UUID,
      COALESCE(NEW.raw_user_meta_data->>'business_name', 'Campus Vendor'),
      COALESCE(NEW.raw_user_meta_data->>'description', ''),
      COALESCE(NEW.raw_user_meta_data->>'location', 'Main Campus Cafeteria'),
      COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Atomic order creation with row-level stock locking (prevents overselling)
CREATE OR REPLACE FUNCTION public.create_replate_order(
  p_vendor_id UUID,
  p_items JSONB
)
RETURNS TABLE (
  order_id UUID,
  order_number VARCHAR,
  pickup_code TEXT,
  total_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID := auth.uid();
  v_student_role TEXT;
  v_student_status TEXT;
  v_item JSONB;
  v_listing public.food_listings%ROWTYPE;
  v_qty INTEGER;
  v_subtotal NUMERIC(10, 2) := 0;
  v_earliest_deadline TIMESTAMPTZ := NULL;
  v_order_id UUID := gen_random_uuid();
  v_order_num VARCHAR(50);
  v_plain_code TEXT;
  v_code_hash TEXT;
BEGIN
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT role, account_status INTO v_student_role, v_student_status
  FROM public.profiles WHERE id = v_student_id;

  IF v_student_role <> 'student' OR v_student_status <> 'active' THEN
    RAISE EXCEPTION 'Active student account required to place orders';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart cannot be empty';
  END IF;

  -- First pass: lock rows and calculate subtotal
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::INTEGER;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid item quantity';
    END IF;

    SELECT * INTO v_listing
    FROM public.food_listings
    WHERE id = (v_item->>'food_listing_id')::UUID
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Food listing not found';
    END IF;

    IF v_listing.vendor_id <> p_vendor_id THEN
      RAISE EXCEPTION 'All items in one order must belong to the same vendor';
    END IF;

    IF v_listing.status <> 'published' OR v_listing.pickup_end_at <= NOW() THEN
      RAISE EXCEPTION 'Listing "%" is no longer available for pickup', v_listing.food_name;
    END IF;

    IF v_listing.quantity_available < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for "%": only % remaining', v_listing.food_name, v_listing.quantity_available;
    END IF;

    v_subtotal := v_subtotal + (v_listing.discounted_price * v_qty);
    IF v_earliest_deadline IS NULL OR v_listing.pickup_end_at < v_earliest_deadline THEN
      v_earliest_deadline := v_listing.pickup_end_at;
    END IF;
  END LOOP;

  v_order_num := 'RP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 6));
  v_plain_code := UPPER(SUBSTRING(ENCODE(gen_random_bytes(4), 'hex'), 1, 6));
  v_code_hash := ENCODE(DIGEST(v_plain_code, 'sha256'), 'hex');

  INSERT INTO public.orders (
    id, order_number, student_id, vendor_id, subtotal, total_amount,
    order_status, payment_method, payment_status, pickup_code_hash, pickup_deadline
  ) VALUES (
    v_order_id, v_order_num, v_student_id, p_vendor_id, v_subtotal, v_subtotal,
    'pending', 'pay_at_pickup', 'pending', v_code_hash, v_earliest_deadline
  );

  -- Second pass: insert items and deduct stock atomically
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::INTEGER;
    SELECT * INTO v_listing FROM public.food_listings WHERE id = (v_item->>'food_listing_id')::UUID;

    INSERT INTO public.order_items (
      order_id, food_listing_id, food_name_snapshot, unit_price, quantity, subtotal
    ) VALUES (
      v_order_id, v_listing.id, v_listing.food_name, v_listing.discounted_price, v_qty, v_listing.discounted_price * v_qty
    );

    UPDATE public.food_listings
    SET
      quantity_available = quantity_available - v_qty,
      status = CASE WHEN quantity_available - v_qty = 0 THEN 'sold_out' ELSE status END
    WHERE id = v_listing.id;
  END LOOP;

  RETURN QUERY SELECT v_order_id, v_order_num, v_plain_code, v_subtotal;
END;
$$;

-- Atomic pickup verification (prevents duplicate collection & cross-vendor access)
CREATE OR REPLACE FUNCTION public.verify_pickup_code(
  p_order_number VARCHAR,
  p_pickup_code TEXT,
  p_method VARCHAR DEFAULT 'code'
)
RETURNS TABLE (
  verified_order_id UUID,
  order_number VARCHAR,
  total_amount NUMERIC,
  verified_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id UUID := auth.uid();
  v_vendor_id UUID;
  v_order public.orders%ROWTYPE;
  v_hash TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id INTO v_vendor_id
  FROM public.vendors
  WHERE owner_id = v_staff_id AND approval_status = 'approved';

  IF v_vendor_id IS NULL THEN
    RAISE EXCEPTION 'Approved vendor account required';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE orders.order_number = p_order_number
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.vendor_id <> v_vendor_id THEN
    RAISE EXCEPTION 'Unauthorized: this order belongs to a different vendor';
  END IF;

  IF v_order.order_status = 'picked_up' THEN
    RAISE EXCEPTION 'Duplicate collection blocked: this order has already been picked up';
  END IF;

  IF v_order.order_status IN ('cancelled', 'expired') THEN
    RAISE EXCEPTION 'Order cannot be collected because its status is %', v_order.order_status;
  END IF;

  v_hash := ENCODE(DIGEST(UPPER(TRIM(p_pickup_code)), 'sha256'), 'hex');
  IF v_hash <> v_order.pickup_code_hash THEN
    RAISE EXCEPTION 'Invalid pickup verification code';
  END IF;

  UPDATE public.orders
  SET order_status = 'picked_up', payment_status = 'paid'
  WHERE id = v_order.id;

  INSERT INTO public.pickup_verifications (order_id, verified_by, verification_method, verified_at)
  VALUES (v_order.id, v_staff_id, p_method, v_now);

  RETURN QUERY SELECT v_order.id, v_order.order_number, v_order.total_amount, v_now;
END;
$$;
