import type {
  CartItem,
  FoodListing,
  ImpactSummary,
  ListingStatus,
  OrderStatus,
  SystemSettings,
  UserRole,
} from '../types/replate';

export interface ListingValidationInput {
  food_name: string;
  description: string;
  category_id: string;
  original_price: number;
  discounted_price: number;
  quantity_available: number;
  pickup_start_at: string;
  pickup_end_at: string;
}

export function calculateDiscountPercent(originalPrice: number, discountedPrice: number): number {
  if (!Number.isFinite(originalPrice) || originalPrice <= 0) {
    return 0;
  }
  if (!Number.isFinite(discountedPrice) || discountedPrice < 0) {
    return 0;
  }
  if (discountedPrice >= originalPrice) {
    return 0;
  }
  return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
}

export function validateListingInput(input: ListingValidationInput): string | null {
  if (!input.food_name.trim() || input.food_name.trim().length < 2) {
    return 'Food name must be at least 2 characters.';
  }
  if (!input.description.trim() || input.description.trim().length < 8) {
    return 'Please provide a short description of at least 8 characters.';
  }
  if (!input.category_id) {
    return 'Please select a food category.';
  }
  if (!Number.isFinite(input.original_price) || input.original_price <= 0) {
    return 'Original price must be greater than RM0.00.';
  }
  if (!Number.isFinite(input.discounted_price) || input.discounted_price < 0) {
    return 'Discounted price cannot be negative.';
  }
  if (input.discounted_price >= input.original_price) {
    return 'Discounted price must be lower than the original price.';
  }
  if (!Number.isInteger(input.quantity_available) || input.quantity_available < 0) {
    return 'Available quantity must be a whole number of 0 or more.';
  }
  const start = Date.parse(input.pickup_start_at);
  const end = Date.parse(input.pickup_end_at);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return 'Please enter valid pickup start and end times.';
  }
  if (end <= start) {
    return 'Pickup end time must be after pickup start time.';
  }
  return null;
}

export function getEffectiveListingStatus(
  listing: Pick<FoodListing, 'status' | 'quantity_available' | 'pickup_end_at'>,
  nowMs: number = Date.now(),
): ListingStatus {
  if (listing.status === 'removed' || listing.status === 'draft') {
    return listing.status;
  }
  const endMs = Date.parse(listing.pickup_end_at);
  if (!Number.isNaN(endMs) && endMs <= nowMs) {
    return 'expired';
  }
  if (listing.quantity_available <= 0) {
    return 'sold_out';
  }
  return listing.status;
}

export function canAddToCart(
  listing: Pick<FoodListing, 'status' | 'quantity_available' | 'pickup_end_at'>,
  existingCartQty: number,
  requestedAddQty: number,
  nowMs: number = Date.now(),
): { ok: boolean; reason?: string } {
  if (!Number.isInteger(requestedAddQty) || requestedAddQty <= 0) {
    return { ok: false, reason: 'Quantity must be at least 1.' };
  }
  const effective = getEffectiveListingStatus(listing, nowMs);
  if (effective === 'expired') {
    return { ok: false, reason: 'This listing has passed its pickup deadline.' };
  }
  if (effective === 'sold_out' || listing.quantity_available <= 0) {
    return { ok: false, reason: 'This item is sold out.' };
  }
  if (effective !== 'published') {
    return { ok: false, reason: 'This listing is not currently available.' };
  }
  if (existingCartQty + requestedAddQty > listing.quantity_available) {
    return {
      ok: false,
      reason: `Only ${listing.quantity_available} portion(s) left in stock.`,
    };
  }
  return { ok: true };
}

export function calculateCartTotals(
  cartItems: CartItem[],
  listingsById: Record<string, Pick<FoodListing, 'id' | 'original_price' | 'discounted_price'>>,
): {
  subtotal: number;
  originalTotal: number;
  savings: number;
  totalQuantity: number;
} {
  let subtotal = 0;
  let originalTotal = 0;
  let totalQuantity = 0;

  for (const item of cartItems) {
    const listing = listingsById[item.listingId];
    if (!listing || item.quantity <= 0) continue;
    subtotal += listing.discounted_price * item.quantity;
    originalTotal += listing.original_price * item.quantity;
    totalQuantity += item.quantity;
  }

  const roundedSub = Math.round(subtotal * 100) / 100;
  const roundedOrig = Math.round(originalTotal * 100) / 100;

  return {
    subtotal: roundedSub,
    originalTotal: roundedOrig,
    savings: Math.max(0, Math.round((roundedOrig - roundedSub) * 100) / 100),
    totalQuantity,
  };
}

export function canTransitionOrderStatus(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
  actorRole: UserRole,
): boolean {
  if (currentStatus === nextStatus) return false;
  if (currentStatus === 'picked_up' || currentStatus === 'cancelled' || currentStatus === 'expired') {
    return false;
  }

  if (actorRole === 'student') {
    return (
      nextStatus === 'cancelled' &&
      (currentStatus === 'pending' || currentStatus === 'confirmed')
    );
  }

  if (actorRole === 'vendor') {
    if (currentStatus === 'pending') {
      return nextStatus === 'confirmed' || nextStatus === 'ready_for_pickup' || nextStatus === 'cancelled';
    }
    if (currentStatus === 'confirmed') {
      return nextStatus === 'ready_for_pickup' || nextStatus === 'cancelled';
    }
    if (currentStatus === 'ready_for_pickup') {
      return nextStatus === 'picked_up' || nextStatus === 'expired';
    }
  }

  if (actorRole === 'admin') {
    return true;
  }

  return false;
}

export function calculateEnvironmentalImpact(
  completedOrders: Array<{
    order_status: OrderStatus;
    items: Array<{ quantity: number }>;
  }>,
  settings: Pick<SystemSettings, 'estimated_kg_per_meal' | 'estimated_co2_per_kg'>,
): ImpactSummary {
  const pickedUpOrders = completedOrders.filter((o) => o.order_status === 'picked_up');
  const totalMealsRescued = pickedUpOrders.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0,
  );
  const kgPerMeal = settings.estimated_kg_per_meal > 0 ? settings.estimated_kg_per_meal : 0.45;
  const co2PerKg = settings.estimated_co2_per_kg > 0 ? settings.estimated_co2_per_kg : 2.5;
  const estimatedFoodSavedKg = Math.round(totalMealsRescued * kgPerMeal * 100) / 100;
  const estimatedCo2AvoidedKg = Math.round(estimatedFoodSavedKg * co2PerKg * 100) / 100;

  return {
    completedPickupsCount: pickedUpOrders.length,
    totalMealsRescued,
    estimatedFoodSavedKg,
    estimatedCo2AvoidedKg,
    assumedKgPerMeal: kgPerMeal,
    assumedCo2PerKg: co2PerKg,
  };
}

export function formatRM(amount: number): string {
  return `RM${amount.toFixed(2)}`;
}

export function formatPickupWindow(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Pickup time unavailable';
  }
  const timeFmt = new Intl.DateTimeFormat('en-MY', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${timeFmt.format(start)} – ${timeFmt.format(end)}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export function getOrderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'confirmed':
      return 'Confirmed';
    case 'ready_for_pickup':
      return 'Ready for Pickup';
    case 'picked_up':
      return 'Picked Up';
    case 'cancelled':
      return 'Cancelled';
    case 'expired':
      return 'Expired';
  }
}

export function getListingStatusLabel(status: ListingStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'published':
      return 'Available';
    case 'sold_out':
      return 'Sold Out';
    case 'expired':
      return 'Expired';
    case 'removed':
      return 'Removed';
  }
}
