# RePlate Campus — Database Documentation (Supabase / PostgreSQL)

## 1. Overview

RePlate Campus uses a normalized PostgreSQL relational database hosted on **Supabase**. All primary keys use `UUID`, timestamps use `TIMESTAMPTZ`, financial amounts use `NUMERIC(10, 2)`, and access control is enforced by **Row Level Security (RLS)** and `SECURITY DEFINER` RPC functions.

---

## 2. Entity Relationship Diagram (ERD)

```text
campuses (1) ────────< (N) profiles (1) ─────── (0..1) vendors
                              │                        │
                              │ (1)                    │ (1)
                              ▼                        ▼
                           orders (N) >─────────────── (1)
                              │                        │
                              │ (1)                    │ (1)
                              ▼                        ▼
                        order_items (N) >────── (1) food_listings (N) >─── (1) food_categories
                              │
                              ├── (0..1) pickup_verifications
                              └── (0..1) reviews
```

---

## 3. Tables & Constraints

| Table | Primary Key | Key Foreign Keys | Critical Constraints |
|---|---|---|---|
| `campuses` | `id (UUID)` | — | `campus_name` UNIQUE NOT NULL |
| `profiles` | `id (UUID)` | `id -> auth.users.id`, `campus_id -> campuses.id` | `role IN ('student','vendor','admin')`, `account_status IN ('pending','active','suspended')` |
| `vendors` | `id (UUID)` | `owner_id -> profiles.id`, `campus_id -> campuses.id` | `owner_id` UNIQUE, `approval_status IN ('pending','approved','rejected')` |
| `food_categories` | `id (UUID)` | — | `category_name` UNIQUE NOT NULL |
| `food_listings` | `id (UUID)` | `vendor_id -> vendors.id`, `category_id -> food_categories.id` | `original_price > 0`, `discounted_price >= 0`, `discounted_price < original_price`, `quantity_available >= 0`, `pickup_end_at > pickup_start_at` |
| `orders` | `id (UUID)` | `student_id -> profiles.id`, `vendor_id -> vendors.id` | `order_number` UNIQUE, valid `order_status` & `payment_status` CHECKs |
| `order_items` | `id (UUID)` | `order_id -> orders.id`, `food_listing_id -> food_listings.id` | `quantity > 0`, `unit_price >= 0` |
| `pickup_verifications` | `id (UUID)` | `order_id -> orders.id`, `verified_by -> profiles.id` | `order_id` UNIQUE (prevents duplicate collection) |
| `reviews` | `id (UUID)` | `student_id -> profiles.id`, `vendor_id -> vendors.id`, `order_id -> orders.id` | `order_id` UNIQUE, `rating BETWEEN 1 AND 5` |
| `system_settings` | `id (INTEGER)` | — | Singleton row (`id = 1`), `estimated_kg_per_meal > 0`, `estimated_co2_per_kg > 0` |

---

## 4. Indexes

- `idx_profiles_role`, `idx_profiles_campus`
- `idx_vendors_approval`
- `idx_listings_vendor`, `idx_listings_category`, `idx_listings_status_end`
- `idx_orders_student`, `idx_orders_vendor`, `idx_orders_status`
- `idx_order_items_order`, `idx_reviews_vendor`

---

## 5. Triggers & Atomic Database Functions

Located in `supabase/migrations/002_functions_triggers.sql`:

1. **`set_updated_at()`**: Automatically updates `updated_at` on `UPDATE` for `profiles`, `vendors`, `food_listings`, and `orders`.
2. **`prevent_role_self_escalation()`**: Blocks non-admin users from altering `profiles.role` or `profiles.account_status`.
3. **`handle_new_user()`**: Automatically creates `profiles` (and `vendors` in `pending` state if vendor signup) upon Supabase Auth signup; rejects public `admin` role assignment.
4. **`create_replate_order(p_vendor_id, p_items)`**: Acquires `FOR UPDATE` row locks on `food_listings`, verifies listing availability & pickup deadline, deducts stock atomically, transitions `sold_out` at `0`, hashes the generated pickup code with SHA-256, and inserts `orders` + `order_items`.
5. **`verify_pickup_code(p_order_number, p_pickup_code, p_method)`**: Acquires `FOR UPDATE` lock on `orders`, confirms vendor ownership, blocks duplicate collection (`picked_up`), verifies SHA-256 pickup code hash, updates order to `picked_up`, and records `pickup_verifications`.

---

## 6. Row Level Security (RLS)

Defined in `supabase/migrations/003_rls_policies.sql`:
- **Students** can read/update only their own permitted profile fields, browse published listings, read only their own orders/order items, and review only their own `picked_up` orders.
- **Vendors** can manage only their own vendor record and listings (when approved), view only orders belonging to their vendor account, and verify pickups only for their own orders.
- **Administrators** (`public.is_admin()`) hold full oversight across approvals, user status, categories, listings, orders, and `system_settings`.

---

## 7. Setup Instructions

Run the files in order inside the **Supabase SQL Editor** or via Supabase CLI (`supabase db push`):
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_functions_triggers.sql`
3. `supabase/migrations/003_rls_policies.sql`
4. `supabase/seed.sql`
