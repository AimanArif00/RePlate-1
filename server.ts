import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import {
  calculateDiscountPercent,
  calculateEnvironmentalImpact,
  canTransitionOrderStatus,
  getEffectiveListingStatus,
  validateListingInput,
} from './src/lib/replateRules';
import type {
  EnrichedFoodListing,
  EnrichedOrder,
  ListingStatus,
  OrderStatus,
  UserRole,
} from './src/types/replate';
import {
  createAuthToken,
  expireOverdueRecords,
  generatePickupCode,
  hashPassword,
  hashPickupCode,
  loadDb,
  sanitizeProfile,
  saveDb,
  verifyAuthToken,
  verifyPassword,
  type RePlateDatabase,
  type StoredUser,
} from './server/store';

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads');

interface AuthenticatedRequest extends Request {
  authUser?: StoredUser;
}

function enrichListing(db: RePlateDatabase, listing: RePlateDatabase['food_listings'][number]): EnrichedFoodListing {
  const vendor = db.vendors.find((v) => v.id === listing.vendor_id);
  const category = db.food_categories.find((c) => c.id === listing.category_id);
  const effectiveStatus = getEffectiveListingStatus(listing);
  return {
    ...listing,
    vendor_name: vendor?.business_name ?? 'Campus Vendor',
    vendor_location: vendor?.location ?? 'Campus Cafeteria',
    vendor_approval_status: vendor?.approval_status ?? 'pending',
    category_name: category?.category_name ?? 'Other',
    discount_percentage: calculateDiscountPercent(listing.original_price, listing.discounted_price),
    effective_status: effectiveStatus,
  };
}

function enrichOrder(
  db: RePlateDatabase,
  order: RePlateDatabase['orders'][number],
  includePlainCode: boolean,
): EnrichedOrder {
  const vendor = db.vendors.find((v) => v.id === order.vendor_id);
  const student = db.profiles.find((p) => p.id === order.student_id);
  const items = db.order_items.filter((i) => i.order_id === order.id);
  const verification = db.pickup_verifications.find((pv) => pv.order_id === order.id) ?? null;
  const review = db.reviews.find((r) => r.order_id === order.id) ?? null;
  const { pickup_code_hash: _hash, active_pickup_code_plain, ...safeOrder } = order;

  return {
    ...safeOrder,
    pickup_code: includePlainCode ? active_pickup_code_plain : undefined,
    vendor_name: vendor?.business_name ?? 'Campus Vendor',
    vendor_location: vendor?.location ?? 'Campus Cafeteria',
    student_name: student?.full_name ?? 'Campus Student',
    student_number: student?.student_id ?? null,
    student_phone: student?.phone_number ?? '',
    items,
    verification,
    review,
  };
}

