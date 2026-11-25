import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Edit3,
  LayoutDashboard,
  Plus,
  QrCode,
  Store,
  Trash2,
  Upload,
  Utensils,
} from 'lucide-react';
import { RoleShell, type RoleNavItem } from '../components/layout/RoleShell';
import { OrderStatusBadge } from '../components/orders/OrderStatusBadge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import {
  calculateDiscountPercent,
  formatDateTime,
  formatPickupWindow,
  formatRM,
  getListingStatusLabel,
  validateListingInput,
} from '../lib/replateRules';
import { replateService } from '../services/replateService';
import type {
  EnrichedFoodListing,
  EnrichedOrder,
  FoodCategory,
  ImpactSummary,
  ListingStatus,
  OrderStatus,
  Profile,
  Vendor,
} from '../types/replate';

interface VendorPagesProps {
  currentPath: string;
  user: Profile;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  onRefreshMarketplace: () => Promise<void>;
  notify: (type: 'success' | 'error', message: string) => void;
}

const SAMPLE_FOOD_IMAGES = [
  { label: 'Kampung Fried Rice', url: '/src/assets/images/food_fried_rice_1795588200940.jpg' },
  { label: 'Chicken Chop', url: '/src/assets/images/food_chicken_chop_1795588201849.jpg' },
  { label: 'Nasi Lemak', url: '/src/assets/images/food_nasi_lemak_1795588200390.jpg' },
  { label: 'Club Sandwich', url: '/src/assets/images/food_club_sandwich_1795588201633.jpg' },
  { label: 'Curry Puff Set', url: '/src/assets/images/food_curry_puff_1795588204455.jpg' },
  { label: 'Cafeteria Rescue Box', url: '/src/assets/images/hero_campus_cafeteria_1795588201868.jpg' },
];

