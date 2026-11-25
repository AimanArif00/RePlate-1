import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Leaf,
  Minus,
  Plus,
  ShoppingBag,
  Star,
  Trash2,
  User,
  Utensils,
} from 'lucide-react';
import { RoleShell, type RoleNavItem } from '../components/layout/RoleShell';
import { FoodCard } from '../components/food/FoodCard';
import { OrderStatusBadge } from '../components/orders/OrderStatusBadge';
import { QrCodeDisplay } from '../components/orders/QrCodeDisplay';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import {
  calculateCartTotals,
  canTransitionOrderStatus,
  formatDateTime,
  formatPickupWindow,
  formatRM,
} from '../lib/replateRules';
import { replateService, type MarketplacePayload } from '../services/replateService';
import type {
  CartItem,
  EnrichedFoodListing,
  EnrichedOrder,
  ImpactSummary,
  Profile,
} from '../types/replate';

interface StudentPagesProps {
  currentPath: string;
  user: Profile;
  marketplace: MarketplacePayload;
  cart: CartItem[];
  onNavigate: (path: string) => void;
  onLogout: () => void;
  onAddToCart: (listing: EnrichedFoodListing, qty?: number) => void;
  onUpdateCartQty: (listingId: string, qty: number) => void;
  onRemoveCartItem: (listingId: string) => void;
  onClearCart: () => void;
  onRefreshMarketplace: () => Promise<void>;
  onUserUpdated: (user: Profile) => void;
  notify: (type: 'success' | 'error', message: string) => void;
}

