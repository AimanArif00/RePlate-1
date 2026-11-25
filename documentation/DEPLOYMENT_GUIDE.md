# RePlate Campus — Deployment Guide (Supabase + Vercel)

## 1. Supabase Project Setup

1. Create a new project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** in your Supabase dashboard and run these files in exact order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_functions_triggers.sql`
   - `supabase/migrations/003_rls_policies.sql`
   - `supabase/seed.sql`
3. Navigate to **Authentication -> Providers -> Email** and configure email verification / SMTP settings for your university domain if desired.
4. Create an Administrator account in **Authentication -> Users**, then promote that user in SQL Editor:
   ```sql
   UPDATE public.profiles
   SET role = 'admin', account_status = 'active'
   WHERE email = 'admin@youruniversity.edu';
   ```
5. Verify that the `food-images` Storage bucket exists under **Storage** (created automatically by `003_rls_policies.sql`).

---

## 2. Environment Variables

Configure these environment variables in `.env` (for local development) and in **Vercel Project Settings -> Environment Variables** (for production):

| Variable | Visibility | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Client & Server | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Client & Server | Your Supabase public anon key |
| `NEXT_PUBLIC_SUPABASE_URL` | Client & Server | Same Supabase project URL (compatibility) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client & Server | Same Supabase public anon key (compatibility) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-Only** | Privileged server operations (never prefix with `VITE_` or `NEXT_PUBLIC_`) |
| `SESSION_SECRET` | **Server-Only** | Random 32+ byte secret for Express session signing |
| `GEMINI_API_KEY` | **Server-Only** | Optional Gemini API key for vendor listing description assistance |

---

## 3. GitHub & Vercel Deployment

1. Push the repository to GitHub.
2. Import the repository in [vercel.com](https://vercel.com).
3. Build settings:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Add the environment variables listed above in Vercel Project Settings.
5. Deploy to generate your `.vercel.app` domain, and optionally attach a custom university domain under **Project Settings -> Domains**.

---

## 4. Production Deployment Checklist

- [ ] All 3 SQL migrations and `seed.sql` executed cleanly on Supabase.
- [ ] RLS enabled and verified on every application table.
- [ ] At least one Administrator profile promoted securely via SQL.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` set only in server environment variables.
- [ ] SMTP provider configured in Supabase Auth for production password-reset emails.
- [ ] `npm run test`, `npm run lint`, and `npm run build` pass with zero errors.
