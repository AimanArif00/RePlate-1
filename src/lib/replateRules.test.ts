import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCartTotals,
  calculateDiscountPercent,
  calculateEnvironmentalImpact,
  canAddToCart,
  canTransitionOrderStatus,
  getEffectiveListingStatus,
  validateListingInput,
} from './replateRules';

test('calculateDiscountPercent computes accurate percentage and guards invalid inputs', () => {
  assert.equal(calculateDiscountPercent(10, 5), 50);
  assert.equal(calculateDiscountPercent(15, 8), 47);
  assert.equal(calculateDiscountPercent(6, 3), 50);
  assert.equal(calculateDiscountPercent(0, 0), 0);
  assert.equal(calculateDiscountPercent(10, 12), 0);
});

test('validateListingInput rejects negative prices, discounted >= original, and invalid windows', () => {
  const valid = {
    food_name: 'Nasi Lemak Special',
    description: 'Fragrant coconut rice with sambal and egg',
    category_id: 'cat-1',
    original_price: 8,
    discounted_price: 4,
    quantity_available: 5,
    pickup_start_at: '2026-11-25T16:00:00.000Z',
    pickup_end_at: '2026-11-25T19:00:00.000Z',
  };
  assert.equal(validateListingInput(valid), null);
  assert.ok(validateListingInput({ ...valid, discounted_price: 8 }));
  assert.ok(validateListingInput({ ...valid, discounted_price: -1 }));
  assert.ok(validateListingInput({ ...valid, quantity_available: -2 }));
  assert.ok(
    validateListingInput({
      ...valid,
      pickup_end_at: '2026-11-25T15:00:00.000Z',
    }),
  );
});

test('getEffectiveListingStatus transitions expired and sold_out automatically', () => {
  const future = '2026-11-25T20:00:00.000Z';
  const past = '2026-11-25T10:00:00.000Z';
  const now = Date.parse('2026-11-25T15:00:00.000Z');

  assert.equal(
    getEffectiveListingStatus({ status: 'published', quantity_available: 3, pickup_end_at: future }, now),
    'published',
  );
  assert.equal(
    getEffectiveListingStatus({ status: 'published', quantity_available: 0, pickup_end_at: future }, now),
    'sold_out',
  );
  assert.equal(
    getEffectiveListingStatus({ status: 'published', quantity_available: 4, pickup_end_at: past }, now),
    'expired',
  );
});

test('canAddToCart enforces stock limits and pickup deadlines', () => {
  const now = Date.parse('2026-11-25T15:00:00.000Z');
  const listing = {
    status: 'published' as const,
    quantity_available: 3,
    pickup_end_at: '2026-11-25T20:00:00.000Z',
  };
  assert.equal(canAddToCart(listing, 1, 2, now).ok, true);
  assert.equal(canAddToCart(listing, 2, 2, now).ok, false);
  assert.equal(canAddToCart({ ...listing, quantity_available: 0 }, 0, 1, now).ok, false);
});

test('calculateCartTotals computes subtotal and savings accurately', () => {
  const totals = calculateCartTotals(
    [
      { listingId: 'l1', quantity: 2 },
      { listingId: 'l2', quantity: 1 },
    ],
    {
      l1: { id: 'l1', original_price: 8, discounted_price: 4 },
      l2: { id: 'l2', original_price: 15, discounted_price: 8 },
    },
  );
  assert.equal(totals.subtotal, 16);
  assert.equal(totals.originalTotal, 31);
  assert.equal(totals.savings, 15);
  assert.equal(totals.totalQuantity, 3);
});

test('canTransitionOrderStatus prevents duplicate pickup and unauthorized transitions', () => {
  assert.equal(canTransitionOrderStatus('pending', 'confirmed', 'vendor'), true);
  assert.equal(canTransitionOrderStatus('pending', 'cancelled', 'student'), true);
  assert.equal(canTransitionOrderStatus('ready_for_pickup', 'cancelled', 'student'), false);
  assert.equal(canTransitionOrderStatus('picked_up', 'picked_up', 'vendor'), false);
  assert.equal(canTransitionOrderStatus('picked_up', 'cancelled', 'vendor'), false);
});

test('calculateEnvironmentalImpact counts only completed picked_up orders with configurable weights', () => {
  const impact = calculateEnvironmentalImpact(
    [
      { order_status: 'picked_up', items: [{ quantity: 2 }, { quantity: 1 }] },
      { order_status: 'pending', items: [{ quantity: 5 }] },
      { order_status: 'cancelled', items: [{ quantity: 3 }] },
    ],
    { estimated_kg_per_meal: 0.5, estimated_co2_per_kg: 2.5 },
  );
  assert.equal(impact.completedPickupsCount, 1);
  assert.equal(impact.totalMealsRescued, 3);
  assert.equal(impact.estimatedFoodSavedKg, 1.5);
  assert.equal(impact.estimatedCo2AvoidedKg, 3.75);
});