function requireAuth(allowedRoles?: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }

    const verified = verifyAuthToken(token, SESSION_SECRET);
    if (!verified) {
      res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
      return;
    }

    const db = loadDb();
    const user = db.profiles.find((p) => p.id === verified.sub);
    if (!user) {
      res.status(401).json({ error: 'User account not found.' });
      return;
    }

    if (user.account_status === 'suspended') {
      res.status(403).json({ error: 'This account has been suspended by an administrator.' });
      return;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      res.status(403).json({ error: 'You do not have permission to access this resource.' });
      return;
    }

    req.authUser = user;
    next();
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '8mb' }));

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  app.use('/uploads', express.static(UPLOADS_DIR));

  // ---------- AUTHENTICATION ROUTES ----------

  app.post('/api/auth/register/student', (req, res) => {
    const { full_name, student_id, email, phone_number, campus_id, password } = req.body ?? {};
    if (!full_name?.trim() || !student_id?.trim() || !email?.trim() || !phone_number?.trim() || !password) {
      res.status(400).json({ error: 'All student registration fields are required.' });
      return;
    }
    if (String(password).length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    const db = loadDb();
    const normalizedEmail = String(email).trim().toLowerCase();
    if (db.profiles.some((p) => p.email.toLowerCase() === normalizedEmail)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const now = new Date().toISOString();
    const newUser: StoredUser = {
      id: crypto.randomUUID(),
      full_name: String(full_name).trim(),
      email: normalizedEmail,
      student_id: String(student_id).trim(),
      phone_number: String(phone_number).trim(),
      role: 'student',
      campus_id: campus_id || db.campuses[0]?.id || null,
      account_status: 'active',
      password_hash: hashPassword(String(password)),
      created_at: now,
      updated_at: now,
    };

    db.profiles.push(newUser);
    saveDb(db);

    const token = createAuthToken(newUser.id, newUser.role, SESSION_SECRET);
    res.status(201).json({
      token,
      user: sanitizeProfile(newUser),
      vendor: null,
    });
  });

  app.post('/api/auth/register/vendor', (req, res) => {
    const {
      business_name,
      full_name,
      email,
      phone_number,
      location,
      description,
      campus_id,
      password,
    } = req.body ?? {};

    if (
      !business_name?.trim() ||
      !full_name?.trim() ||
      !email?.trim() ||
      !phone_number?.trim() ||
      !location?.trim() ||
      !password
    ) {
      res.status(400).json({ error: 'All vendor registration fields are required.' });
      return;
    }
    if (String(password).length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    const db = loadDb();
    const normalizedEmail = String(email).trim().toLowerCase();
    if (db.profiles.some((p) => p.email.toLowerCase() === normalizedEmail)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const now = new Date().toISOString();
    const ownerId = crypto.randomUUID();
    const selectedCampusId = campus_id || db.campuses[0]?.id || null;

    const newOwner: StoredUser = {
      id: ownerId,
      full_name: String(full_name).trim(),
      email: normalizedEmail,
      student_id: null,
      phone_number: String(phone_number).trim(),
      role: 'vendor',
      campus_id: selectedCampusId,
      account_status: 'pending',
      password_hash: hashPassword(String(password)),
      created_at: now,
      updated_at: now,
    };

    const newVendor = {
      id: crypto.randomUUID(),
      owner_id: ownerId,
      campus_id: selectedCampusId,
      business_name: String(business_name).trim(),
      description: String(description ?? '').trim(),
      location: String(location).trim(),
      contact_phone: String(phone_number).trim(),
      approval_status: 'pending' as const,
      created_at: now,
      updated_at: now,
    };

    db.profiles.push(newOwner);
    db.vendors.push(newVendor);
    saveDb(db);

    const token = createAuthToken(newOwner.id, newOwner.role, SESSION_SECRET);
    res.status(201).json({
      token,
      user: sanitizeProfile(newOwner),
      vendor: newVendor,
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email?.trim() || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const db = loadDb();
    const user = db.profiles.find((p) => p.email.toLowerCase() === String(email).trim().toLowerCase());
    if (!user || !verifyPassword(String(password), user.password_hash)) {
      res.status(401).json({ error: 'Invalid university email or password.' });
      return;
    }

    if (user.account_status === 'suspended') {
      res.status(403).json({ error: 'Your account has been suspended. Please contact the campus administrator.' });
      return;
    }

    const vendor = user.role === 'vendor' ? db.vendors.find((v) => v.owner_id === user.id) ?? null : null;
    const token = createAuthToken(user.id, user.role, SESSION_SECRET);

    res.json({
      token,
      user: sanitizeProfile(user),
      vendor,
    });
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body ?? {};
    if (!email?.trim()) {
      res.status(400).json({ error: 'Please enter your registered email address.' });
      return;
    }
    const db = loadDb();
    const normalized = String(email).trim().toLowerCase();
    const user = db.profiles.find((p) => p.email.toLowerCase() === normalized);
    if (!user) {
      res.json({
        message: 'If an account matches that email, password reset instructions have been prepared.',
        emailConfigured: false,
      });
      return;
    }
    const resetToken = crypto.randomBytes(16).toString('hex');
    db.reset_tokens = db.reset_tokens.filter((t) => t.email !== normalized);
    db.reset_tokens.push({
      email: normalized,
      token: resetToken,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
    saveDb(db);

    res.json({
      message:
        'Password reset token generated. Note: Automated SMTP email delivery requires Supabase Auth SMTP configuration; use the token below in local preview to reset your password.',
      previewResetToken: resetToken,
      emailConfigured: false,
    });
  });

  app.post('/api/auth/reset-password', (req, res) => {
    const { token, new_password } = req.body ?? {};
    if (!token || !new_password || String(new_password).length < 8) {
      res.status(400).json({ error: 'Valid reset token and a new password (8+ characters) are required.' });
      return;
    }
    const db = loadDb();
    const entry = db.reset_tokens.find(
      (t) => t.token === String(token).trim() && Date.parse(t.expires_at) > Date.now(),
    );
    if (!entry) {
      res.status(400).json({ error: 'Reset token is invalid or has expired.' });
      return;
    }
    const user = db.profiles.find((p) => p.email.toLowerCase() === entry.email);
    if (!user) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    user.password_hash = hashPassword(String(new_password));
    user.updated_at = new Date().toISOString();
    db.reset_tokens = db.reset_tokens.filter((t) => t.token !== entry.token);
    saveDb(db);
    res.json({ message: 'Password updated successfully. You can now sign in.' });
  });

  app.get('/api/auth/me', requireAuth(), (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const user = req.authUser!;
    const vendor = user.role === 'vendor' ? db.vendors.find((v) => v.owner_id === user.id) ?? null : null;
    res.json({ user: sanitizeProfile(user), vendor });
  });

  app.patch('/api/auth/profile', requireAuth(), (req: AuthenticatedRequest, res) => {
    const { full_name, phone_number, campus_id, student_id } = req.body ?? {};
    const db = loadDb();
    const user = db.profiles.find((p) => p.id === req.authUser!.id);
    if (!user) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }
    if (!full_name?.trim() || !phone_number?.trim()) {
      res.status(400).json({ error: 'Full name and phone number are required.' });
      return;
    }
    user.full_name = String(full_name).trim();
    user.phone_number = String(phone_number).trim();
    if (campus_id) user.campus_id = String(campus_id);
    if (user.role === 'student' && student_id !== undefined) {
      user.student_id = String(student_id).trim() || user.student_id;
    }
    user.updated_at = new Date().toISOString();
    saveDb(db);
    res.json({ user: sanitizeProfile(user) });
  });

  app.patch('/api/auth/password', requireAuth(), (req: AuthenticatedRequest, res) => {
    const { current_password, new_password } = req.body ?? {};
    if (!current_password || !new_password || String(new_password).length < 8) {
      res.status(400).json({ error: 'Current password and a new password (8+ characters) are required.' });
      return;
    }
    const db = loadDb();
    const user = db.profiles.find((p) => p.id === req.authUser!.id);
    if (!user || !verifyPassword(String(current_password), user.password_hash)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }
    user.password_hash = hashPassword(String(new_password));
    user.updated_at = new Date().toISOString();
    saveDb(db);
    res.json({ message: 'Password updated successfully.' });
  });

  // ---------- PUBLIC MARKETPLACE ROUTES ----------

  app.get('/api/public/marketplace', (_req, res) => {
    const db = loadDb();
    expireOverdueRecords(db);

    const approvedVendors = db.vendors.filter((v) => v.approval_status === 'approved');
    const approvedVendorIds = new Set(approvedVendors.map((v) => v.id));

    const listings = db.food_listings
      .filter((l) => l.status !== 'draft' && l.status !== 'removed' && approvedVendorIds.has(l.vendor_id))
      .map((l) => enrichListing(db, l));

    const enrichedOrdersForImpact = db.orders.map((o) => ({
      order_status: o.order_status,
      items: db.order_items.filter((i) => i.order_id === o.id),
    }));
    const impact = calculateEnvironmentalImpact(enrichedOrdersForImpact, db.system_settings);

    res.json({
      campuses: db.campuses,
      categories: db.food_categories.filter((c) => c.is_active),
      vendors: approvedVendors,
      listings,
      impact,
      settings: db.system_settings,
    });
  });

  app.get('/api/listings/:id', (req, res) => {
    const db = loadDb();
    expireOverdueRecords(db);
    const listing = db.food_listings.find((l) => l.id === req.params.id && l.status !== 'removed');
    if (!listing) {
      res.status(404).json({ error: 'Food listing not found.' });
      return;
    }
    const enriched = enrichListing(db, listing);
    const vendorReviews = db.reviews
      .filter((r) => r.vendor_id === listing.vendor_id)
      .map((r) => ({
        ...r,
        student_name: db.profiles.find((p) => p.id === r.student_id)?.full_name ?? 'Campus Student',
      }));

    res.json({ listing: enriched, reviews: vendorReviews });
  });

  // ---------- IMAGE UPLOAD ROUTE ----------

  app.post('/api/upload', requireAuth(['vendor', 'admin']), (req: AuthenticatedRequest, res) => {
    const { dataUrl, fileName } = req.body ?? {};
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      res.status(400).json({ error: 'Invalid image payload.' });
      return;
    }
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) {
      res.status(400).json({ error: 'Only JPEG, PNG, or WebP images are supported.' });
      return;
    }
    const mime = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      res.status(400).json({ error: 'Image size must be 5MB or smaller.' });
      return;
    }
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const safeSlug = String(fileName ?? 'food')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 24) || 'food';
    const targetName = `${safeSlug}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const resolved = path.resolve(UPLOADS_DIR, targetName);
    if (!resolved.startsWith(UPLOADS_DIR + path.sep)) {
      res.status(400).json({ error: 'Invalid file path.' });
      return;
    }
    fs.writeFileSync(resolved, buffer);
    res.status(201).json({ url: `/uploads/${targetName}` });
  });

  // ---------- OPTIONAL SERVER-SIDE GEMINI LISTING ASSISTANT ----------

  app.post('/api/ai/suggest-listing', requireAuth(['vendor', 'admin']), async (req: AuthenticatedRequest, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(503).json({
        error: 'Gemini AI assistant requires GEMINI_API_KEY in server environment secrets.',
      });
      return;
    }
    const { food_name, notes } = req.body ?? {};
    if (!food_name?.trim()) {
      res.status(400).json({ error: 'Enter a food name first so Gemini can suggest details.' });
      return;
    }
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Write a concise, appetizing 1-2 sentence campus cafeteria food rescue description and suggest a reasonable discounted price in Malaysian Ringgit (RM) for "${String(food_name).trim()}". Vendor notes: ${String(notes ?? 'none').trim()}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              suggestedOriginalPriceRM: { type: Type.NUMBER },
              suggestedDiscountedPriceRM: { type: Type.NUMBER },
              suggestedCategory: { type: Type.STRING },
            },
          },
        },
      });
      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Unable to generate listing suggestion right now.',
      });
    }
  });

  // ---------- STUDENT ORDER & REVIEW ROUTES ----------

  app.post('/api/orders', requireAuth(['student']), (req: AuthenticatedRequest, res) => {
    const { items } = req.body ?? {};
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Your cart is empty.' });
      return;
    }

    const db = loadDb();
    expireOverdueRecords(db);

    const requestedItems: Array<{ food_listing_id: string; quantity: number }> = [];
    for (const raw of items) {
      const qty = Number(raw?.quantity);
      if (!raw?.food_listing_id || !Number.isInteger(qty) || qty <= 0) {
        res.status(400).json({ error: 'Invalid item or quantity in cart.' });
        return;
      }
      requestedItems.push({ food_listing_id: String(raw.food_listing_id), quantity: qty });
    }

    // Validate all items exist, belong to approved vendors, are published, not expired, and have enough stock
    const vendorGroups = new Map<string, Array<{ listing: RePlateDatabase['food_listings'][number]; quantity: number }>>();
    for (const reqItem of requestedItems) {
      const listing = db.food_listings.find((l) => l.id === reqItem.food_listing_id);
      if (!listing) {
        res.status(404).json({ error: 'One of the selected food items no longer exists.' });
        return;
      }
      const vendor = db.vendors.find((v) => v.id === listing.vendor_id && v.approval_status === 'approved');
      if (!vendor) {
        res.status(400).json({ error: `Vendor for "${listing.food_name}" is not currently active.` });
        return;
      }
      const effective = getEffectiveListingStatus(listing);
      if (effective !== 'published') {
        res.status(409).json({ error: `"${listing.food_name}" is ${effective.replace('_', ' ')} and cannot be ordered.` });
        return;
      }
      if (listing.quantity_available < reqItem.quantity) {
        res.status(409).json({
          error: `Only ${listing.quantity_available} portion(s) of "${listing.food_name}" remain in stock.`,
        });
        return;
      }
      const group = vendorGroups.get(listing.vendor_id) ?? [];
      group.push({ listing, quantity: reqItem.quantity });
      vendorGroups.set(listing.vendor_id, group);
    }

    const now = new Date().toISOString();
    const createdOrders: EnrichedOrder[] = [];

    // Atomic deduction & order creation per vendor group
    for (const [vendorId, group] of vendorGroups.entries()) {
      const orderId = crypto.randomUUID();
      const dateStr = now.slice(0, 10).replace(/-/g, '');
      const orderNumber = `RP-${dateStr}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const plainCode = generatePickupCode();
      const codeHash = hashPickupCode(plainCode);

      let subtotal = 0;
      let earliestDeadline = group[0].listing.pickup_end_at;

      for (const { listing, quantity } of group) {
        const lineSubtotal = Math.round(listing.discounted_price * quantity * 100) / 100;
        subtotal = Math.round((subtotal + lineSubtotal) * 100) / 100;
        if (Date.parse(listing.pickup_end_at) < Date.parse(earliestDeadline)) {
          earliestDeadline = listing.pickup_end_at;
        }

        listing.quantity_available -= quantity;
        if (listing.quantity_available === 0) {
          listing.status = 'sold_out';
        }
        listing.updated_at = now;

        db.order_items.push({
          id: crypto.randomUUID(),
          order_id: orderId,
          food_listing_id: listing.id,
          food_name_snapshot: listing.food_name,
          unit_price: listing.discounted_price,
          quantity,
          subtotal: lineSubtotal,
          created_at: now,
        });
      }

      const newOrder = {
        id: orderId,
        order_number: orderNumber,
        student_id: req.authUser!.id,
        vendor_id: vendorId,
        subtotal,
        total_amount: subtotal,
        order_status: 'pending' as OrderStatus,
        payment_method: 'pay_at_pickup' as const,
        payment_status: 'pending' as const,
        pickup_code_hash: codeHash,
        active_pickup_code_plain: plainCode,
        pickup_deadline: earliestDeadline,
        created_at: now,
        updated_at: now,
      };
      db.orders.unshift(newOrder);
      createdOrders.push(enrichOrder(db, newOrder, true));
    }

    saveDb(db);
    res.status(201).json({ orders: createdOrders });
  });

  app.get('/api/orders/mine', requireAuth(['student']), (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    expireOverdueRecords(db);
    const mine = db.orders
      .filter((o) => o.student_id === req.authUser!.id)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .map((o) => enrichOrder(db, o, true));
    const impact = calculateEnvironmentalImpact(mine, db.system_settings);
    res.json({ orders: mine, impact, settings: db.system_settings });
  });

  app.get('/api/orders/:id', requireAuth(), (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    expireOverdueRecords(db);
    const order = db.orders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }
    const user = req.authUser!;
    const vendor = user.role === 'vendor' ? db.vendors.find((v) => v.owner_id === user.id) : null;
    const isOwnerStudent = user.role === 'student' && order.student_id === user.id;
    const isOwnerVendor = user.role === 'vendor' && vendor?.id === order.vendor_id;

    if (!isOwnerStudent && !isOwnerVendor && user.role !== 'admin') {
      res.status(403).json({ error: 'Unauthorized to view this order.' });
      return;
    }

    res.json({ order: enrichOrder(db, order, isOwnerStudent) });
  });

  app.post('/api/orders/:id/cancel', requireAuth(['student']), (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    expireOverdueRecords(db);
    const order = db.orders.find((o) => o.id === req.params.id && o.student_id === req.authUser!.id);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }
    if (!canTransitionOrderStatus(order.order_status, 'cancelled', 'student')) {
      res.status(409).json({
        error: `Orders with status "${order.order_status.replace('_', ' ')}" can no longer be cancelled.`,
      });
      return;
    }

    const now = new Date().toISOString();
    order.order_status = 'cancelled';
    order.active_pickup_code_plain = undefined;
    order.updated_at = now;

    // Restore stock for cancelled items if listing is still active/before deadline
    const items = db.order_items.filter((i) => i.order_id === order.id);
    for (const item of items) {
      const listing = db.food_listings.find((l) => l.id === item.food_listing_id);
      if (listing && listing.status !== 'removed') {
        listing.quantity_available += item.quantity;
        if (listing.status === 'sold_out' && Date.parse(listing.pickup_end_at) > Date.now()) {
          listing.status = 'published';
        }
        listing.updated_at = now;
      }
    }

    saveDb(db);
    res.json({ order: enrichOrder(db, order, false) });
  });

  app.post('/api/orders/:id/review', requireAuth(['student']), (req: AuthenticatedRequest, res) => {
    const { rating, comment } = req.body ?? {};
    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      res.status(400).json({ error: 'Rating must be between 1 and 5.' });
      return;
    }

    const db = loadDb();
    const order = db.orders.find((o) => o.id === req.params.id && o.student_id === req.authUser!.id);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }
    if (order.order_status !== 'picked_up') {
      res.status(409).json({ error: 'You can only review an order after collecting your food.' });
      return;
    }
    if (db.reviews.some((r) => r.order_id === order.id)) {
      res.status(409).json({ error: 'You have already reviewed this order.' });
      return;
    }

    const review = {
      id: crypto.randomUUID(),
      student_id: req.authUser!.id,
      vendor_id: order.vendor_id,
      order_id: order.id,
      rating: numRating,
      comment: String(comment ?? '').trim(),
      created_at: new Date().toISOString(),
    };
    db.reviews.unshift(review);
    saveDb(db);
    res.status(201).json({ review });
  });

  // ---------- VENDOR ROUTES ----------

  app.get('/api/vendor/dashboard', requireAuth(['vendor']), (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    expireOverdueRecords(db);
    const vendor = db.vendors.find((v) => v.owner_id === req.authUser!.id);
    if (!vendor) {
      res.status(404).json({ error: 'Vendor profile not found.' });
      return;
    }

    const listings = db.food_listings
      .filter((l) => l.vendor_id === vendor.id && l.status !== 'removed')
      .map((l) => enrichListing(db, l))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

    const orders = db.orders
      .filter((o) => o.vendor_id === vendor.id)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .map((o) => enrichOrder(db, o, false));

    const impact = calculateEnvironmentalImpact(orders, db.system_settings);
    const totalSales = Math.round(
      orders
        .filter((o) => o.order_status === 'picked_up')
        .reduce((sum, o) => sum + o.total_amount, 0) * 100,
    ) / 100;

    res.json({
      vendor,
      listings,
      orders,
      categories: db.food_categories.filter((c) => c.is_active),
      stats: {
        activeListings: listings.filter((l) => l.effective_status === 'published').length,
        soldOutListings: listings.filter((l) => l.effective_status === 'sold_out').length,
        totalOrders: orders.length,
        pendingOrders: orders.filter((o) => o.order_status === 'pending' || o.order_status === 'confirmed').length,
        readyOrders: orders.filter((o) => o.order_status === 'ready_for_pickup').length,
        completedPickups: impact.completedPickupsCount,
        mealsRescued: impact.totalMealsRescued,
        totalSales,
        availableUnits: listings
          .filter((l) => l.effective_status === 'published')
          .reduce((sum, l) => sum + l.quantity_available, 0),
      },
      impact,
      settings: db.system_settings,
    });
  });

  app.post('/api/vendor/listings', requireAuth(['vendor']), (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const vendor = db.vendors.find((v) => v.owner_id === req.authUser!.id);
    if (!vendor) {
      res.status(404).json({ error: 'Vendor profile not found.' });
      return;
    }
    if (vendor.approval_status !== 'approved') {
      res.status(403).json({ error: 'Your vendor account must be approved by an administrator before publishing food.' });
      return;
    }

    const body = req.body ?? {};
    const input = {
      food_name: String(body.food_name ?? '').trim(),
      description: String(body.description ?? '').trim(),
      category_id: String(body.category_id ?? ''),
      original_price: Number(body.original_price),
      discounted_price: Number(body.discounted_price),
      quantity_available: Number(body.quantity_available),
      pickup_start_at: String(body.pickup_start_at ?? ''),
      pickup_end_at: String(body.pickup_end_at ?? ''),
    };

    const validationError = validateListingInput(input);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const requestedStatus: ListingStatus = body.status === 'draft' ? 'draft' : 'published';
    const finalStatus: ListingStatus =
      input.quantity_available === 0 && requestedStatus === 'published' ? 'sold_out' : requestedStatus;
    const now = new Date().toISOString();
    const newListing = {
      id: crypto.randomUUID(),
      vendor_id: vendor.id,
      category_id: input.category_id,
      food_name: input.food_name,
      description: input.description,
      image_url: String(body.image_url ?? '/src/assets/images/hero_campus_cafeteria_1795588201868.jpg').trim(),
      original_price: Math.round(input.original_price * 100) / 100,
      discounted_price: Math.round(input.discounted_price * 100) / 100,
      quantity_available: input.quantity_available,
      pickup_start_at: new Date(input.pickup_start_at).toISOString(),
      pickup_end_at: new Date(input.pickup_end_at).toISOString(),
      status: finalStatus,
      created_at: now,
      updated_at: now,
    };

    db.food_listings.unshift(newListing);
    saveDb(db);
    res.status(201).json({ listing: enrichListing(db, newListing) });
  });

  app.patch('/api/vendor/listings/:id', requireAuth(['vendor']), (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const vendor = db.vendors.find((v) => v.owner_id === req.authUser!.id);
    const listing = db.food_listings.find((l) => l.id === req.params.id && l.vendor_id === vendor?.id);
    if (!vendor || !listing) {
      res.status(404).json({ error: 'Food listing not found for your vendor account.' });
      return;
    }

    const body = req.body ?? {};
    const input = {
      food_name: String(body.food_name ?? listing.food_name).trim(),
      description: String(body.description ?? listing.description).trim(),
      category_id: String(body.category_id ?? listing.category_id),
      original_price: body.original_price !== undefined ? Number(body.original_price) : listing.original_price,
      discounted_price: body.discounted_price !== undefined ? Number(body.discounted_price) : listing.discounted_price,
      quantity_available: body.quantity_available !== undefined ? Number(body.quantity_available) : listing.quantity_available,
      pickup_start_at: String(body.pickup_start_at ?? listing.pickup_start_at),
      pickup_end_at: String(body.pickup_end_at ?? listing.pickup_end_at),
    };

    const validationError = validateListingInput(input);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    listing.food_name = input.food_name;
    listing.description = input.description;
    listing.category_id = input.category_id;
    listing.original_price = Math.round(input.original_price * 100) / 100;
    listing.discounted_price = Math.round(input.discounted_price * 100) / 100;
    listing.quantity_available = input.quantity_available;
    listing.pickup_start_at = new Date(input.pickup_start_at).toISOString();
    listing.pickup_end_at = new Date(input.pickup_end_at).toISOString();
    if (body.image_url) {
      listing.image_url = String(body.image_url).trim();
    }
    if (body.status && ['draft', 'published', 'removed'].includes(body.status)) {
      listing.status = body.status;
    }
    if (listing.status === 'published' && listing.quantity_available === 0) {
      listing.status = 'sold_out';
    } else if (listing.status === 'sold_out' && listing.quantity_available > 0 && Date.parse(listing.pickup_end_at) > Date.now()) {
      listing.status = 'published';
    }
    listing.updated_at = new Date().toISOString();

    saveDb(db);
    res.json({ listing: enrichListing(db, listing) });
  });

  app.delete('/api/vendor/listings/:id', requireAuth(['vendor']), (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const vendor = db.vendors.find((v) => v.owner_id === req.authUser!.id);
    const listing = db.food_listings.find((l) => l.id === req.params.id && l.vendor_id === vendor?.id);
    if (!vendor || !listing) {
      res.status(404).json({ error: 'Food listing not found.' });
      return;
    }
    listing.status = 'removed';
    listing.updated_at = new Date().toISOString();
    saveDb(db);
    res.json({ message: 'Food listing removed.' });
  });

  app.patch('/api/vendor/profile', requireAuth(['vendor']), (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const vendor = db.vendors.find((v) => v.owner_id === req.authUser!.id);
    if (!vendor) {
      res.status(404).json({ error: 'Vendor profile not found.' });
      return;
    }
    const { business_name, description, location, contact_phone } = req.body ?? {};
    if (!business_name?.trim() || !location?.trim() || !contact_phone?.trim()) {
      res.status(400).json({ error: 'Business name, location, and contact phone are required.' });
      return;
    }
    vendor.business_name = String(business_name).trim();
    vendor.description = String(description ?? '').trim();
    vendor.location = String(location).trim();
    vendor.contact_phone = String(contact_phone).trim();
    vendor.updated_at = new Date().toISOString();
    saveDb(db);
    res.json({ vendor });
  });

  app.patch('/api/vendor/orders/:id/status', requireAuth(['vendor']), (req: AuthenticatedRequest, res) => {
    const { next_status } = req.body ?? {};
    const db = loadDb();
    const vendor = db.vendors.find((v) => v.owner_id === req.authUser!.id);
    const order = db.orders.find((o) => o.id === req.params.id && o.vendor_id === vendor?.id);
    if (!vendor || !order) {
      res.status(404).json({ error: 'Order not found for your vendor account.' });
      return;
    }
    if (next_status === 'picked_up') {
      res.status(400).json({ error: 'Orders can only be marked Picked Up through Pickup Code verification.' });
      return;
    }
    if (!canTransitionOrderStatus(order.order_status, next_status, 'vendor')) {
      res.status(409).json({
        error: `Cannot move order from "${order.order_status}" to "${String(next_status)}".`,
      });
      return;
    }

    const now = new Date().toISOString();
    order.order_status = next_status;
    order.updated_at = now;
    if (next_status === 'cancelled') {
      order.active_pickup_code_plain = undefined;
      const items = db.order_items.filter((i) => i.order_id === order.id);
      for (const item of items) {
        const listing = db.food_listings.find((l) => l.id === item.food_listing_id);
        if (listing && listing.status !== 'removed') {
          listing.quantity_available += item.quantity;
          if (listing.status === 'sold_out' && Date.parse(listing.pickup_end_at) > Date.now()) {
            listing.status = 'published';
          }
          listing.updated_at = now;
        }
      }
    }

    saveDb(db);
    res.json({ order: enrichOrder(db, order, false) });
  });

  // Lookup or verify pickup code (two-step: preview order details, then confirm collection)
  app.post('/api/vendor/verify-pickup', requireAuth(['vendor']), (req: AuthenticatedRequest, res) => {
    const { pickup_code, order_number, method = 'code', confirm = false } = req.body ?? {};
    const db = loadDb();
    expireOverdueRecords(db);

    const vendor = db.vendors.find((v) => v.owner_id === req.authUser!.id);
    if (!vendor || vendor.approval_status !== 'approved') {
      res.status(403).json({ error: 'Approved vendor account required.' });
      return;
    }

    let rawCode = String(pickup_code ?? '').trim().toUpperCase();
    let targetOrderNumber = String(order_number ?? '').trim().toUpperCase();

    // Support scanning QR JSON payload: {"orderNumber":"...","pickupCode":"..."}
    if (rawCode.startsWith('{')) {
      try {
        const qrPayload = JSON.parse(rawCode) as { orderNumber?: string; pickupCode?: string };
        rawCode = String(qrPayload.pickupCode ?? '').trim().toUpperCase();
        targetOrderNumber = String(qrPayload.orderNumber ?? targetOrderNumber).trim().toUpperCase();
      } catch {
        res.status(400).json({ error: 'Unrecognized QR code format.' });
        return;
      }
    }

    if (!rawCode) {
      res.status(400).json({ error: 'Please enter or scan a pickup verification code.' });
      return;
    }

    const codeHash = hashPickupCode(rawCode);
    const matchingOrder = db.orders.find((o) => {
      if (targetOrderNumber && o.order_number.toUpperCase() !== targetOrderNumber) return false;
      return o.pickup_code_hash === codeHash;
    });

    if (!matchingOrder) {
      res.status(404).json({ error: 'No matching order found for that pickup code.' });
      return;
    }

    if (matchingOrder.vendor_id !== vendor.id) {
      res.status(403).json({ error: 'This pickup code belongs to a different campus vendor.' });
      return;
    }

    if (matchingOrder.order_status === 'picked_up') {
      res.status(409).json({ error: 'Duplicate collection blocked: this order has already been collected.' });
      return;
    }

    if (matchingOrder.order_status === 'cancelled' || matchingOrder.order_status === 'expired') {
      res.status(409).json({
        error: `This order is ${matchingOrder.order_status} and can no longer be collected.`,
      });
      return;
    }

    if (!confirm) {
      res.json({
        verifiedPreview: true,
        order: enrichOrder(db, matchingOrder, false),
      });
      return;
    }

    const now = new Date().toISOString();
    matchingOrder.order_status = 'picked_up';
    matchingOrder.payment_status = 'paid';
    matchingOrder.active_pickup_code_plain = undefined;
    matchingOrder.updated_at = now;

    db.pickup_verifications.push({
      id: crypto.randomUUID(),
      order_id: matchingOrder.id,
      verified_by: req.authUser!.id,
      verification_method: method === 'qr' ? 'qr' : 'code',
      verified_at: now,
    });

    saveDb(db);
    res.json({
      verified: true,
      order: enrichOrder(db, matchingOrder, false),
    });
  });

  // ---------- ADMINISTRATOR ROUTES ----------

  app.get('/api/admin/dashboard', requireAuth(['admin']), (_req, res) => {
    const db = loadDb();
    expireOverdueRecords(db);

    const students = db.profiles.filter((p) => p.role === 'student').map(sanitizeProfile);
    const vendors = db.vendors.map((v) => ({
      ...v,
      owner_name: db.profiles.find((p) => p.id === v.owner_id)?.full_name ?? '',
      owner_email: db.profiles.find((p) => p.id === v.owner_id)?.email ?? '',
      owner_status: db.profiles.find((p) => p.id === v.owner_id)?.account_status ?? 'pending',
    }));
    const listings = db.food_listings
      .filter((l) => l.status !== 'removed')
      .map((l) => enrichListing(db, l))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    const orders = db.orders
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .map((o) => enrichOrder(db, o, false));

    const impact = calculateEnvironmentalImpact(orders, db.system_settings);
    const totalRevenue = Math.round(
      orders
        .filter((o) => o.order_status === 'picked_up')
        .reduce((sum, o) => sum + o.total_amount, 0) * 100,
    ) / 100;

    res.json({
      students,
      vendors,
      categories: db.food_categories,
      campuses: db.campuses,
      listings,
      orders,
      impact,
      settings: db.system_settings,
      stats: {
        totalStudents: students.length,
        totalVendors: vendors.length,
        pendingVendorApprovals: vendors.filter((v) => v.approval_status === 'pending').length,
        totalListings: listings.length,
        activeListings: listings.filter((l) => l.effective_status === 'published').length,
        totalOrders: orders.length,
        completedPickups: impact.completedPickupsCount,
        totalMealsRescued: impact.totalMealsRescued,
        estimatedFoodSavedKg: impact.estimatedFoodSavedKg,
        totalRevenue,
      },
    });
  });

  app.patch('/api/admin/vendors/:id/approval', requireAuth(['admin']), (req, res) => {
    const { approval_status } = req.body ?? {};
    if (!['approved', 'rejected', 'pending'].includes(approval_status)) {
      res.status(400).json({ error: 'Invalid approval status.' });
      return;
    }
    const db = loadDb();
    const vendor = db.vendors.find((v) => v.id === req.params.id);
    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found.' });
      return;
    }
    vendor.approval_status = approval_status;
    vendor.updated_at = new Date().toISOString();

    const owner = db.profiles.find((p) => p.id === vendor.owner_id);
    if (owner) {
      owner.account_status = approval_status === 'approved' ? 'active' : approval_status === 'rejected' ? 'suspended' : 'pending';
      owner.updated_at = new Date().toISOString();
    }
    saveDb(db);
    res.json({ vendor });
  });

  app.patch('/api/admin/users/:id/status', requireAuth(['admin']), (req: AuthenticatedRequest, res) => {
    const { account_status } = req.body ?? {};
    if (!['active', 'suspended', 'pending'].includes(account_status)) {
      res.status(400).json({ error: 'Invalid account status.' });
      return;
    }
    if (req.params.id === req.authUser!.id) {
      res.status(400).json({ error: 'You cannot suspend your own administrator account.' });
      return;
    }
    const db = loadDb();
    const user = db.profiles.find((p) => p.id === req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    user.account_status = account_status;
    user.updated_at = new Date().toISOString();
    saveDb(db);
    res.json({ user: sanitizeProfile(user) });
  });

  app.post('/api/admin/categories', requireAuth(['admin']), (req, res) => {
    const { category_name, description } = req.body ?? {};
    if (!category_name?.trim()) {
      res.status(400).json({ error: 'Category name is required.' });
      return;
    }
    const db = loadDb();
    if (db.food_categories.some((c) => c.category_name.toLowerCase() === String(category_name).trim().toLowerCase())) {
      res.status(409).json({ error: 'A category with that name already exists.' });
      return;
    }
    const category = {
      id: crypto.randomUUID(),
      category_name: String(category_name).trim(),
      description: String(description ?? '').trim(),
      is_active: true,
      created_at: new Date().toISOString(),
    };
    db.food_categories.push(category);
    saveDb(db);
    res.status(201).json({ category });
  });

  app.patch('/api/admin/categories/:id', requireAuth(['admin']), (req, res) => {
    const db = loadDb();
    const category = db.food_categories.find((c) => c.id === req.params.id);
    if (!category) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }
    const { category_name, description, is_active } = req.body ?? {};
    if (category_name !== undefined && String(category_name).trim()) {
      category.category_name = String(category_name).trim();
    }
    if (description !== undefined) {
      category.description = String(description).trim();
    }
    if (typeof is_active === 'boolean') {
      category.is_active = is_active;
    }
    saveDb(db);
    res.json({ category });
  });

  app.delete('/api/admin/listings/:id', requireAuth(['admin']), (req, res) => {
    const db = loadDb();
    const listing = db.food_listings.find((l) => l.id === req.params.id);
    if (!listing) {
      res.status(404).json({ error: 'Food listing not found.' });
      return;
    }
    listing.status = 'removed';
    listing.updated_at = new Date().toISOString();
    saveDb(db);
    res.json({ message: 'Food listing removed by administrator.' });
  });

  app.patch('/api/admin/settings', requireAuth(['admin']), (req, res) => {
    const { estimated_kg_per_meal, estimated_co2_per_kg, platform_contact_email } = req.body ?? {};
    const kg = Number(estimated_kg_per_meal);
    const co2 = Number(estimated_co2_per_kg);
    if (!Number.isFinite(kg) || kg <= 0 || kg > 5) {
      res.status(400).json({ error: 'Estimated kg per meal must be between 0.05 and 5.0 kg.' });
      return;
    }
    if (!Number.isFinite(co2) || co2 <= 0 || co2 > 20) {
      res.status(400).json({ error: 'Estimated CO2 factor must be between 0.1 and 20.0 kg/kg.' });
      return;
    }
    const db = loadDb();
    db.system_settings = {
      estimated_kg_per_meal: Math.round(kg * 1000) / 1000,
      estimated_co2_per_kg: Math.round(co2 * 1000) / 1000,
      platform_contact_email: String(platform_contact_email ?? db.system_settings.platform_contact_email).trim(),
      updated_at: new Date().toISOString(),
    };
    saveDb(db);
    res.json({ settings: db.system_settings });
  });

  // ---------- VITE / STATIC ASSET SERVING ----------

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`RePlate Campus server listening on http://localhost:${PORT}`);
  });
}

startServer();
