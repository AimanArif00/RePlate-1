import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  Campus,
  FoodCategory,
  FoodListing,
  Order,
  OrderItem,
  OrderStatus,
  PickupVerification,
  Profile,
  Review,
  SystemSettings,
  UserRole,
  Vendor,
} from '../src/types/replate';

export interface StoredUser extends Profile {
  password_hash: string;
}

export interface StoredOrder extends Order {
  pickup_code_hash: string;
  /** Stored encrypted/masked for active student retrieval in local preview mode; cleared once picked_up/cancelled/expired */
  active_pickup_code_plain?: string;
}

export interface PasswordResetToken {
  email: string;
  token: string;
  expires_at: string;
}

export interface RePlateDatabase {
  campuses: Campus[];
  profiles: StoredUser[];
  vendors: Vendor[];
  food_categories: FoodCategory[];
  food_listings: FoodListing[];
  orders: StoredOrder[];
  order_items: OrderItem[];
  pickup_verifications: PickupVerification[];
  reviews: Review[];
  system_settings: SystemSettings;
  reset_tokens: PasswordResetToken[];
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'replate-db.json');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function hashPickupCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

export function generatePickupCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

function isoHoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}

function createInitialSeedDatabase(): RePlateDatabase {
  const now = new Date().toISOString();
  const demoPassHash = hashPassword('RePlate2026!');

  const campusMainId = '11111111-1111-1111-1111-111111111101';
  const campusEngId = '11111111-1111-1111-1111-111111111102';

  const student1Id = 'aaaa1111-1111-1111-1111-111111111101';
  const student2Id = 'aaaa1111-1111-1111-1111-111111111102';
  const vendorOwner1Id = 'bbbb1111-1111-1111-1111-111111111101';
  const vendorOwner2Id = 'bbbb1111-1111-1111-1111-111111111102';
  const vendorOwner3Id = 'bbbb1111-1111-1111-1111-111111111103';
  const vendorOwnerPendingId = 'bbbb1111-1111-1111-1111-111111111104';
  const adminId = 'cccc1111-1111-1111-1111-111111111101';

  const vendor1Id = 'dddd1111-1111-1111-1111-111111111101';
  const vendor2Id = 'dddd1111-1111-1111-1111-111111111102';
  const vendor3Id = 'dddd1111-1111-1111-1111-111111111103';
  const vendorPendingId = 'dddd1111-1111-1111-1111-111111111104';

  const catRice = '22222222-2222-2222-2222-222222222201';
  const catFast = '22222222-2222-2222-2222-222222222202';
  const catSnacks = '22222222-2222-2222-2222-222222222203';
  const catBakery = '22222222-2222-2222-2222-222222222204';
  const catBeverages = '22222222-2222-2222-2222-222222222205';
  const catDesserts = '22222222-2222-2222-2222-222222222206';
  const catOther = '22222222-2222-2222-2222-222222222207';

  const list1 = 'eeee1111-1111-1111-1111-111111111101';
  const list2 = 'eeee1111-1111-1111-1111-111111111102';
  const list3 = 'eeee1111-1111-1111-1111-111111111103';
  const list4 = 'eeee1111-1111-1111-1111-111111111104';
  const list5 = 'eeee1111-1111-1111-1111-111111111105';
  const list6 = 'eeee1111-1111-1111-1111-111111111106';

  const order1 = 'ffff1111-1111-1111-1111-111111111101';
  const order2 = 'ffff1111-1111-1111-1111-111111111102';
  const order3 = 'ffff1111-1111-1111-1111-111111111103';

  return {
    campuses: [
      {
        id: campusMainId,
        campus_name: 'Main Campus (Serdang)',
        location: 'Student Union & Kolej Kediaman Precinct',
        created_at: now,
      },
      {
        id: campusEngId,
        campus_name: 'Engineering & Innovation Annex',
        location: 'Faculty of Engineering Block E',
        created_at: now,
      },
    ],
    profiles: [
      {
        id: student1Id,
        full_name: 'Aiman Zani (Demo Student)',
        email: 'student@campus.edu.my',
        student_id: 'S214092',
        phone_number: '012-3456789',
        role: 'student',
        campus_id: campusMainId,
        account_status: 'active',
        password_hash: demoPassHash,
        created_at: now,
        updated_at: now,
      },
      {
        id: student2Id,
        full_name: 'Nurul Huda (Demo Student)',
        email: 'nurul.huda@campus.edu.my',
        student_id: 'S218310',
        phone_number: '013-8841209',
        role: 'student',
        campus_id: campusEngId,
        account_status: 'active',
        password_hash: demoPassHash,
        created_at: now,
        updated_at: now,
      },
      {
        id: vendorOwner1Id,
        full_name: 'Chef Harith Iskandar (Demo Vendor)',
        email: 'vendor@campus.edu.my',
        student_id: null,
        phone_number: '019-7723410',
        role: 'vendor',
        campus_id: campusMainId,
        account_status: 'active',
        password_hash: demoPassHash,
        created_at: now,
        updated_at: now,
      },
      {
        id: vendorOwner2Id,
        full_name: 'Mei Ling Tan',
        email: 'westerngrill@campus.edu.my',
        student_id: null,
        phone_number: '016-5520194',
        role: 'vendor',
        campus_id: campusMainId,
        account_status: 'active',
        password_hash: demoPassHash,
        created_at: now,
        updated_at: now,
      },
      {
        id: vendorOwner3Id,
        full_name: 'Faridah Salleh',
        email: 'librarycafe@campus.edu.my',
        student_id: null,
        phone_number: '011-9032841',
        role: 'vendor',
        campus_id: campusEngId,
        account_status: 'active',
        password_hash: demoPassHash,
        created_at: now,
        updated_at: now,
      },
      {
        id: vendorOwnerPendingId,
        full_name: 'Danish Hakim',
        email: 'kopikampus@campus.edu.my',
        student_id: null,
        phone_number: '017-6612049',
        role: 'vendor',
        campus_id: campusEngId,
        account_status: 'pending',
        password_hash: demoPassHash,
        created_at: now,
        updated_at: now,
      },
      {
        id: adminId,
        full_name: 'Dr. Farah Nadia (Demo Admin)',
        email: 'admin@campus.edu.my',
        student_id: null,
        phone_number: '03-89460011',
        role: 'admin',
        campus_id: campusMainId,
        account_status: 'active',
        password_hash: demoPassHash,
        created_at: now,
        updated_at: now,
      },
    ],
    vendors: [
      {
        id: vendor1Id,
        owner_id: vendorOwner1Id,
        campus_id: campusMainId,
        business_name: 'Serambi Nasi & Wok Cafeteria',
        description: 'Daily cooked Malaysian rice bowls, wok fried rice, and traditional sambal dishes at Central Dining Hall.',
        location: 'Central Student Dining Hall, Stall 4',
        contact_phone: '019-7723410',
        approval_status: 'approved',
        created_at: now,
        updated_at: now,
      },
      {
        id: vendor2Id,
        owner_id: vendorOwner2Id,
        campus_id: campusMainId,
        business_name: 'The Courtyard Grill & Bistro',
        description: 'Freshly seared chicken chops, baked pasta, and hot plates near the Faculty of Science courtyard.',
        location: 'Science Courtyard Pavilion, Lot 2',
        contact_phone: '016-5520194',
        approval_status: 'approved',
        created_at: now,
        updated_at: now,
      },
      {
        id: vendor3Id,
        owner_id: vendorOwner3Id,
        campus_id: campusEngId,
        business_name: 'Library Atrium Bakery & Bites',
        description: 'Artisanal club sandwiches, warm curry puffs, and afternoon pastry boxes at Main Library Ground Floor.',
        location: 'Main Library Atrium, Ground Floor',
        contact_phone: '011-9032841',
        approval_status: 'approved',
        created_at: now,
        updated_at: now,
      },
      {
        id: vendorPendingId,
        owner_id: vendorOwnerPendingId,
        campus_id: campusEngId,
        business_name: 'Kopi Kampus Roastery',
        description: 'Specialty coffee, cold brew bottles, and butter croissants outside Engineering Lecture Hall 1.',
        location: 'Engineering Block E Concourse',
        contact_phone: '017-6612049',
        approval_status: 'pending',
        created_at: now,
        updated_at: now,
      },
    ],
    food_categories: [
      { id: catRice, category_name: 'Rice and Noodles', description: 'Warm rice bowls, nasi lemak, fried rice, and noodle dishes.', is_active: true, created_at: now },
      { id: catFast, category_name: 'Fast Food', description: 'Grilled chicken chops, burgers, wraps, and hot plates.', is_active: true, created_at: now },
      { id: catSnacks, category_name: 'Snacks', description: 'Curry puffs, savoury bites, and tea-time snacks.', is_active: true, created_at: now },
      { id: catBakery, category_name: 'Bakery', description: 'Fresh sandwiches, croissants, and baked buns.', is_active: true, created_at: now },
      { id: catBeverages, category_name: 'Beverages', description: 'Crafted teas, coffee, and chilled campus drinks.', is_active: true, created_at: now },
      { id: catDesserts, category_name: 'Desserts', description: 'Kueh platters, cakes, and sweet treats.', is_active: true, created_at: now },
      { id: catOther, category_name: 'Other', description: 'Daily chef surprise boxes and mixed platters.', is_active: true, created_at: now },
    ],
    food_listings: [
      {
        id: list1,
        vendor_id: vendor1Id,
        category_id: catRice,
        food_name: 'Kampung Fried Rice with Egg',
        description: 'Wok-tossed kampung fried rice with crispy anchovies, mixed vegetables, fresh cucumber, and a sunny-side-up egg.',
        image_url: '/src/assets/images/food_fried_rice_1795588200940.jpg',
        original_price: 8.0,
        discounted_price: 4.0,
        quantity_available: 9,
        pickup_start_at: isoHoursFromNow(-0.5),
        pickup_end_at: isoHoursFromNow(4),
        status: 'published',
        created_at: now,
        updated_at: now,
      },
      {
        id: list2,
        vendor_id: vendor2Id,
        category_id: catFast,
        food_name: 'Black Pepper Chicken Chop',
        description: 'Crispy pan-grilled chicken thigh with house black pepper sauce, fresh cabbage slaw, and thick-cut golden fries.',
        image_url: '/src/assets/images/food_chicken_chop_1795588201849.jpg',
        original_price: 15.0,
        discounted_price: 8.0,
        quantity_available: 5,
        pickup_start_at: isoHoursFromNow(-0.25),
        pickup_end_at: isoHoursFromNow(3.5),
        status: 'published',
        created_at: now,
        updated_at: now,
      },
      {
        id: list3,
        vendor_id: vendor1Id,
        category_id: catRice,
        food_name: 'Nasi Lemak Classic Set',
        description: 'Fragrant pandan coconut rice served with slow-simmered sambal, roasted peanuts, crispy anchovies, cucumber, and egg.',
        image_url: '/src/assets/images/food_nasi_lemak_1795588200390.jpg',
        original_price: 6.0,
        discounted_price: 3.0,
        quantity_available: 12,
        pickup_start_at: isoHoursFromNow(-1),
        pickup_end_at: isoHoursFromNow(3),
        status: 'published',
        created_at: now,
        updated_at: now,
      },
      {
        id: list4,
        vendor_id: vendor3Id,
        category_id: catBakery,
        food_name: 'Toasted Chicken & Egg Club Sandwich',
        description: 'Triple-layer toasted artisan bread filled with herb-roasted chicken breast, sliced egg, crisp lettuce, and tomato.',
        image_url: '/src/assets/images/food_club_sandwich_1795588201633.jpg',
        original_price: 7.0,
        discounted_price: 3.5,
        quantity_available: 7,
        pickup_start_at: isoHoursFromNow(0),
        pickup_end_at: isoHoursFromNow(4.5),
        status: 'published',
        created_at: now,
        updated_at: now,
      },
      {
        id: list5,
        vendor_id: vendor3Id,
        category_id: catSnacks,
        food_name: 'Crispy Spiral Curry Puff Set (4 pcs)',
        description: 'Warm flaky spiral pastry pockets stuffed with spiced potato and chicken curry, packed in an eco-paper tray.',
        image_url: '/src/assets/images/food_curry_puff_1795588204455.jpg',
        original_price: 5.0,
        discounted_price: 2.5,
        quantity_available: 10,
        pickup_start_at: isoHoursFromNow(-0.5),
        pickup_end_at: isoHoursFromNow(5),
        status: 'published',
        created_at: now,
        updated_at: now,
      },
      {
        id: list6,
        vendor_id: vendor2Id,
        category_id: catOther,
        food_name: 'Cafeteria Dinner Rescue Box',
        description: 'Chef-curated warm meal box pairing remaining evening mains with steamed rice and seasonal greens.',
        image_url: '/src/assets/images/hero_campus_cafeteria_1795588201868.jpg',
        original_price: 12.0,
        discounted_price: 5.5,
        quantity_available: 4,
        pickup_start_at: isoHoursFromNow(0.5),
        pickup_end_at: isoHoursFromNow(6),
        status: 'published',
        created_at: now,
        updated_at: now,
      },
    ],
    orders: [
      {
        id: order1,
        order_number: 'RP-20261125-DEMO01',
        student_id: student1Id,
        vendor_id: vendor1Id,
        subtotal: 7.0,
        total_amount: 7.0,
        order_status: 'picked_up',
        payment_method: 'pay_at_pickup',
        payment_status: 'paid',
        pickup_code_hash: hashPickupCode('DEMO01'),
        pickup_deadline: isoHoursFromNow(-1),
        created_at: isoHoursFromNow(-3),
        updated_at: isoHoursFromNow(-1.5),
      },
      {
        id: order2,
        order_number: 'RP-20261125-DEMO02',
        student_id: student2Id,
        vendor_id: vendor2Id,
        subtotal: 8.0,
        total_amount: 8.0,
        order_status: 'picked_up',
        payment_method: 'pay_at_pickup',
        payment_status: 'paid',
        pickup_code_hash: hashPickupCode('DEMO02'),
        pickup_deadline: isoHoursFromNow(-0.5),
        created_at: isoHoursFromNow(-2.5),
        updated_at: isoHoursFromNow(-1),
      },
      {
        id: order3,
        order_number: 'RP-20261125-DEMO03',
        student_id: student1Id,
        vendor_id: vendor1Id,
        subtotal: 4.0,
        total_amount: 4.0,
        order_status: 'ready_for_pickup',
        payment_method: 'pay_at_pickup',
        payment_status: 'pending',
        pickup_code_hash: hashPickupCode('RPL842'),
        active_pickup_code_plain: 'RPL842',
        pickup_deadline: isoHoursFromNow(3),
        created_at: isoHoursFromNow(-0.5),
        updated_at: isoHoursFromNow(-0.2),
      },
    ],
    order_items: [
      {
        id: '10000000-0000-0000-0000-000000000001',
        order_id: order1,
        food_listing_id: list1,
        food_name_snapshot: 'Kampung Fried Rice with Egg',
        unit_price: 4.0,
        quantity: 1,
        subtotal: 4.0,
        created_at: isoHoursFromNow(-3),
      },
      {
        id: '10000000-0000-0000-0000-000000000002',
        order_id: order1,
        food_listing_id: list3,
        food_name_snapshot: 'Nasi Lemak Classic Set',
        unit_price: 3.0,
        quantity: 1,
        subtotal: 3.0,
        created_at: isoHoursFromNow(-3),
      },
      {
        id: '10000000-0000-0000-0000-000000000003',
        order_id: order2,
        food_listing_id: list2,
        food_name_snapshot: 'Black Pepper Chicken Chop',
        unit_price: 8.0,
        quantity: 1,
        subtotal: 8.0,
        created_at: isoHoursFromNow(-2.5),
      },
      {
        id: '10000000-0000-0000-0000-000000000004',
        order_id: order3,
        food_listing_id: list1,
        food_name_snapshot: 'Kampung Fried Rice with Egg',
        unit_price: 4.0,
        quantity: 1,
        subtotal: 4.0,
        created_at: isoHoursFromNow(-0.5),
      },
    ],
    pickup_verifications: [
      {
        id: '20000000-0000-0000-0000-000000000001',
        order_id: order1,
        verified_by: vendorOwner1Id,
        verification_method: 'code',
        verified_at: isoHoursFromNow(-1.5),
      },
      {
        id: '20000000-0000-0000-0000-000000000002',
        order_id: order2,
        verified_by: vendorOwner2Id,
        verification_method: 'qr',
        verified_at: isoHoursFromNow(-1),
      },
    ],
    reviews: [
      {
        id: '30000000-0000-0000-0000-000000000001',
        student_id: student1Id,
        vendor_id: vendor1Id,
        order_id: order1,
        rating: 5,
        comment: 'Generous portions and still piping hot when I collected at 6pm!',
        created_at: isoHoursFromNow(-1.2),
      },
    ],
    system_settings: {
      estimated_kg_per_meal: 0.45,
      estimated_co2_per_kg: 2.5,
      platform_contact_email: 'support@replatecampus.edu.my',
      updated_at: now,
    },
    reset_tokens: [],
  };
}