export function StudentPages({
  currentPath,
  user,
  marketplace,
  cart,
  onNavigate,
  onLogout,
  onAddToCart,
  onUpdateCartQty,
  onRemoveCartItem,
  onClearCart,
  onRefreshMarketplace,
  onUserUpdated,
  notify,
}: StudentPagesProps) {
  const [orders, setOrders] = useState<EnrichedOrder[]>([]);
  const [impact, setImpact] = useState<ImpactSummary | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [confirmedOrders, setConfirmedOrders] = useState<EnrichedOrder[]>([]);
  const [cancelTarget, setCancelTarget] = useState<EnrichedOrder | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Profile form state
  const [fullName, setFullName] = useState(user.full_name);
  const [studentId, setStudentId] = useState(user.student_id ?? '');
  const [phone, setPhone] = useState(user.phone_number);
  const [campusId, setCampusId] = useState(user.campus_id ?? marketplace.campuses[0]?.id ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const loadStudentOrders = async () => {
    setLoadingOrders(true);
    try {
      const data = await replateService.fetchStudentOrders();
      setOrders(data.orders);
      setImpact(data.impact);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to load your orders.');
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    loadStudentOrders();
  }, []);

  useEffect(() => {
    setFullName(user.full_name);
    setStudentId(user.student_id ?? '');
    setPhone(user.phone_number);
    setCampusId(user.campus_id ?? marketplace.campuses[0]?.id ?? '');
  }, [user, marketplace.campuses]);

  const listingsMap = useMemo(() => {
    const map: Record<string, EnrichedFoodListing> = {};
    for (const l of marketplace.listings) {
      map[l.id] = l;
    }
    return map;
  }, [marketplace.listings]);

  const cartTotals = useMemo(
    () => calculateCartTotals(cart, listingsMap),
    [cart, listingsMap],
  );

  const activeOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.order_status === 'pending' ||
          o.order_status === 'confirmed' ||
          o.order_status === 'ready_for_pickup',
      ),
    [orders],
  );

  const availableListings = useMemo(
    () =>
      marketplace.listings.filter(
        (l) => l.effective_status === 'published' && l.quantity_available > 0,
      ),
    [marketplace.listings],
  );

  const navItems: RoleNavItem[] = [
    { label: 'Dashboard', path: '/student', icon: <Utensils className="h-4 w-4" /> },
    {
      label: 'Shopping Cart',
      path: '/student/cart',
      icon: <ShoppingBag className="h-4 w-4" />,
      badge: cartTotals.totalQuantity,
    },
    {
      label: 'My Orders',
      path: '/student/orders',
      icon: <ClipboardList className="h-4 w-4" />,
      badge: activeOrders.length,
    },
    { label: 'My Profile', path: '/student/profile', icon: <User className="h-4 w-4" /> },
  ];

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setPlacingOrder(true);
    try {
      const payload = cart.map((c) => ({
        food_listing_id: c.listingId,
        quantity: c.quantity,
      }));
      const res = await replateService.placeOrder(payload);
      setConfirmedOrders(res.orders);
      onClearCart();
      await Promise.all([loadStudentOrders(), onRefreshMarketplace()]);
      notify('success', 'Order placed! Show your pickup code at the cafeteria counter.');
      onNavigate('/student/confirmation');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to place order.');
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await replateService.cancelOrder(cancelTarget.id);
      setCancelTarget(null);
      await Promise.all([loadStudentOrders(), onRefreshMarketplace()]);
      notify('success', 'Order cancelled and stock restored.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to cancel order.');
    } finally {
      setCancelling(false);
    }
  };

  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!reviewOrderId) return;
    setSubmittingReview(true);
    try {
      await replateService.submitReview(reviewOrderId, reviewRating, reviewComment);
      setReviewOrderId(null);
      setReviewComment('');
      setReviewRating(5);
      await loadStudentOrders();
      notify('success', 'Thank you for rating this campus vendor.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await replateService.updateProfile({
        full_name: fullName.trim(),
        student_id: studentId.trim(),
        phone_number: phone.trim(),
        campus_id: campusId,
      });
      onUserUpdated(res.user);
      notify('success', 'Student profile updated.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async (e: FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    try {
      await replateService.updatePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      notify('success', 'Password changed successfully.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const orderDetailMatch = /^\/student\/orders\/([^/]+)$/.exec(currentPath);
  const selectedOrder = orderDetailMatch
    ? orders.find((o) => o.id === orderDetailMatch[1]) ?? null
    : null;

  const breadcrumb =
    currentPath === '/student/cart'
      ? 'Student / Shopping Cart'
      : currentPath === '/student/checkout'
        ? 'Student / Checkout'
        : currentPath === '/student/confirmation'
          ? 'Student / Order Confirmation'
          : currentPath === '/student/orders'
            ? 'Student / My Orders'
            : orderDetailMatch
              ? `Student / Order ${selectedOrder?.order_number ?? 'Details'}`
              : currentPath === '/student/profile'
                ? 'Student / My Profile'
                : 'Student / Dashboard';

  return (
    <RoleShell
      roleLabel="Student Portal"
      breadcrumb={breadcrumb}
      user={user}
      currentPath={currentPath}
      navItems={navItems}
      cartCount={cartTotals.totalQuantity}
      onNavigate={onNavigate}
      onLogout={onLogout}
    >
      {/* 1. STUDENT DASHBOARD */}
      {currentPath === '/student' && (
        <div className="space-y-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-bold text-[#1F2937]">
                Welcome back, {user.full_name}
              </h1>
              <p className="mt-1 text-sm text-[#4B5563]">
                Student ID: <span className="font-mono font-medium">{user.student_id || '—'}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/browse')}
              className="rounded-lg bg-[#166534] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] whitespace-nowrap self-start"
            >
              Browse Surplus Meals
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-5">
              <p className="text-xs font-medium text-gray-500">Active Orders</p>
              <p className="mt-1.5 text-2xl font-bold text-[#1F2937] tabular-nums">
                {activeOrders.length}
              </p>
            </div>
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-5">
              <p className="text-xs font-medium text-gray-500">Meals Rescued (Picked Up)</p>
              <p className="mt-1.5 text-2xl font-bold text-[#166534] tabular-nums">
                {impact?.totalMealsRescued ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-5">
              <p className="text-xs font-medium text-gray-500">Est. Food Saved</p>
              <p className="mt-1.5 text-2xl font-bold text-[#1F2937] tabular-nums">
                {(impact?.estimatedFoodSavedKg ?? 0).toFixed(2)} kg
              </p>
            </div>
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-5">
              <p className="text-xs font-medium text-gray-500">Est. CO₂e Avoided</p>
              <p className="mt-1.5 text-2xl font-bold text-[#1F2937] tabular-nums">
                {(impact?.estimatedCo2AvoidedKg ?? 0).toFixed(2)} kg
              </p>
            </div>
          </div>

          <p className="flex items-center gap-2 text-xs text-gray-500">
            <Leaf className="h-3.5 w-3.5 text-[#166534]" />
            Environmental impact figures are estimates based on completed pickups (assumed{' '}
            {impact?.assumedKgPerMeal.toFixed(2) ?? '0.45'} kg food and{' '}
            {impact?.assumedCo2PerKg.toFixed(2) ?? '2.50'} kg CO₂e/kg).
          </p>

          {/* Active Orders Section */}
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1F2937]">Active Pickup Passes</h2>
              <button
                type="button"
                onClick={() => onNavigate('/student/orders')}
                className="text-sm font-semibold text-[#166534] hover:underline"
              >
                View all orders
              </button>
            </div>
            {loadingOrders ? (
              <div className="mt-4 h-32 animate-pulse rounded-xl border border-[#E5EBE3] bg-white" />
            ) : activeOrders.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No active pickup orders"
                  description="Add discounted campus meals to your cart and place a Pay-at-Pickup order."
                  actionLabel="Explore Available Food"
                  onAction={() => onNavigate('/browse')}
                />
              </div>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {activeOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-[#E5EBE3] bg-white p-5"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-gray-500">{order.order_number}</p>
                      <h3 className="mt-1 truncate text-base font-semibold text-[#1F2937]">
                        {order.vendor_name}
                      </h3>
                      <p className="mt-1 text-xs text-gray-600">{order.vendor_location}</p>
                      <div className="mt-2.5 flex items-center gap-3">
                        <OrderStatusBadge status={order.order_status} />
                        <span className="text-sm font-bold text-[#166534] tabular-nums">
                          {formatRM(order.total_amount)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate(`/student/orders/${order.id}`)}
                        className="mt-3 text-xs font-semibold text-[#166534] hover:underline"
                      >
                        Open Pickup QR & Details
                      </button>
                    </div>
                    {order.pickup_code && (
                      <div className="shrink-0 rounded-lg border border-[#E5EBE3] bg-[#F8FAF7] px-3.5 py-2.5 text-center">
                        <p className="text-[11px] font-medium text-gray-500">Code</p>
                        <p className="font-mono text-lg font-bold tracking-wider text-[#166534]">
                          {order.pickup_code}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Available Meals Quick Grid */}
          <section>
            <h2 className="text-lg font-bold text-[#1F2937]">Available Right Now</h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {availableListings.slice(0, 3).map((listing) => (
                <FoodCard
                  key={listing.id}
                  listing={listing}
                  onViewDetails={(id) => onNavigate(`/food/${id}`)}
                  onAddToCart={(item) => onAddToCart(item, 1)}
                />
              ))}
            </div>
          </section>
        </div>
      )}

      {/* 2. SHOPPING CART & CHECKOUT */}
      {(currentPath === '/student/cart' || currentPath === '/student/checkout') && (
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-[#1F2937]">
              {currentPath === '/student/checkout' ? 'Checkout — Pay at Pickup' : 'Shopping Cart'}
            </h1>
            <button
              type="button"
              onClick={() => onNavigate('/browse')}
              className="text-sm font-semibold text-[#166534] hover:underline"
            >
              Continue browsing
            </button>
          </div>

          {cart.length === 0 ? (
            <EmptyState
              title="Your cart is empty"
              description="Browse discounted meals from campus cafeterias and add items to your cart."
              actionLabel="Browse Food"
              onAction={() => onNavigate('/browse')}
              icon={<ShoppingBag className="h-5 w-5" />}
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="space-y-3 lg:col-span-7">
                {cart.map((item) => {
                  const listing = listingsMap[item.listingId];
                  if (!listing) return null;
                  return (
                    <div
                      key={item.listingId}
                      className="flex items-center justify-between gap-4 rounded-xl border border-[#E5EBE3] bg-white p-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={listing.image_url}
                          alt={listing.food_name}
                          referrerPolicy="no-referrer"
                          className="h-16 w-16 shrink-0 rounded-lg object-cover bg-[#EEF3EC]"
                        />
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-[#1F2937]">
                            {listing.food_name}
                          </h3>
                          <p className="truncate text-xs text-gray-500">
                            {listing.vendor_name} · {listing.quantity_available} in stock
                          </p>
                          <p className="mt-1 text-sm font-bold text-[#166534] tabular-nums">
                            {formatRM(listing.discounted_price)} each
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center rounded-lg border border-gray-300">
                          <button
                            type="button"
                            aria-label={`Decrease quantity for ${listing.food_name}`}
                            onClick={() =>
                              item.quantity <= 1
                                ? onRemoveCartItem(item.listingId)
                                : onUpdateCartQty(item.listingId, item.quantity - 1)
                            }
                            className="p-1.5 text-gray-700 hover:bg-gray-50"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-semibold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={`Increase quantity for ${listing.food_name}`}
                            disabled={item.quantity >= listing.quantity_available}
                            onClick={() => onUpdateCartQty(item.listingId, item.quantity + 1)}
                            className="p-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          aria-label={`Remove ${listing.food_name}`}
                          onClick={() => onRemoveCartItem(item.listingId)}
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="lg:col-span-5">
                <div className="rounded-xl border border-[#E5EBE3] bg-white p-5">
                  <h2 className="text-base font-bold text-[#1F2937]">Order Summary</h2>
                  <dl className="mt-4 space-y-2 text-sm border-b border-[#F0F4EE] pb-4">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Student Name</dt>
                      <dd className="font-medium text-[#1F2937]">{user.full_name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Student ID</dt>
                      <dd className="font-mono text-xs font-medium text-[#1F2937]">
                        {user.student_id || '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Payment Method</dt>
                      <dd className="font-medium text-[#1F2937]">Pay at Pickup</dd>
                    </div>
                  </dl>

                  <dl className="mt-4 space-y-2 text-sm tabular-nums">
                    <div className="flex justify-between text-gray-500">
                      <dt>Original Value</dt>
                      <dd className="line-through">{formatRM(cartTotals.originalTotal)}</dd>
                    </div>
                    <div className="flex justify-between text-[#166534]">
                      <dt>You Save</dt>
                      <dd className="font-semibold">-{formatRM(cartTotals.savings)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-[#F0F4EE] pt-2 text-base font-bold text-[#1F2937]">
                      <dt>Total Due at Pickup</dt>
                      <dd className="text-[#166534]">{formatRM(cartTotals.subtotal)}</dd>
                    </div>
                  </dl>

                  {currentPath === '/student/cart' ? (
                    <button
                      type="button"
                      onClick={() => onNavigate('/student/checkout')}
                      className="mt-5 w-full rounded-lg bg-[#166534] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] transition-colors"
                    >
                      Proceed to Checkout
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={placingOrder}
                      onClick={handleCheckout}
                      className="mt-5 w-full rounded-lg bg-[#166534] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] disabled:opacity-50 transition-colors"
                    >
                      {placingOrder ? 'Confirming Order...' : 'Confirm Pay-at-Pickup Order'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. ORDER CONFIRMATION */}
      {currentPath === '/student/confirmation' && (
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="rounded-xl border border-[#166534]/25 bg-white p-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-7 w-7 text-[#166534]" />
              <div>
                <h1 className="text-xl font-bold text-[#1F2937]">Order Confirmed</h1>
                <p className="text-sm text-[#4B5563]">
                  Present your pickup code or QR code at the cafeteria counter during the pickup
                  window.
                </p>
              </div>
            </div>
          </div>

          {(confirmedOrders.length > 0 ? confirmedOrders : activeOrders.slice(0, 1)).map(
            (order) => (
              <div
                key={order.id}
                className="grid gap-6 rounded-xl border border-[#E5EBE3] bg-white p-6 md:grid-cols-12"
              >
                <div className="space-y-3 md:col-span-7">
                  <p className="font-mono text-xs text-gray-500">{order.order_number}</p>
                  <h2 className="text-lg font-bold text-[#1F2937]">{order.vendor_name}</h2>
                  <p className="text-sm text-gray-600">{order.vendor_location}</p>
                  <p className="text-xs text-gray-500">
                    Collect before: {formatDateTime(order.pickup_deadline)}
                  </p>
                  <ul className="space-y-1 border-t border-[#F0F4EE] pt-3 text-sm">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex justify-between tabular-nums">
                        <span>
                          {item.quantity} × {item.food_name_snapshot}
                        </span>
                        <span className="font-medium">{formatRM(item.subtotal)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-between border-t border-[#F0F4EE] pt-2 text-base font-bold tabular-nums">
                    <span>Total (Pay at Pickup)</span>
                    <span className="text-[#166534]">{formatRM(order.total_amount)}</span>
                  </div>
                </div>
                <div className="md:col-span-5">
                  {order.pickup_code && (
                    <QrCodeDisplay
                      orderNumber={order.order_number}
                      pickupCode={order.pickup_code}
                    />
                  )}
                </div>
              </div>
            ),
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/student/orders')}
              className="rounded-lg bg-[#166534] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D]"
            >
              View My Orders
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/browse')}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Browse More Food
            </button>
          </div>
        </div>
      )}

      {/* 4. MY ORDERS */}
      {currentPath === '/student/orders' && (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-[#1F2937]">My Orders</h1>

          {loadingOrders ? (
            <div className="h-48 animate-pulse rounded-xl border border-[#E5EBE3] bg-white" />
          ) : orders.length === 0 ? (
            <EmptyState
              title="No orders placed yet"
              description="When you reserve discounted food from campus cafeterias, your orders and pickup codes will appear here."
              actionLabel="Browse Food"
              onAction={() => onNavigate('/browse')}
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#E5EBE3] bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#E5EBE3] bg-[#F8FAF7] text-xs font-semibold text-gray-600">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Pickup Code</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F4EE]">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-[#F8FAF7]/70">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-[#1F2937] whitespace-nowrap">
                          {order.order_number}
                        </p>
                        <p className="text-xs text-gray-500">{formatDateTime(order.created_at)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#1F2937]">{order.vendor_name}</p>
                        <p className="text-xs text-gray-500">{order.vendor_location}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        {order.items.map((i) => `${i.quantity}× ${i.food_name_snapshot}`).join(', ')}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#166534] tabular-nums">
                        {formatRM(order.total_amount)}
                      </td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={order.order_status} />
                      </td>
                      <td className="px-4 py-3 font-mono text-sm font-bold text-[#166534]">
                        {order.pickup_code || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onNavigate(`/student/orders/${order.id}`)}
                          className="text-xs font-semibold text-[#166534] hover:underline whitespace-nowrap"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. ORDER DETAILS */}
      {orderDetailMatch && (
        <div className="mx-auto max-w-4xl space-y-6">
          <button
            type="button"
            onClick={() => onNavigate('/student/orders')}
            className="text-sm font-medium text-[#166534] hover:underline"
          >
            ← Back to My Orders
          </button>

          {!selectedOrder ? (
            <EmptyState
              title="Order not found"
              description="We could not find this order in your account."
              actionLabel="Back to My Orders"
              onAction={() => onNavigate('/student/orders')}
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-12">
              <div className="space-y-5 rounded-xl border border-[#E5EBE3] bg-white p-6 md:col-span-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs text-gray-500">{selectedOrder.order_number}</p>
                    <h1 className="mt-1 text-xl font-bold text-[#1F2937]">
                      {selectedOrder.vendor_name}
                    </h1>
                    <p className="text-sm text-gray-600">{selectedOrder.vendor_location}</p>
                  </div>
                  <OrderStatusBadge status={selectedOrder.order_status} />
                </div>

                <dl className="grid gap-2 border-y border-[#F0F4EE] py-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Order Placed</dt>
                    <dd className="tabular-nums">{formatDateTime(selectedOrder.created_at)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Pickup Deadline</dt>
                    <dd className="font-medium tabular-nums">
                      {formatDateTime(selectedOrder.pickup_deadline)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Payment</dt>
                    <dd>
                      Pay at Pickup ({selectedOrder.payment_status})
                    </dd>
                  </div>
                </dl>

                <ul className="space-y-2 text-sm">
                  {selectedOrder.items.map((item) => (
                    <li key={item.id} className="flex justify-between tabular-nums">
                      <span>
                        {item.quantity} × {item.food_name_snapshot}
                      </span>
                      <span className="font-medium">{formatRM(item.subtotal)}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex justify-between border-t border-[#F0F4EE] pt-3 text-base font-bold tabular-nums">
                  <span>Total Amount</span>
                  <span className="text-[#166534]">{formatRM(selectedOrder.total_amount)}</span>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  {canTransitionOrderStatus(selectedOrder.order_status, 'cancelled', 'student') && (
                    <button
                      type="button"
                      onClick={() => setCancelTarget(selectedOrder)}
                      className="rounded-lg border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Cancel Order
                    </button>
                  )}

                  {selectedOrder.order_status === 'picked_up' && !selectedOrder.review && (
                    <button
                      type="button"
                      onClick={() => setReviewOrderId(selectedOrder.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#166534] px-4 py-2 text-xs font-semibold text-white hover:bg-[#14532D]"
                    >
                      <Star className="h-3.5 w-3.5" />
                      Leave Vendor Review
                    </button>
                  )}
                </div>

                {reviewOrderId === selectedOrder.id && (
                  <form
                    onSubmit={handleSubmitReview}
                    className="space-y-3 rounded-lg border border-[#E5EBE3] bg-[#F8FAF7] p-4"
                  >
                    <h3 className="text-sm font-semibold text-[#1F2937]">Rate your pickup</h3>
                    <div>
                      <label htmlFor="rev-rating" className="block text-xs font-medium text-gray-600">
                        Rating
                      </label>
                      <select
                        id="rev-rating"
                        value={reviewRating}
                        onChange={(e) => setReviewRating(Number(e.target.value))}
                        className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
                      >
                        <option value={5}>5 — Excellent</option>
                        <option value={4}>4 — Good</option>
                        <option value={3}>3 — Fair</option>
                        <option value={2}>2 — Poor</option>
                        <option value={1}>1 — Very Poor</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="rev-comment" className="block text-xs font-medium text-gray-600">
                        Comment
                      </label>
                      <textarea
                        id="rev-comment"
                        rows={2}
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Share feedback on food quality and pickup speed..."
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={submittingReview}
                        className="rounded-lg bg-[#166534] px-3.5 py-1.5 text-xs font-semibold text-white"
                      >
                        {submittingReview ? 'Submitting...' : 'Submit Review'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setReviewOrderId(null)}
                        className="rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {selectedOrder.review && (
                  <div className="rounded-lg border border-[#E5EBE3] bg-[#F8FAF7] p-4">
                    <p className="text-xs font-semibold text-[#166534]">
                      Your Review · {selectedOrder.review.rating}/5
                    </p>
                    <p className="mt-1 text-sm text-[#1F2937]">{selectedOrder.review.comment}</p>
                  </div>
                )}
              </div>

              <div className="md:col-span-5">
                {selectedOrder.pickup_code ? (
                  <QrCodeDisplay
                    orderNumber={selectedOrder.order_number}
                    pickupCode={selectedOrder.pickup_code}
                  />
                ) : (
                  <div className="rounded-xl border border-[#E5EBE3] bg-white p-6 text-center text-sm text-gray-600">
                    {selectedOrder.order_status === 'picked_up'
                      ? `Collected on ${formatDateTime(
                          selectedOrder.verification?.verified_at ?? selectedOrder.updated_at,
                        )}. Pickup code is no longer active.`
                      : 'Pickup code is no longer active for this order.'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. MY PROFILE */}
      {currentPath === '/student/profile' && (
        <div className="mx-auto max-w-3xl space-y-6">
          <h1 className="text-2xl font-bold text-[#1F2937]">My Student Profile</h1>

          <form
            onSubmit={handleSaveProfile}
            className="space-y-4 rounded-xl border border-[#E5EBE3] bg-white p-6"
          >
            <h2 className="text-base font-bold text-[#1F2937]">Personal Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="prof-name" className="block text-sm font-medium text-[#1F2937]">
                  Full Name
                </label>
                <input
                  id="prof-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="prof-sid" className="block text-sm font-medium text-[#1F2937]">
                  Student ID
                </label>
                <input
                  id="prof-sid"
                  type="text"
                  required
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="prof-phone" className="block text-sm font-medium text-[#1F2937]">
                  Phone Number
                </label>
                <input
                  id="prof-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="prof-campus" className="block text-sm font-medium text-[#1F2937]">
                  Campus
                </label>
                <select
                  id="prof-campus"
                  value={campusId}
                  onChange={(e) => setCampusId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  {marketplace.campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.campus_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-lg bg-[#166534] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14532D] disabled:opacity-50"
            >
              {savingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </form>

          <form
            onSubmit={handleSavePassword}
            className="space-y-4 rounded-xl border border-[#E5EBE3] bg-white p-6"
          >
            <h2 className="text-base font-bold text-[#1F2937]">Change Password</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="curr-pass" className="block text-sm font-medium text-[#1F2937]">
                  Current Password
                </label>
                <input
                  id="curr-pass"
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="new-pass" className="block text-sm font-medium text-[#1F2937]">
                  New Password (8+ chars)
                </label>
                <input
                  id="new-pass"
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingPassword}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-[#1F2937] hover:bg-gray-50 disabled:opacity-50"
            >
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel this order?"
        description={
          cancelTarget
            ? `Order ${cancelTarget.order_number} will be cancelled and its reserved portions will return to campus stock.`
            : ''
        }
        confirmLabel="Cancel Order"
        confirmTone="danger"
        loading={cancelling}
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </RoleShell>
  );
}
