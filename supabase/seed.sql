-- seed.sql
-- Development demonstration seed data for RePlate Campus
-- NOTE: Demo authentication users should be created via Supabase Auth Dashboard
-- or a local development script using SUPABASE_SERVICE_ROLE_KEY.

INSERT INTO public.campuses (id, campus_name, location) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Main Campus (Universiti Putra Green)', 'Serdang, Selangor'),
  ('11111111-1111-1111-1111-111111111102', 'Engineering & Tech Annex', 'Block E, Innovation Precinct')
ON CONFLICT (campus_name) DO NOTHING;

INSERT INTO public.food_categories (id, category_name, description, is_active) VALUES
  ('22222222-2222-2222-2222-222222222201', 'Rice and Noodles', 'Warm rice bowls, nasi lemak, fried rice, and noodle dishes.', TRUE),
  ('22222222-2222-2222-2222-222222222202', 'Fast Food', 'Grilled chicken chops, burgers, wraps, and hot plates.', TRUE),
  ('22222222-2222-2222-2222-222222222203', 'Snacks', 'Curry puffs, savoury bites, and tea-time snacks.', TRUE),
  ('22222222-2222-2222-2222-222222222204', 'Bakery', 'Fresh sandwiches, croissants, and baked buns.', TRUE),
  ('22222222-2222-2222-2222-222222222205', 'Beverages', 'Crafted teas, coffee, and chilled campus drinks.', TRUE),
  ('22222222-2222-2222-2222-222222222206', 'Desserts', 'Kueh platters, cakes, and sweet treats.', TRUE),
  ('22222222-2222-2222-2222-222222222207', 'Other', 'Daily chef surprise boxes and mixed platters.', TRUE)
ON CONFLICT (category_name) DO NOTHING;

INSERT INTO public.system_settings (id, estimated_kg_per_meal, estimated_co2_per_kg, platform_contact_email)
VALUES (1, 0.450, 2.500, 'support@replatecampus.edu.my')
ON CONFLICT (id) DO NOTHING;
