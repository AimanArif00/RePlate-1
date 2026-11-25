# RePlate Campus — System Documentation

## 1. System Architecture

RePlate Campus follows a clean three-tier web architecture:

1. **Presentation Layer (React 19 + TypeScript + Tailwind CSS):**
   - Modular views under `src/pages/` (`PublicPages`, `AuthPages`, `StudentPages`, `VendorPages`, `AdminPages`) and reusable components under `src/components/`.
   - Pure, unit-tested domain calculations and validation rules in `src/lib/replateRules.ts`.
2. **Application & API Layer (Express Server + Vercel Hosting):**
   - Hosts API endpoints (`/api/*`) for authentication, atomic order placement, pickup verification, image uploads, and optional server-side Gemini listing assistance.
   - Integrates directly with Supabase via `@supabase/supabase-js` (`src/lib/supabase/client.ts`) when Supabase environment credentials are configured.
3. **Data & Auth Layer (Supabase PostgreSQL + Auth + Storage):**
   - Relational schema with Row Level Security (RLS), database triggers, and atomic stored procedures (`create_replate_order`, `verify_pickup_code`).

---

## 2. System Modules

1. **Module 1 — Authentication & User Management:** Student and vendor registration, login, password reset, role-based redirects, and profile management. Admin privileges cannot be selected during public signup.
2. **Module 2 — Food Listing Management:** Approved vendors create, edit, deactivate, or delete leftover food items with automatic discount calculation and automatic `sold_out` / `expired` transitions.
3. **Module 3 — Food Browsing:** Search by keyword, filter by category, vendor, price cap, and availability, and sort by lowest price or highest discount.
4. **Module 4 — Shopping Cart & Ordering:** Stock-checked cart, Pay-at-Pickup checkout summary, atomic stock deduction, unique order number, and pickup code generation.
5. **Module 5 — Order Management:** Six order statuses (`pending`, `confirmed`, `ready_for_pickup`, `picked_up`, `cancelled`, `expired`), student cancellation with stock restoration, and vendor status progression.
6. **Module 6 — Pickup Verification:** One-time 6-character code & QR code verification locked to the owning vendor and blocking duplicate pickups.
7. **Module 7 — Dashboards & Analytics:** Separate student, vendor, and administrator consoles displaying live database counts and configurable environmental waste-reduction estimates (counted strictly from `picked_up` orders).

---

## 3. Core Workflows

### Order Processing Flow
`Student Browse` -> `Add to Cart (stock check)` -> `Checkout (Pay at Pickup)` -> `Atomic Stock Deduction & Order Insert` -> `Pickup Code + QR Issued` -> `Vendor Confirms & Marks Ready` -> `Counter Pickup Verification` -> `Order Picked Up & Impact Updated`

### Security Implementation
- Passwords hashed server-side using `scrypt` with per-user salts (or managed by Supabase Auth).
- Signed HMAC-SHA256 Bearer tokens verified server-side on every protected endpoint.
- Pickup codes hashed with SHA-256 (`pickup_code_hash`) and invalidated immediately upon collection.
- Role-based access control enforced on both API routes and PostgreSQL RLS policies (`prevent_role_self_escalation()` trigger + `is_admin()` checks).
- Service role keys (`SUPABASE_SERVICE_ROLE_KEY`) and `GEMINI_API_KEY` remain strictly server-side.