function toLocalDateTimeInput(iso?: string, offsetHours = 0): string {
  const date = iso ? new Date(iso) : new Date(Date.now() + offsetHours * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function VendorPages({
  currentPath,
  user,
  onNavigate,
  onLogout,
  onRefreshMarketplace,
  notify,
}: VendorPagesProps) {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [listings, setListings] = useState<EnrichedFoodListing[]>([]);
  const [orders, setOrders] = useState<EnrichedOrder[]>([]);
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [impact, setImpact] = useState<ImpactSummary | null>(null);
  const [stats, setStats] = useState({
    activeListings: 0,
    soldOutListings: 0,
    totalOrders: 0,
    pendingOrders: 0,
    readyOrders: 0,
    completedPickups: 0,
    mealsRescued: 0,
    totalSales: 0,
    availableUnits: 0,
  });
  const [loading, setLoading] = useState(true);

  const [listingTab, setListingTab] = useState<'all' | 'published' | 'sold_out' | 'expired' | 'draft'>('all');
  const [deleteTarget, setDeleteTarget] = useState<EnrichedFoodListing | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Add/Edit Food Form
  const [foodName, setFoodName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [imageUrl, setImageUrl] = useState(SAMPLE_FOOD_IMAGES[0].url);
  const [originalPrice, setOriginalPrice] = useState('10.00');
  const [discountedPrice, setDiscountedPrice] = useState('5.00');
  const [quantityAvailable, setQuantityAvailable] = useState('6');
  const [pickupStart, setPickupStart] = useState(() => toLocalDateTimeInput(undefined, 0));
  const [pickupEnd, setPickupEnd] = useState(() => toLocalDateTimeInput(undefined, 3));
  const [listingStatus, setListingStatus] = useState<ListingStatus>('published');
  const [savingFood, setSavingFood] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [aiAssisting, setAiAssisting] = useState(false);

  // Pickup Verification
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyOrderNumber, setVerifyOrderNumber] = useState('');
  const [verifyMethod, setVerifyMethod] = useState<'code' | 'qr'>('code');
  const [verifiedPreviewOrder, setVerifiedPreviewOrder] = useState<EnrichedOrder | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Vendor Profile
  const [bizName, setBizName] = useState('');
  const [bizDesc, setBizDesc] = useState('');
  const [bizLoc, setBizLoc] = useState('');
  const [bizPhone, setBizPhone] = useState('');
  const [savingBiz, setSavingBiz] = useState(false);

  const editMatch = /^\/vendor\/listings\/([^/]+)\/edit$/.exec(currentPath);
  const editingId = editMatch?.[1] ?? null;

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await replateService.fetchVendorDashboard();
      setVendor(data.vendor);
      setListings(data.listings);
      setOrders(data.orders);
      setCategories(data.categories);
      setStats(data.stats);
      setImpact(data.impact);
      setBizName(data.vendor.business_name);
      setBizDesc(data.vendor.description);
      setBizLoc(data.vendor.location);
      setBizPhone(data.vendor.contact_phone);
      if (!categoryId && data.categories[0]) {
        setCategoryId(data.categories[0].id);
      }
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to load vendor console.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (editingId) {
      const target = listings.find((l) => l.id === editingId);
      if (target) {
        setFoodName(target.food_name);
        setDescription(target.description);
        setCategoryId(target.category_id);
        setImageUrl(target.image_url);
        setOriginalPrice(target.original_price.toFixed(2));
        setDiscountedPrice(target.discounted_price.toFixed(2));
        setQuantityAvailable(String(target.quantity_available));
        setPickupStart(toLocalDateTimeInput(target.pickup_start_at));
        setPickupEnd(toLocalDateTimeInput(target.pickup_end_at));
        setListingStatus(target.status === 'draft' ? 'draft' : 'published');
      }
    } else if (currentPath === '/vendor/listings/new') {
      setFoodName('');
      setDescription('');
      setOriginalPrice('10.00');
      setDiscountedPrice('5.00');
      setQuantityAvailable('6');
      setPickupStart(toLocalDateTimeInput(undefined, 0));
      setPickupEnd(toLocalDateTimeInput(undefined, 3));
      setListingStatus('published');
    }
  }, [editingId, currentPath, listings]);

  const navItems: RoleNavItem[] = [
    { label: 'Dashboard', path: '/vendor', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Food Listings', path: '/vendor/listings', icon: <Utensils className="h-4 w-4" /> },
    {
      label: 'Incoming Orders',
      path: '/vendor/orders',
      icon: <ClipboardList className="h-4 w-4" />,
      badge: stats.pendingOrders,
    },
    { label: 'Pickup Verify', path: '/vendor/verify', icon: <QrCode className="h-4 w-4" /> },
    { label: 'Sales Reports', path: '/vendor/reports', icon: <BarChart3 className="h-4 w-4" /> },
    { label: 'Vendor Profile', path: '/vendor/profile', icon: <Store className="h-4 w-4" /> },
  ];

  const liveDiscountPct = calculateDiscountPercent(Number(originalPrice), Number(discountedPrice));

  const filteredListings = useMemo(() => {
    if (listingTab === 'all') return listings;
    return listings.filter((l) => l.effective_status === listingTab);
  }, [listings, listingTab]);

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      notify('error', 'Please upload a JPEG, PNG, or WebP food image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify('error', 'Image size must be 5MB or smaller.');
      return;
    }
    setUploadingImage(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.readAsDataURL(file);
      });
      const res = await replateService.uploadFoodImage(dataUrl, file.name);
      setImageUrl(res.url);
      notify('success', 'Food image uploaded.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAiSuggest = async () => {
    if (!foodName.trim()) {
      notify('error', 'Enter a food name first.');
      return;
    }
    setAiAssisting(true);
    try {
      const suggestion = await replateService.suggestListingWithAi(foodName, description);
      if (suggestion.description) setDescription(suggestion.description);
      if (suggestion.suggestedOriginalPriceRM) {
        setOriginalPrice(Number(suggestion.suggestedOriginalPriceRM).toFixed(2));
      }
      if (suggestion.suggestedDiscountedPriceRM) {
        setDiscountedPrice(Number(suggestion.suggestedDiscountedPriceRM).toFixed(2));
      }
      notify('success', 'Listing details suggested with Gemini.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'AI suggestion unavailable.');
    } finally {
      setAiAssisting(false);
    }
  };

  const handleSaveFood = async (e: FormEvent) => {
    e.preventDefault();
    const input = {
      food_name: foodName.trim(),
      description: description.trim(),
      category_id: categoryId || categories[0]?.id || '',
      original_price: Number(originalPrice),
      discounted_price: Number(discountedPrice),
      quantity_available: Number(quantityAvailable),
      pickup_start_at: new Date(pickupStart).toISOString(),
      pickup_end_at: new Date(pickupEnd).toISOString(),
    };

    const errMsg = validateListingInput(input);
    if (errMsg) {
      notify('error', errMsg);
      return;
    }

    setSavingFood(true);
    try {
      if (editingId) {
        await replateService.updateVendorListing(editingId, {
          ...input,
          image_url: imageUrl,
          status: listingStatus,
        });
        notify('success', 'Food listing updated.');
      } else {
        await replateService.createVendorListing({
          ...input,
          image_url: imageUrl,
          status: listingStatus,
        });
        notify('success', 'Food listing published to campus marketplace.');
      }
      await Promise.all([loadDashboard(), onRefreshMarketplace()]);
      onNavigate('/vendor/listings');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to save food listing.');
    } finally {
      setSavingFood(false);
    }
  };

  const handleDeleteListing = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await replateService.deleteVendorListing(deleteTarget.id);
      setDeleteTarget(null);
      await Promise.all([loadDashboard(), onRefreshMarketplace()]);
      notify('success', 'Food listing removed.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to remove listing.');
    } finally {
      setDeleting(false);
    }
  };

  const handleOrderStatusChange = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      await replateService.updateVendorOrderStatus(orderId, nextStatus);
      await loadDashboard();
      notify('success', `Order updated to ${nextStatus.replace('_', ' ')}.`);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to update order status.');
    }
  };

  const handleLookupPickupCode = async (e: FormEvent) => {
    e.preventDefault();
    setVerifyLoading(true);
    setVerifiedPreviewOrder(null);
    try {
      const res = await replateService.verifyPickupCode({
        pickup_code: verifyCode.trim(),
        order_number: verifyOrderNumber.trim() || undefined,
        method: verifyMethod,
        confirm: false,
      });
      setVerifiedPreviewOrder(res.order);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Verification lookup failed.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleConfirmCollection = async () => {
    if (!verifiedPreviewOrder) return;
    setVerifyLoading(true);
    try {
      await replateService.verifyPickupCode({
        pickup_code: verifyCode.trim(),
        order_number: verifiedPreviewOrder.order_number,
        method: verifyMethod,
        confirm: true,
      });
      setVerifiedPreviewOrder(null);
      setVerifyCode('');
      setVerifyOrderNumber('');
      await Promise.all([loadDashboard(), onRefreshMarketplace()]);
      notify('success', 'Food collection confirmed! Order marked as Picked Up.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to confirm collection.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleSaveVendorProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSavingBiz(true);
    try {
      const res = await replateService.updateVendorProfile({
        business_name: bizName.trim(),
        description: bizDesc.trim(),
        location: bizLoc.trim(),
        contact_phone: bizPhone.trim(),
      });
      setVendor(res.vendor);
      await onRefreshMarketplace();
      notify('success', 'Vendor profile updated.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to update vendor profile.');
    } finally {
      setSavingBiz(false);
    }
  };

  const orderDetailMatch = /^\/vendor\/orders\/([^/]+)$/.exec(currentPath);
  const selectedOrder = orderDetailMatch
    ? orders.find((o) => o.id === orderDetailMatch[1]) ?? null
    : null;

  const isApproved = vendor?.approval_status === 'approved';

  return (
    <RoleShell
      roleLabel="Vendor Operations"
      breadcrumb={`Vendor / ${vendor?.business_name ?? 'Console'}`}
      user={user}
      currentPath={currentPath}
      navItems={navItems}
      onNavigate={onNavigate}
      onLogout={onLogout}
    >
      {vendor && vendor.approval_status !== 'approved' && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">
            Account Status: {vendor.approval_status.toUpperCase()}
          </p>
          <p className="mt-1">
            {vendor.approval_status === 'pending'
              ? 'Your vendor registration is awaiting administrator approval. You can review your profile, and once approved you will be able to publish food listings.'
              : 'Your vendor application was rejected. Contact campus administration for details.'}
          </p>
        </div>
      )}

      {/* 1. VENDOR DASHBOARD */}
      {currentPath === '/vendor' && (
        <div className="space-y-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-bold text-[#1F2937]">
                {vendor?.business_name ?? 'Vendor Dashboard'}
              </h1>
              <p className="mt-1 text-sm text-[#4B5563]">{vendor?.location}</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => onNavigate('/vendor/verify')}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-[#1F2937] hover:bg-gray-50 whitespace-nowrap"
              >
                <QrCode className="h-4 w-4" />
                Verify Pickup
              </button>
              <button
                type="button"
                disabled={!isApproved}
                onClick={() => onNavigate('/vendor/listings/new')}
                className="inline-flex items-center gap-2 rounded-lg bg-[#166534] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14532D] disabled:opacity-50 whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                Add Food
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-4">
              <p className="text-xs text-gray-500">Active Listings</p>
              <p className="mt-1 text-2xl font-bold text-[#1F2937] tabular-nums">
                {stats.activeListings}
              </p>
            </div>
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-4">
              <p className="text-xs text-gray-500">Available Portions</p>
              <p className="mt-1 text-2xl font-bold text-[#1F2937] tabular-nums">
                {stats.availableUnits}
              </p>
            </div>
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-4">
              <p className="text-xs text-gray-500">Pending Orders</p>
              <p className="mt-1 text-2xl font-bold text-amber-700 tabular-nums">
                {stats.pendingOrders}
              </p>
            </div>
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-4">
              <p className="text-xs text-gray-500">Completed Pickups</p>
              <p className="mt-1 text-2xl font-bold text-[#166534] tabular-nums">
                {stats.completedPickups}
              </p>
            </div>
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-4">
              <p className="text-xs text-gray-500">Meals Rescued</p>
              <p className="mt-1 text-2xl font-bold text-[#166534] tabular-nums">
                {stats.mealsRescued}
              </p>
            </div>
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-4">
              <p className="text-xs text-gray-500">Total Sales (Collected)</p>
              <p className="mt-1 text-2xl font-bold text-[#1F2937] tabular-nums">
                {formatRM(stats.totalSales)}
              </p>
            </div>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1F2937]">Recent Incoming Orders</h2>
              <button
                type="button"
                onClick={() => onNavigate('/vendor/orders')}
                className="text-sm font-semibold text-[#166534] hover:underline"
              >
                Manage all orders
              </button>
            </div>

            {loading ? (
              <div className="h-40 animate-pulse rounded-xl border border-[#E5EBE3] bg-white" />
            ) : orders.length === 0 ? (
              <EmptyState
                title="No student orders yet"
                description="Once students reserve your discounted listings, their orders will appear here."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#E5EBE3] bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#E5EBE3] bg-[#F8FAF7] text-xs font-semibold text-gray-600">
                    <tr>
                      <th className="px-4 py-3">Order #</th>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Items</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F4EE]">
                    {orders.slice(0, 6).map((order) => (
                      <tr key={order.id} className="hover:bg-[#F8FAF7]/70">
                        <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap">
                          {order.order_number}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#1F2937]">{order.student_name}</p>
                          <p className="text-xs text-gray-500">{order.student_number}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700">
                          {order.items.map((i) => `${i.quantity}× ${i.food_name_snapshot}`).join(', ')}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {formatRM(order.total_amount)}
                        </td>
                        <td className="px-4 py-3">
                          <OrderStatusBadge status={order.order_status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => onNavigate(`/vendor/orders/${order.id}`)}
                            className="text-xs font-semibold text-[#166534] hover:underline"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* 2. FOOD LISTING MANAGEMENT */}
      {currentPath === '/vendor/listings' && (
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <h1 className="text-2xl font-bold text-[#1F2937]">Food Listing Management</h1>
            <button
              type="button"
              disabled={!isApproved}
              onClick={() => onNavigate('/vendor/listings/new')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#166534] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14532D] disabled:opacity-50 whitespace-nowrap self-start"
            >
              <Plus className="h-4 w-4" />
              Add Food Listing
            </button>
          </div>

          <div className="flex flex-wrap gap-1 rounded-lg bg-[#EEF3EC] p-1 w-fit">
            {(
              [
                ['all', 'All'],
                ['published', 'Available'],
                ['sold_out', 'Sold Out'],
                ['expired', 'Expired'],
                ['draft', 'Draft'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setListingTab(key)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  listingTab === key
                    ? 'bg-white text-[#1F2937] shadow-sm'
                    : 'text-gray-600 hover:text-[#1F2937]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {filteredListings.length === 0 ? (
            <EmptyState
              title="No food listings in this view"
              description="Publish leftover food before closing hours so students can reserve affordable portions."
              actionLabel={isApproved ? 'Add Food Listing' : undefined}
              onAction={isApproved ? () => onNavigate('/vendor/listings/new') : undefined}
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#E5EBE3] bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#E5EBE3] bg-[#F8FAF7] text-xs font-semibold text-gray-600">
                  <tr>
                    <th className="px-4 py-3">Food</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Original</th>
                    <th className="px-4 py-3 text-right">Discounted</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="px-4 py-3">Pickup Window</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F4EE]">
                  {filteredListings.map((item) => (
                    <tr key={item.id} className="hover:bg-[#F8FAF7]/70">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.image_url}
                            alt={item.food_name}
                            referrerPolicy="no-referrer"
                            className="h-10 w-10 rounded object-cover bg-[#EEF3EC]"
                          />
                          <span className="font-semibold text-[#1F2937]">{item.food_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{item.category_name}</td>
                      <td className="px-4 py-3 text-right text-gray-400 line-through tabular-nums">
                        {formatRM(item.original_price)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#166534] tabular-nums">
                        {formatRM(item.discounted_price)} (-{item.discount_percentage}%)
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {item.quantity_available}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 tabular-nums">
                        {formatPickupWindow(item.pickup_start_at, item.pickup_end_at)}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-[#1F2937]">
                        {getListingStatusLabel(item.effective_status)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={`Edit ${item.food_name}`}
                            onClick={() => onNavigate(`/vendor/listings/${item.id}/edit`)}
                            className="rounded p-1.5 text-gray-600 hover:bg-gray-100 hover:text-[#166534]"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${item.food_name}`}
                            onClick={() => setDeleteTarget(item)}
                            className="rounded p-1.5 text-gray-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. ADD / EDIT FOOD FORM */}
      {(currentPath === '/vendor/listings/new' || Boolean(editingId)) && (
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-[#1F2937]">
              {editingId ? 'Edit Food Listing' : 'Add Leftover Food Listing'}
            </h1>
            <button
              type="button"
              onClick={() => onNavigate('/vendor/listings')}
              className="text-sm font-medium text-gray-600 hover:text-[#166534]"
            >
              Back to Listings
            </button>
          </div>

          <form
            onSubmit={handleSaveFood}
            className="space-y-5 rounded-xl border border-[#E5EBE3] bg-white p-6"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="food-name" className="block text-sm font-medium text-[#1F2937]">
                  Food Name
                </label>
                <input
                  id="food-name"
                  type="text"
                  required
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  placeholder="e.g. Nasi Ayam Penyet"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="food-cat" className="block text-sm font-medium text-[#1F2937]">
                  Food Category
                </label>
                <select
                  id="food-cat"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.category_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="food-desc" className="block text-sm font-medium text-[#1F2937]">
                  Description
                </label>
                <button
                  type="button"
                  disabled={aiAssisting}
                  onClick={handleAiSuggest}
                  className="text-xs font-semibold text-[#166534] hover:underline disabled:opacity-50"
                >
                  {aiAssisting ? 'Drafting...' : 'Suggest details with Gemini'}
                </button>
              </div>
              <textarea
                id="food-desc"
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe portion contents, ingredients, and packaging..."
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <label htmlFor="orig-price" className="block text-sm font-medium text-[#1F2937]">
                  Original Price (RM)
                </label>
                <input
                  id="orig-price"
                  type="number"
                  step="0.10"
                  min="0.50"
                  required
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="disc-price" className="block text-sm font-medium text-[#1F2937]">
                  Discounted Price (RM)
                </label>
                <input
                  id="disc-price"
                  type="number"
                  step="0.10"
                  min="0"
                  required
                  value={discountedPrice}
                  onChange={(e) => setDiscountedPrice(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm tabular-nums"
                />
              </div>
              <div>
                <p className="block text-sm font-medium text-[#1F2937]">Discount</p>
                <div className="mt-1 rounded-lg border border-[#E5EBE3] bg-[#F8FAF7] px-3 py-2 text-sm font-bold text-[#166534] tabular-nums">
                  {liveDiscountPct}% off
                </div>
              </div>
              <div>
                <label htmlFor="qty-avail" className="block text-sm font-medium text-[#1F2937]">
                  Quantity Available
                </label>
                <input
                  id="qty-avail"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={quantityAvailable}
                  onChange={(e) => setQuantityAvailable(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm tabular-nums"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="p-start" className="block text-sm font-medium text-[#1F2937]">
                  Pickup Start Time
                </label>
                <input
                  id="p-start"
                  type="datetime-local"
                  required
                  value={pickupStart}
                  onChange={(e) => setPickupStart(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="p-end" className="block text-sm font-medium text-[#1F2937]">
                  Pickup End Time
                </label>
                <input
                  id="p-end"
                  type="datetime-local"
                  required
                  value={pickupEnd}
                  onChange={(e) => setPickupEnd(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="l-status" className="block text-sm font-medium text-[#1F2937]">
                  Publish Status
                </label>
                <select
                  id="l-status"
                  value={listingStatus}
                  onChange={(e) => setListingStatus(e.target.value as ListingStatus)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="published">Published (Live)</option>
                  <option value="draft">Save as Draft</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#1F2937]">Food Image</label>
              <div className="flex flex-wrap items-center gap-4">
                <img
                  src={imageUrl}
                  alt="Selected food preview"
                  referrerPolicy="no-referrer"
                  className="h-20 w-28 rounded-lg border border-[#E5EBE3] object-cover"
                />
                <div className="space-y-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#1F2937] hover:bg-gray-50">
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingImage ? 'Uploading...' : 'Upload Photo (JPEG/PNG/WebP)'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {SAMPLE_FOOD_IMAGES.map((sample) => (
                      <button
                        key={sample.url}
                        type="button"
                        onClick={() => setImageUrl(sample.url)}
                        className={`rounded border px-2 py-1 text-[11px] font-medium ${
                          imageUrl === sample.url
                            ? 'border-[#166534] bg-[#F0F5EE] text-[#166534]'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {sample.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('/vendor/listings')}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingFood || !isApproved}
                className="rounded-lg bg-[#166534] px-5 py-2 text-sm font-semibold text-white hover:bg-[#14532D] disabled:opacity-50"
              >
                {savingFood ? 'Saving...' : editingId ? 'Update Listing' : 'Publish Food Listing'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. INCOMING ORDERS & DETAIL */}
      {(currentPath === '/vendor/orders' || Boolean(orderDetailMatch)) && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-[#1F2937]">
              {selectedOrder ? `Order ${selectedOrder.order_number}` : 'Incoming Student Orders'}
            </h1>
            {selectedOrder && (
              <button
                type="button"
                onClick={() => onNavigate('/vendor/orders')}
                className="text-sm font-medium text-[#166534] hover:underline"
              >
                ← All Orders
              </button>
            )}
          </div>

          {selectedOrder ? (
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-6 space-y-4 max-w-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-xs text-gray-500">{selectedOrder.order_number}</p>
                  <h2 className="text-lg font-bold text-[#1F2937]">{selectedOrder.student_name}</h2>
                  <p className="text-xs text-gray-500">
                    ID: {selectedOrder.student_number || '—'} · Phone: {selectedOrder.student_phone}
                  </p>
                </div>
                <OrderStatusBadge status={selectedOrder.order_status} />
              </div>

              <ul className="space-y-2 border-y border-[#F0F4EE] py-4 text-sm">
                {selectedOrder.items.map((item) => (
                  <li key={item.id} className="flex justify-between tabular-nums">
                    <span>
                      {item.quantity} × {item.food_name_snapshot}
                    </span>
                    <span className="font-medium">{formatRM(item.subtotal)}</span>
                  </li>
                ))}
              </ul>

              <div className="flex justify-between font-bold text-base tabular-nums">
                <span>Total (Pay at Pickup)</span>
                <span className="text-[#166534]">{formatRM(selectedOrder.total_amount)}</span>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {selectedOrder.order_status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => handleOrderStatusChange(selectedOrder.id, 'confirmed')}
                    className="rounded-lg bg-[#166534] px-4 py-2 text-xs font-semibold text-white hover:bg-[#14532D]"
                  >
                    Accept Order
                  </button>
                )}
                {(selectedOrder.order_status === 'pending' ||
                  selectedOrder.order_status === 'confirmed') && (
                  <button
                    type="button"
                    onClick={() => handleOrderStatusChange(selectedOrder.id, 'ready_for_pickup')}
                    className="rounded-lg bg-[#22C55E] px-4 py-2 text-xs font-semibold text-[#1F2937] hover:bg-[#16a34a] hover:text-white"
                  >
                    Mark Ready for Pickup
                  </button>
                )}
                {selectedOrder.order_status === 'ready_for_pickup' && (
                  <button
                    type="button"
                    onClick={() => {
                      setVerifyOrderNumber(selectedOrder.order_number);
                      onNavigate('/vendor/verify');
                    }}
                    className="rounded-lg bg-[#166534] px-4 py-2 text-xs font-semibold text-white"
                  >
                    Verify Pickup Code
                  </button>
                )}
              </div>
            </div>
          ) : orders.length === 0 ? (
            <EmptyState
              title="No incoming orders"
              description="Student reservations for your listings will appear here."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#E5EBE3] bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#E5EBE3] bg-[#F8FAF7] text-xs font-semibold text-gray-600">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Workflow Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F4EE]">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-[#F8FAF7]/70">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-semibold whitespace-nowrap">{order.order_number}</p>
                        <p className="text-xs text-gray-500">{formatDateTime(order.created_at)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#1F2937]">{order.student_name}</p>
                        <p className="text-xs text-gray-500">{order.student_number}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        {order.items.map((i) => `${i.quantity}× ${i.food_name_snapshot}`).join(', ')}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatRM(order.total_amount)}
                      </td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={order.order_status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {order.order_status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => handleOrderStatusChange(order.id, 'confirmed')}
                              className="rounded bg-[#166534] px-2.5 py-1 text-xs font-semibold text-white"
                            >
                              Accept
                            </button>
                          )}
                          {(order.order_status === 'pending' ||
                            order.order_status === 'confirmed') && (
                            <button
                              type="button"
                              onClick={() =>
                                handleOrderStatusChange(order.id, 'ready_for_pickup')
                              }
                              className="rounded border border-[#166534] px-2.5 py-1 text-xs font-semibold text-[#166534]"
                            >
                              Ready
                            </button>
                          )}
                          {order.order_status === 'ready_for_pickup' && (
                            <button
                              type="button"
                              onClick={() => {
                                setVerifyOrderNumber(order.order_number);
                                onNavigate('/vendor/verify');
                              }}
                              className="rounded bg-[#166534] px-2.5 py-1 text-xs font-semibold text-white"
                            >
                              Verify Code
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onNavigate(`/vendor/orders/${order.id}`)}
                            className="text-xs font-semibold text-gray-600 hover:underline"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. PICKUP VERIFICATION */}
      {currentPath === '/vendor/verify' && (
        <div className="mx-auto max-w-2xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1F2937]">Pickup Code Verification</h1>
            <p className="mt-1 text-sm text-[#4B5563]">
              Enter the student&apos;s 6-character pickup code or paste scanned QR data to verify
              their order before handing over food.
            </p>
          </div>

          <form
            onSubmit={handleLookupPickupCode}
            className="space-y-4 rounded-xl border border-[#E5EBE3] bg-white p-6"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="v-code" className="block text-sm font-medium text-[#1F2937]">
                  Pickup Code or QR Payload
                </label>
                <input
                  id="v-code"
                  type="text"
                  required
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder="e.g. RPL842"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2 font-mono text-sm uppercase"
                />
              </div>
              <div>
                <label htmlFor="v-ordnum" className="block text-sm font-medium text-[#1F2937]">
                  Order Number (Optional)
                </label>
                <input
                  id="v-ordnum"
                  type="text"
                  value={verifyOrderNumber}
                  onChange={(e) => setVerifyOrderNumber(e.target.value)}
                  placeholder="RP-20261125-..."
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2 font-mono text-sm uppercase"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={verifyMethod === 'code'}
                    onChange={() => setVerifyMethod('code')}
                  />
                  Manual Code
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={verifyMethod === 'qr'}
                    onChange={() => setVerifyMethod('qr')}
                  />
                  QR Scan
                </label>
              </div>
              <button
                type="submit"
                disabled={verifyLoading}
                className="rounded-lg bg-[#166534] px-5 py-2 text-sm font-semibold text-white hover:bg-[#14532D] disabled:opacity-50"
              >
                {verifyLoading ? 'Checking...' : 'Check Pickup Code'}
              </button>
            </div>
          </form>

          {verifiedPreviewOrder && (
            <div className="rounded-xl border border-[#166534]/30 bg-white p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-[#166534]">ORDER MATCH VERIFIED</p>
                  <h2 className="mt-1 text-lg font-bold text-[#1F2937]">
                    {verifiedPreviewOrder.student_name}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {verifiedPreviewOrder.order_number} · Student ID:{' '}
                    {verifiedPreviewOrder.student_number || '—'}
                  </p>
                </div>
                <OrderStatusBadge status={verifiedPreviewOrder.order_status} />
              </div>

              <ul className="space-y-1.5 border-y border-[#F0F4EE] py-3 text-sm">
                {verifiedPreviewOrder.items.map((item) => (
                  <li key={item.id} className="flex justify-between tabular-nums">
                    <span>
                      {item.quantity} × {item.food_name_snapshot}
                    </span>
                    <span className="font-medium">{formatRM(item.subtotal)}</span>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Collect Payment at Counter</p>
                  <p className="text-lg font-bold text-[#166534] tabular-nums">
                    {formatRM(verifiedPreviewOrder.total_amount)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={verifyLoading}
                  onClick={handleConfirmCollection}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#166534] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {verifyLoading ? 'Confirming...' : 'Confirm Food Collection'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. SALES REPORTS */}
      {currentPath === '/vendor/reports' && (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-[#1F2937]">Vendor Sales & Rescue Report</h1>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-5">
              <p className="text-xs text-gray-500">Collected Revenue</p>
              <p className="mt-1 text-2xl font-bold text-[#166534] tabular-nums">
                {formatRM(stats.totalSales)}
              </p>
            </div>
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-5">
              <p className="text-xs text-gray-500">Completed Pickups</p>
              <p className="mt-1 text-2xl font-bold text-[#1F2937] tabular-nums">
                {stats.completedPickups}
              </p>
            </div>
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-5">
              <p className="text-xs text-gray-500">Est. Food Waste Prevented</p>
              <p className="mt-1 text-2xl font-bold text-[#1F2937] tabular-nums">
                {(impact?.estimatedFoodSavedKg ?? 0).toFixed(2)} kg
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#E5EBE3] bg-white p-6">
            <h2 className="text-base font-bold text-[#1F2937]">Order Status Breakdown</h2>
            <div className="mt-4 space-y-3">
              {(
                [
                  'picked_up',
                  'ready_for_pickup',
                  'confirmed',
                  'pending',
                  'cancelled',
                  'expired',
                ] as OrderStatus[]
              ).map((status) => {
                const count = orders.filter((o) => o.order_status === status).length;
                const pct = orders.length > 0 ? Math.round((count / orders.length) * 100) : 0;
                return (
                  <div key={status} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-gray-700 tabular-nums">
                      <span className="capitalize">{status.replace(/_/g, ' ')}</span>
                      <span>
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#EEF3EC]">
                      <div
                        className="h-full rounded-full bg-[#166534]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 7. VENDOR PROFILE */}
      {currentPath === '/vendor/profile' && (
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="text-2xl font-bold text-[#1F2937]">Vendor Profile</h1>
          <form
            onSubmit={handleSaveVendorProfile}
            className="space-y-4 rounded-xl border border-[#E5EBE3] bg-white p-6"
          >
            <div>
              <label htmlFor="vp-name" className="block text-sm font-medium text-[#1F2937]">
                Business Name
              </label>
              <input
                id="vp-name"
                type="text"
                required
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="vp-loc" className="block text-sm font-medium text-[#1F2937]">
                Cafeteria / Pickup Location
              </label>
              <input
                id="vp-loc"
                type="text"
                required
                value={bizLoc}
                onChange={(e) => setBizLoc(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="vp-phone" className="block text-sm font-medium text-[#1F2937]">
                Contact Phone
              </label>
              <input
                id="vp-phone"
                type="tel"
                required
                value={bizPhone}
                onChange={(e) => setBizPhone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="vp-desc" className="block text-sm font-medium text-[#1F2937]">
                Description
              </label>
              <textarea
                id="vp-desc"
                rows={3}
                value={bizDesc}
                onChange={(e) => setBizDesc(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={savingBiz}
              className="rounded-lg bg-[#166534] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14532D] disabled:opacity-50"
            >
              {savingBiz ? 'Saving...' : 'Save Vendor Profile'}
            </button>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove this food listing?"
        description={
          deleteTarget
            ? `"${deleteTarget.food_name}" will be removed from the student marketplace.`
            : ''
        }
        confirmLabel="Remove Listing"
        confirmTone="danger"
        loading={deleting}
        onConfirm={handleDeleteListing}
        onCancel={() => setDeleteTarget(null)}
      />
    </RoleShell>
  );
}