let cachedDb: RePlateDatabase | null = null;

export function loadDb(): RePlateDatabase {
  if (cachedDb) return cachedDb;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const seed = createInitialSeedDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf8');
    cachedDb = seed;
    return cachedDb;
  }
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  cachedDb = JSON.parse(raw) as RePlateDatabase;
  return cachedDb;
}

export function saveDb(db: RePlateDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  cachedDb = db;
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

export function sanitizeProfile(user: StoredUser): Profile {
  const { password_hash: _ignored, ...rest } = user;
  return rest;
}

export function expireOverdueRecords(db: RePlateDatabase): boolean {
  const nowMs = Date.now();
  let changed = false;

  for (const listing of db.food_listings) {
    if (listing.status === 'published' && Date.parse(listing.pickup_end_at) <= nowMs) {
      listing.status = 'expired';
      listing.updated_at = new Date().toISOString();
      changed = true;
    }
  }

  for (const order of db.orders) {
    if (
      (order.order_status === 'pending' ||
        order.order_status === 'confirmed' ||
        order.order_status === 'ready_for_pickup') &&
      Date.parse(order.pickup_deadline) <= nowMs
    ) {
      order.order_status = 'expired' as OrderStatus;
      order.active_pickup_code_plain = undefined;
      order.updated_at = new Date().toISOString();
      changed = true;
    }
  }

  if (changed) {
    saveDb(db);
  }
  return changed;
}

export function createAuthToken(userId: string, role: UserRole, secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      role,
      exp: Date.now() + 7 * 24 * 3600 * 1000,
    }),
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyAuthToken(
  token: string,
  secret: string,
): { sub: string; role: UserRole } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub: string;
      role: UserRole;
      exp: number;
    };
    if (!parsed.sub || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return { sub: parsed.sub, role: parsed.role };
  } catch {
    return null;
  }
}
