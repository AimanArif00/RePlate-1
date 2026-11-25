import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase/client';
import type {
  ApprovalStatus,
  AccountStatus,
  AuthSession,
  Campus,
  EnrichedFoodListing,
  EnrichedOrder,
  FoodCategory,
  ImpactSummary,
  ListingStatus,
  OrderStatus,
  Profile,
  Review,
  SystemSettings,
  Vendor,
} from '../types/replate';

let activeToken: string | null = null;

export function setSessionToken(token: string | null): void {
  activeToken = token;
}

export function getSessionToken(): string | null {
  return activeToken;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (activeToken) {
    headers.set('Authorization', `Bearer ${activeToken}`);
  }

  const res = await fetch(path, { ...options, headers });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export interface MarketplacePayload {
  campuses: Campus[];
  categories: FoodCategory[];
  vendors: Vendor[];
  listings: EnrichedFoodListing[];
  impact: ImpactSummary;
  settings: SystemSettings;
}

export const replateService = {
  isUsingExternalSupabase(): boolean {
    return isSupabaseConfigured();
  },

  async fetchMarketplace(): Promise<MarketplacePayload> {
    return apiRequest<MarketplacePayload>('/api/public/marketplace');
  },

  async fetchListingDetail(id: string): Promise<{ listing: EnrichedFoodListing; reviews: Review[] }> {
    return apiRequest<{ listing: EnrichedFoodListing; reviews: Review[] }>(`/api/listings/${encodeURIComponent(id)}`);
  },

  async registerStudent(payload: {
    full_name: string;
    student_id: string;
    email: string;
    phone_number: string;
    campus_id: string;
    password: string;
  }): Promise<AuthSession> {
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient()!;
      const { data, error } = await sb.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          data: {
            role: 'student',
            full_name: payload.full_name,
            student_id: payload.student_id,
            phone_number: payload.phone_number,
            campus_id: payload.campus_id,
          },
        },
      });
      if (error) throw new Error(error.message);
      if (data.session && data.user) {
        const { data: profile } = await sb.from('profiles').select('*').eq('id', data.user.id).single();
        if (profile) {
          setSessionToken(data.session.access_token);
          return { token: data.session.access_token, user: profile as Profile, vendor: null };
        }
      }
    }

    const res = await apiRequest<AuthSession>('/api/auth/register/student', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setSessionToken(res.token);
    return res;
  },

  async registerVendor(payload: {
    business_name: string;
    full_name: string;
    email: string;
    phone_number: string;
    location: string;
    description: string;
    campus_id: string;
    password: string;
  }): Promise<AuthSession> {
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient()!;
      const { data, error } = await sb.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          data: {
            role: 'vendor',
            full_name: payload.full_name,
            business_name: payload.business_name,
            phone_number: payload.phone_number,
            location: payload.location,
            description: payload.description,
            campus_id: payload.campus_id,
          },
        },
      });
      if (error) throw new Error(error.message);
      if (data.session && data.user) {
        const { data: profile } = await sb.from('profiles').select('*').eq('id', data.user.id).single();
        const { data: vendor } = await sb.from('vendors').select('*').eq('owner_id', data.user.id).single();
        if (profile) {
          setSessionToken(data.session.access_token);
          return {
            token: data.session.access_token,
            user: profile as Profile,
            vendor: (vendor as Vendor) ?? null,
          };
        }
      }
    }

    const res = await apiRequest<AuthSession>('/api/auth/register/vendor', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setSessionToken(res.token);
    return res;
  },

  async login(email: string, password: string): Promise<AuthSession> {
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient()!;
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      if (data.session && data.user) {
        const { data: profile } = await sb.from('profiles').select('*').eq('id', data.user.id).single();
        const { data: vendor } = await sb.from('vendors').select('*').eq('owner_id', data.user.id).maybeSingle();
        if (profile) {
          setSessionToken(data.session.access_token);
          return {
            token: data.session.access_token,
            user: profile as Profile,
            vendor: (vendor as Vendor) ?? null,
          };
        }
      }
    }

    const res = await apiRequest<AuthSession>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setSessionToken(res.token);
    return res;
  },

  async logout(): Promise<void> {
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      await sb?.auth.signOut();
    }
    setSessionToken(null);
  },

  async forgotPassword(email: string): Promise<{ message: string; previewResetToken?: string }> {
    return apiRequest('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(token: string, new_password: string): Promise<{ message: string }> {
    return apiRequest('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password }),
    });
  },

  async updateProfile(payload: {
    full_name: string;
    phone_number: string;
    campus_id?: string | null;
    student_id?: string | null;
  }): Promise<{ user: Profile }> {
    return apiRequest('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async updatePassword(current_password: string, new_password: string): Promise<{ message: string }> {
    return apiRequest('/api/auth/password', {
      method: 'PATCH',
      body: JSON.stringify({ current_password, new_password }),
    });
  },

  async placeOrder(items: Array<{ food_listing_id: string; quantity: number }>): Promise<{ orders: EnrichedOrder[] }> {
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient()!;
      const listingIds = items.map((i) => i.food_listing_id);
      const { data: listingsData, error: listingsErr } = await sb
        .from('food_listings')
        .select('id, vendor_id')
        .in('id', listingIds);
      if (listingsErr) throw new Error(listingsErr.message);

      const vendorByListing = new Map<string, string>();
      for (const row of listingsData ?? []) {
        vendorByListing.set(row.id as string, row.vendor_id as string);
      }

      const grouped = new Map<string, Array<{ food_listing_id: string; quantity: number }>>();
      for (const item of items) {
        const vendorId = vendorByListing.get(item.food_listing_id);
        if (!vendorId) throw new Error('Food listing not found.');
        const list = grouped.get(vendorId) ?? [];
        list.push(item);
        grouped.set(vendorId, list);
      }

      const createdOrders: EnrichedOrder[] = [];
      for (const [vendorId, vendorItems] of grouped.entries()) {
        const { data: rpcRows, error: rpcErr } = await sb.rpc('create_replate_order', {
          p_vendor_id: vendorId,
          p_items: vendorItems,
        });
        if (rpcErr) throw new Error(rpcErr.message);
        const created = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
        if (created?.order_id) {
          const { data: orderRow } = await sb
            .from('orders')
            .select('*, vendors(business_name, location), profiles!orders_student_id_fkey(full_name, student_id, phone_number), order_items(*)')
            .eq('id', created.order_id)
            .single();
          if (orderRow) {
            const vendorInfo = orderRow.vendors as { business_name?: string; location?: string } | null;
            const studentInfo = orderRow.profiles as { full_name?: string; student_id?: string | null; phone_number?: string } | null;
            createdOrders.push({
              ...(orderRow as EnrichedOrder),
              pickup_code: created.pickup_code as string,
              vendor_name: vendorInfo?.business_name ?? 'Campus Vendor',
              vendor_location: vendorInfo?.location ?? '',
              student_name: studentInfo?.full_name ?? '',
              student_number: studentInfo?.student_id ?? null,
              student_phone: studentInfo?.phone_number ?? '',
              items: (orderRow.order_items ?? []) as EnrichedOrder['items'],
            });
          }
        }
      }
      if (createdOrders.length > 0) {
        return { orders: createdOrders };
      }
    }

    return apiRequest('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },

  async fetchStudentOrders(): Promise<{ orders: EnrichedOrder[]; impact: ImpactSummary; settings: SystemSettings }> {
    return apiRequest('/api/orders/mine');
  },

  async cancelOrder(orderId: string): Promise<{ order: EnrichedOrder }> {
    return apiRequest(`/api/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST',
    });
  },

  async submitReview(orderId: string, rating: number, comment: string): Promise<{ review: Review }> {
    return apiRequest(`/api/orders/${encodeURIComponent(orderId)}/review`, {
      method: 'POST',
      body: JSON.stringify({ rating, comment }),
    });
  },

  async fetchVendorDashboard(): Promise<{
    vendor: Vendor;
    listings: EnrichedFoodListing[];
    orders: EnrichedOrder[];
    categories: FoodCategory[];
    stats: {
      activeListings: number;
      soldOutListings: number;
      totalOrders: number;
      pendingOrders: number;
      readyOrders: number;
      completedPickups: number;
      mealsRescued: number;
      totalSales: number;
      availableUnits: number;
    };
    impact: ImpactSummary;
    settings: SystemSettings;
  }> {
    return apiRequest('/api/vendor/dashboard');
  },

  async uploadFoodImage(dataUrl: string, fileName: string): Promise<{ url: string }> {
    return apiRequest('/api/upload', {
      method: 'POST',
      body: JSON.stringify({ dataUrl, fileName }),
    });
  },

  async suggestListingWithAi(food_name: string, notes: string): Promise<{
    description?: string;
    suggestedOriginalPriceRM?: number;
    suggestedDiscountedPriceRM?: number;
    suggestedCategory?: string;
  }> {
    return apiRequest('/api/ai/suggest-listing', {
      method: 'POST',
      body: JSON.stringify({ food_name, notes }),
    });
  },

  async createVendorListing(payload: {
    food_name: string;
    description: string;
    category_id: string;
    image_url: string;
    original_price: number;
    discounted_price: number;
    quantity_available: number;
    pickup_start_at: string;
    pickup_end_at: string;
    status: ListingStatus;
  }): Promise<{ listing: EnrichedFoodListing }> {
    return apiRequest('/api/vendor/listings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateVendorListing(
    id: string,
    payload: Partial<{
      food_name: string;
      description: string;
      category_id: string;
      image_url: string;
      original_price: number;
      discounted_price: number;
      quantity_available: number;
      pickup_start_at: string;
      pickup_end_at: string;
      status: ListingStatus;
    }>,
  ): Promise<{ listing: EnrichedFoodListing }> {
    return apiRequest(`/api/vendor/listings/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async deleteVendorListing(id: string): Promise<void> {
    await apiRequest(`/api/vendor/listings/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async updateVendorProfile(payload: {
    business_name: string;
    description: string;
    location: string;
    contact_phone: string;
  }): Promise<{ vendor: Vendor }> {
    return apiRequest('/api/vendor/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async updateVendorOrderStatus(orderId: string, next_status: OrderStatus): Promise<{ order: EnrichedOrder }> {
    return apiRequest(`/api/vendor/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ next_status }),
    });
  },

  async verifyPickupCode(payload: {
    pickup_code: string;
    order_number?: string;
    method?: 'code' | 'qr';
    confirm: boolean;
  }): Promise<{ verifiedPreview?: boolean; verified?: boolean; order: EnrichedOrder }> {
    if (isSupabaseConfigured() && payload.confirm && payload.order_number) {
      const sb = getSupabaseClient()!;
      const { data: rpcRows, error: rpcErr } = await sb.rpc('verify_pickup_code', {
        p_order_number: payload.order_number,
        p_pickup_code: payload.pickup_code,
        p_method: payload.method ?? 'code',
      });
      if (rpcErr) throw new Error(rpcErr.message);
      const verified = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      if (verified?.verified_order_id) {
        const { data: orderRow } = await sb
          .from('orders')
          .select('*, vendors(business_name, location), profiles!orders_student_id_fkey(full_name, student_id, phone_number), order_items(*)')
          .eq('id', verified.verified_order_id)
          .single();
        if (orderRow) {
          const vendorInfo = orderRow.vendors as { business_name?: string; location?: string } | null;
          const studentInfo = orderRow.profiles as { full_name?: string; student_id?: string | null; phone_number?: string } | null;
          return {
            verified: true,
            order: {
              ...(orderRow as EnrichedOrder),
              vendor_name: vendorInfo?.business_name ?? 'Campus Vendor',
              vendor_location: vendorInfo?.location ?? '',
              student_name: studentInfo?.full_name ?? '',
              student_number: studentInfo?.student_id ?? null,
              student_phone: studentInfo?.phone_number ?? '',
              items: (orderRow.order_items ?? []) as EnrichedOrder['items'],
            },
          };
        }
      }
    }

    return apiRequest('/api/vendor/verify-pickup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async fetchAdminDashboard(): Promise<{
    students: Profile[];
    vendors: Array<Vendor & { owner_name: string; owner_email: string; owner_status: AccountStatus }>;
    categories: FoodCategory[];
    campuses: Campus[];
    listings: EnrichedFoodListing[];
    orders: EnrichedOrder[];
    impact: ImpactSummary;
    settings: SystemSettings;
    stats: {
      totalStudents: number;
      totalVendors: number;
      pendingVendorApprovals: number;
      totalListings: number;
      activeListings: number;
      totalOrders: number;
      completedPickups: number;
      totalMealsRescued: number;
      estimatedFoodSavedKg: number;
      totalRevenue: number;
    };
  }> {
    return apiRequest('/api/admin/dashboard');
  },

  async setVendorApproval(vendorId: string, approval_status: ApprovalStatus): Promise<{ vendor: Vendor }> {
    return apiRequest(`/api/admin/vendors/${encodeURIComponent(vendorId)}/approval`, {
      method: 'PATCH',
      body: JSON.stringify({ approval_status }),
    });
  },

  async setUserAccountStatus(userId: string, account_status: AccountStatus): Promise<{ user: Profile }> {
    return apiRequest(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ account_status }),
    });
  },

  async createCategory(category_name: string, description: string): Promise<{ category: FoodCategory }> {
    return apiRequest('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify({ category_name, description }),
    });
  },

  async updateCategory(
    id: string,
    payload: Partial<Pick<FoodCategory, 'category_name' | 'description' | 'is_active'>>,
  ): Promise<{ category: FoodCategory }> {
    return apiRequest(`/api/admin/categories/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async removeAdminListing(id: string): Promise<void> {
    await apiRequest(`/api/admin/listings/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async updateSystemSettings(payload: {
    estimated_kg_per_meal: number;
    estimated_co2_per_kg: number;
    platform_contact_email: string;
  }): Promise<{ settings: SystemSettings }> {
    return apiRequest('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};
