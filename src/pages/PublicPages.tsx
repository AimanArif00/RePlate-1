import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Leaf,
  MapPin,
  Search,
  ShoppingBag,
  Star,
  Store,
  Utensils,
} from 'lucide-react';
import { FoodCard } from '../components/food/FoodCard';
import { EmptyState } from '../components/ui/EmptyState';
import {
  formatDateTime,
  formatPickupWindow,
  formatRM,
  getListingStatusLabel,
} from '../lib/replateRules';
import { replateService, type MarketplacePayload } from '../services/replateService';
import type { EnrichedFoodListing, Review } from '../types/replate';

interface PublicPageProps {
  marketplace: MarketplacePayload;
  loading: boolean;
  onNavigate: (path: string) => void;
  onAddToCart: (listing: EnrichedFoodListing, quantity?: number) => void;
}

export function LandingPage({
  marketplace,
  loading,
  onNavigate,
  onAddToCart,
}: PublicPageProps) {
  const featured = useMemo(
    () =>
      marketplace.listings
        .filter((l) => l.effective_status === 'published' && l.quantity_available > 0)
        .slice(0, 3),
    [marketplace.listings],
  );

  const { impact } = marketplace;

  return (
    <div className="bg-[#F8FAF7]">
      {/* 1. Hero Section */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid items-stretch gap-8 lg:grid-cols-12">
          <div className="flex flex-col justify-center lg:col-span-6">
            <p className="text-xs font-semibold tracking-wide text-[#166534]">
              Save Food · Save Money · Save Our Planet
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#1F2937] sm:text-5xl leading-[1.1] [text-wrap:balance]">
              Good Food Deserves a Second Chance.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-[#4B5563]">
              Discover affordable meals from your campus cafes while helping reduce food waste.
              Save money, rescue food, and make a difference with RePlate Campus.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('/browse')}
                className="rounded-lg bg-[#166534] px-5 py-3 text-sm font-semibold text-white hover:bg-[#14532D] transition-colors whitespace-nowrap shrink-0"
              >
                Explore Available Food
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/register/vendor')}
                className="rounded-lg border border-[#166534]/30 bg-white px-5 py-3 text-sm font-semibold text-[#166534] hover:bg-[#F0F5EE] transition-colors whitespace-nowrap shrink-0"
              >
                Join as a Vendor
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[280px] overflow-hidden rounded-xl border border-[#E5EBE3] bg-[#EEF3EC]">
              <img
                src="/src/assets/images/hero_campus_cafeteria_1795588201868.jpg"
                alt="University campus cafeteria counter displaying freshly packed meal boxes"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* 4-Column Impact & Marketplace Strip */}
        <div className="mt-10 grid grid-cols-2 gap-4 border-y border-[#E5EBE3] bg-white px-6 py-6 rounded-xl lg:grid-cols-4">
          <div>
            <p className="text-xs font-medium text-gray-500">Meals Rescued (Completed)</p>
            <p className="mt-1 text-2xl font-bold text-[#166534] tabular-nums">
              {impact.totalMealsRescued}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Est. Food Waste Avoided</p>
            <p className="mt-1 text-2xl font-bold text-[#1F2937] tabular-nums">
              {impact.estimatedFoodSavedKg.toFixed(2)} kg
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Est. CO₂e Prevented</p>
            <p className="mt-1 text-2xl font-bold text-[#1F2937] tabular-nums">
              {impact.estimatedCo2AvoidedKg.toFixed(2)} kg
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Active Campus Vendors</p>
            <p className="mt-1 text-2xl font-bold text-[#1F2937] tabular-nums">
              {marketplace.vendors.length}
            </p>
          </div>
        </div>
      </section>

      {/* 2. Featured Discounted Meals */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#1F2937]">
              Featured Discounted Meals
            </h2>
            <p className="mt-1 text-sm text-[#4B5563]">
              Live surplus trays posted by approved campus cafeterias before closing hours.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/browse')}
            className="text-sm font-semibold text-[#166534] hover:underline whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            View all listings
          </button>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="grid gap-6 md:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-80 animate-pulse rounded-xl border border-[#E5EBE3] bg-white"
                />
              ))}
            </div>
          ) : featured.length === 0 ? (
            <EmptyState
              title="No active surplus meals right now"
              description="Campus vendors post discounted meals closer to closing hours. Check back soon or browse all categories."
              actionLabel="Browse All Listings"
              onAction={() => onNavigate('/browse')}
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {featured.map((listing) => (
                <FoodCard
                  key={listing.id}
                  listing={listing}
                  onViewDetails={(id) => onNavigate(`/food/${id}`)}
                  onAddToCart={(item) => onAddToCart(item, 1)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 3. How RePlate Works */}
      <section className="border-y border-[#E5EBE3] bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-[#1F2937]">How RePlate Works</h2>
            <p className="mt-2 text-sm text-[#4B5563]">
              Reserve discounted campus meals in three straightforward steps and pay directly at
              pickup.
            </p>
          </div>

          <div className="mt-8 grid gap-8 md:grid-cols-3">
            <div className="border-t border-[#E5EBE3] pt-5">
              <p className="font-mono text-xs font-semibold text-[#166534]">01. DISCOVER</p>
              <h3 className="mt-2 text-lg font-semibold text-[#1F2937]">Discover</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#4B5563]">
                Browse leftover food from participating campus cafeterias and cafes with clear
                discounted prices and pickup deadlines.
              </p>
            </div>
            <div className="border-t border-[#E5EBE3] pt-5">
              <p className="font-mono text-xs font-semibold text-[#166534]">02. ORDER</p>
              <h3 className="mt-2 text-lg font-semibold text-[#1F2937]">Order</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#4B5563]">
                Choose your favourite discounted meals, confirm your Pay-at-Pickup order online, and
                receive a unique pickup verification code.
              </p>
            </div>
            <div className="border-t border-[#E5EBE3] pt-5">
              <p className="font-mono text-xs font-semibold text-[#166534]">03. COLLECT</p>
              <h3 className="mt-2 text-lg font-semibold text-[#1F2937]">Collect</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#4B5563]">
                Visit the vendor during the pickup window and verify your order using your pickup
                code or QR pass at the counter.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. About RePlate, Why Choose RePlate & SDG 12 */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <h2 className="text-2xl font-bold tracking-tight text-[#1F2937]">
              About RePlate Campus & SDG 12
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#4B5563]">
              Every day, university cafeterias prepare fresh meals that go unsold at closing hours.
              RePlate Campus bridges the gap between food vendors and students in direct support of{' '}
              <strong className="font-semibold text-[#1F2937]">
                UN Sustainable Development Goal 12: Responsible Consumption and Production
              </strong>
              .
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[#4B5563]">
              Vendors recover ingredient costs instead of discarding edible meals, while students
              access nutritious campus food at 40% to 55% savings. Environmental estimates shown on
              this platform assume{' '}
              <span className="font-medium text-[#1F2937] tabular-nums">
                {impact.assumedKgPerMeal.toFixed(2)} kg
              </span>{' '}
              per completed meal pickup and{' '}
              <span className="font-medium text-[#1F2937] tabular-nums">
                {impact.assumedCo2PerKg.toFixed(2)} kg CO₂e
              </span>{' '}
              per kg of food rescued, configurable by campus administrators.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-6">
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-5">
              <Leaf className="h-5 w-5 text-[#166534]" />
              <h3 className="mt-3 text-base font-semibold text-[#1F2937]">Measurable Campus Impact</h3>
              <p className="mt-1 text-sm text-[#4B5563]">
                Rescue counts reflect verified completed pickups rather than uncollected bookings.
              </p>
            </div>
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-5">
              <Store className="h-5 w-5 text-[#166534]" />
              <h3 className="mt-3 text-base font-semibold text-[#1F2937]">Approved Campus Vendors</h3>
              <p className="mt-1 text-sm text-[#4B5563]">
                Every cafeteria operator is reviewed and approved by campus administration before
                publishing meals.
              </p>
            </div>
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-5">
              <Clock className="h-5 w-5 text-[#166534]" />
              <h3 className="mt-3 text-base font-semibold text-[#1F2937]">Strict Pickup Windows</h3>
              <p className="mt-1 text-sm text-[#4B5563]">
                Listings expire automatically after closing time to maintain food quality and
                safety.
              </p>
            </div>
            <div className="rounded-xl border border-[#E5EBE3] bg-white p-5">
              <CheckCircle2 className="h-5 w-5 text-[#166534]" />
              <h3 className="mt-3 text-base font-semibold text-[#1F2937]">Verified Counter Pickup</h3>
              <p className="mt-1 text-sm text-[#4B5563]">
                Unique one-time pickup codes prevent duplicate claims and keep counter handoff fast.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Final CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 rounded-xl bg-[#166534] px-8 py-10 text-white md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Ready to rescue today&apos;s campus surplus?
            </h2>
            <p className="mt-1.5 text-sm text-white/85">
              Create a student account to reserve meals or register your cafeteria stall.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('/register/student')}
              className="rounded-lg bg-[#FACC15] px-5 py-2.5 text-sm font-bold text-[#1F2937] hover:bg-[#eab308] transition-colors whitespace-nowrap"
            >
              Register as Student
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/register/vendor')}
              className="rounded-lg border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors whitespace-nowrap"
            >
              Register as Vendor
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function AboutPage({
  marketplace,
  onNavigate,
}: {
  marketplace: MarketplacePayload;
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-[#1F2937]">About RePlate Campus</h1>
      <p className="mt-4 text-base leading-relaxed text-[#4B5563]">
        RePlate Campus is a university sustainability platform built to eliminate avoidable
        end-of-day food waste across campus cafeterias, student union stalls, and faculty cafes.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-[#E5EBE3] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#1F2937]">Alignment with UN SDG 12</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">
            Target 12.3 calls for halving per-capita global food waste at retail and consumer levels.
            By giving campus food vendors a fast digital channel to discount unsold trays before
            closing, RePlate turns end-of-day surplus into affordable student meals.
          </p>
        </div>
        <div className="rounded-xl border border-[#E5EBE3] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#1F2937]">Transparent Impact Estimates</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">
            Our platform currently tracks{' '}
            <strong className="font-semibold text-[#1F2937] tabular-nums">
              {marketplace.impact.totalMealsRescued}
            </strong>{' '}
            meals rescued across{' '}
            <strong className="font-semibold text-[#1F2937] tabular-nums">
              {marketplace.impact.completedPickupsCount}
            </strong>{' '}
            verified pickups, representing an estimated{' '}
            <strong className="font-semibold text-[#166534] tabular-nums">
              {marketplace.impact.estimatedFoodSavedKg.toFixed(2)} kg
            </strong>{' '}
            of food kept out of landfill.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <button
          type="button"
          onClick={() => onNavigate('/browse')}
          className="rounded-lg bg-[#166534] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] transition-colors"
        >
          Explore Available Meals
        </button>
      </div>
    </div>
  );
}

export function HowItWorksPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-[#1F2937]">How RePlate Campus Works</h1>
      <p className="mt-3 max-w-2xl text-base text-[#4B5563]">
        A single workflow connecting students, cafeteria vendors, and campus administrators.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-[#E5EBE3] bg-white p-6">
          <p className="font-mono text-xs font-semibold text-[#166534]">FOR STUDENTS</p>
          <h2 className="mt-2 text-lg font-semibold text-[#1F2937]">1. Browse & Reserve</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">
            Search active discounted meals by cafeteria or category, add items to your cart, and
            place a Pay-at-Pickup order to receive a 6-character pickup code and QR pass.
          </p>
        </div>
        <div className="rounded-xl border border-[#E5EBE3] bg-white p-6">
          <p className="font-mono text-xs font-semibold text-[#166534]">FOR VENDORS</p>
          <h2 className="mt-2 text-lg font-semibold text-[#1F2937]">2. List & Verify</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">
            Publish surplus portions with discounted RM pricing and pickup windows, confirm incoming
            orders, and verify student pickup codes at the counter.
          </p>
        </div>
        <div className="rounded-xl border border-[#E5EBE3] bg-white p-6">
          <p className="font-mono text-xs font-semibold text-[#166534]">FOR CAMPUS ADMINS</p>
          <h2 className="mt-2 text-lg font-semibold text-[#1F2937]">3. Govern & Measure</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">
            Approve cafeteria vendors, manage food categories, oversee order activity, and monitor
            verified meal rescue statistics across campus.
          </p>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onNavigate('/register/student')}
          className="rounded-lg bg-[#166534] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D]"
        >
          Student Registration
        </button>
        <button
          type="button"
          onClick={() => onNavigate('/register/vendor')}
          className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-[#1F2937] hover:bg-gray-50"
        >
          Vendor Registration
        </button>
      </div>
    </div>
  );
}

export function BrowseFoodPage({
  marketplace,
  loading,
  onNavigate,
  onAddToCart,
}: PublicPageProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedVendor, setSelectedVendor] = useState('all');
  const [maxPrice, setMaxPrice] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recommended' | 'lowest_price' | 'highest_discount'>('recommended');
  const [onlyAvailable, setOnlyAvailable] = useState(true);

  const filtered = useMemo(() => {
    let items = [...marketplace.listings];

    if (onlyAvailable) {
      items = items.filter((l) => l.effective_status === 'published' && l.quantity_available > 0);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (l) =>
          l.food_name.toLowerCase().includes(q) ||
          l.vendor_name.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q),
      );
    }
    if (selectedCategory !== 'all') {
      items = items.filter((l) => l.category_id === selectedCategory);
    }
    if (selectedVendor !== 'all') {
      items = items.filter((l) => l.vendor_id === selectedVendor);
    }
    if (maxPrice !== 'all') {
      const cap = Number(maxPrice);
      items = items.filter((l) => l.discounted_price <= cap);
    }

    if (sortBy === 'lowest_price') {
      items.sort((a, b) => a.discounted_price - b.discounted_price);
    } else if (sortBy === 'highest_discount') {
      items.sort((a, b) => b.discount_percentage - a.discount_percentage);
    }

    return items;
  }, [marketplace.listings, onlyAvailable, search, selectedCategory, selectedVendor, maxPrice, sortBy]);

  const resetFilters = () => {
    setSearch('');
    setSelectedCategory('all');
    setSelectedVendor('all');
    setMaxPrice('all');
    setSortBy('recommended');
    setOnlyAvailable(false);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 border-b border-[#E5EBE3] pb-6 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1F2937] sm:text-3xl">
            Browse Surplus Campus Food
          </h1>
          <p className="mt-1 text-sm text-[#4B5563]">
            Showing {filtered.length} meal listing{filtered.length === 1 ? '' : 's'} across participating cafeterias.
          </p>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-[#1F2937]">
          <input
            type="checkbox"
            checked={onlyAvailable}
            onChange={(e) => setOnlyAvailable(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-[#166534] focus:ring-[#166534]"
          />
          Show only available food
        </label>
      </div>

      {/* Filter Bar */}
      <div className="mt-6 grid gap-3 rounded-xl border border-[#E5EBE3] bg-white p-4 md:grid-cols-12">
        <div className="relative md:col-span-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Nasi Lemak, Chicken Chop..."
            aria-label="Search food by name"
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-[#1F2937] focus:border-[#166534] focus:outline-none"
          />
        </div>

        <div className="md:col-span-2">
          <select
            aria-label="Filter by food category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#1F2937] focus:border-[#166534] focus:outline-none"
          >
            <option value="all">All Categories</option>
            {marketplace.categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.category_name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            aria-label="Filter by vendor"
            value={selectedVendor}
            onChange={(e) => setSelectedVendor(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#1F2937] focus:border-[#166534] focus:outline-none"
          >
            <option value="all">All Vendors</option>
            {marketplace.vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.business_name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            aria-label="Filter by max price"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#1F2937] focus:border-[#166534] focus:outline-none"
          >
            <option value="all">Any Price</option>
            <option value="4">Up to RM4.00</option>
            <option value="6">Up to RM6.00</option>
            <option value="10">Up to RM10.00</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            aria-label="Sort food listings"
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as 'recommended' | 'lowest_price' | 'highest_discount')
            }
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#1F2937] focus:border-[#166534] focus:outline-none"
          >
            <option value="recommended">Sort: Featured</option>
            <option value="lowest_price">Lowest Price</option>
            <option value="highest_discount">Highest Discount</option>
          </select>
        </div>
      </div>

      {/* Results Grid */}
      <div className="mt-6">
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-80 animate-pulse rounded-xl border border-[#E5EBE3] bg-white"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No food matches your current filters"
            description="Try clearing your search term, expanding the price range, or including sold-out items to see what vendors posted today."
            actionLabel="Reset Filters"
            onAction={resetFilters}
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((listing) => (
              <FoodCard
                key={listing.id}
                listing={listing}
                onViewDetails={(id) => onNavigate(`/food/${id}`)}
                onAddToCart={(item) => onAddToCart(item, 1)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function FoodDetailPage({
  listingId,
  onNavigate,
  onAddToCart,
}: {
  listingId: string;
  onNavigate: (path: string) => void;
  onAddToCart: (listing: EnrichedFoodListing, quantity: number) => void;
}) {
  const [listing, setListing] = useState<EnrichedFoodListing | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    replateService
      .fetchListingDetail(listingId)
      .then((res) => {
        if (!active) return;
        setListing(res.listing);
        setReviews(res.reviews);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load food listing.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [listingId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="h-96 animate-pulse rounded-xl border border-[#E5EBE3] bg-white" />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <EmptyState
          title="Food listing unavailable"
          description={error || 'This listing may have been removed or expired.'}
          actionLabel="Back to Browse"
          onAction={() => onNavigate('/browse')}
        />
      </div>
    );
  }

  const isAvailable = listing.effective_status === 'published' && listing.quantity_available > 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => onNavigate('/browse')}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#4B5563] hover:text-[#166534]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Available Food
      </button>

      <div className="mt-6 grid gap-8 lg:grid-cols-12">
        {/* Left Image */}
        <div className="lg:col-span-6">
          <div className="overflow-hidden rounded-xl border border-[#E5EBE3] bg-[#EEF3EC] aspect-[4/3]">
            {!imgFailed && listing.image_url ? (
              <img
                src={listing.image_url}
                alt={listing.food_name}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[#166534]">
                <Utensils className="h-10 w-10 opacity-60" />
              </div>
            )}
          </div>
        </div>

        {/* Right Contiguous Purchase Module */}
        <div className="lg:col-span-6">
          <div className="rounded-xl border border-[#E5EBE3] bg-white p-6">
            <p className="text-xs font-medium text-gray-500">
              {listing.category_name} · {listing.vendor_name}
            </p>
            <h1 className="mt-1.5 text-2xl font-bold text-[#1F2937]">{listing.food_name}</h1>
            <p className="mt-3 text-sm leading-relaxed text-[#4B5563]">{listing.description}</p>

            <div className="mt-5 flex items-baseline gap-3 tabular-nums">
              <span className="text-3xl font-bold text-[#166534]">
                {formatRM(listing.discounted_price)}
              </span>
              <span className="text-base text-gray-400 line-through">
                {formatRM(listing.original_price)}
              </span>
              <span className="rounded bg-[#FACC15]/40 px-2 py-0.5 text-xs font-bold text-[#1F2937]">
                Save {listing.discount_percentage}%
              </span>
            </div>

            <dl className="mt-5 space-y-2.5 border-y border-[#F0F4EE] py-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-2 text-gray-500">
                  <MapPin className="h-4 w-4" /> Pickup Location
                </dt>
                <dd className="font-medium text-[#1F2937] text-right">{listing.vendor_location}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-2 text-gray-500">
                  <Clock className="h-4 w-4" /> Pickup Window
                </dt>
                <dd className="font-medium text-[#1F2937] tabular-nums">
                  {formatPickupWindow(listing.pickup_start_at, listing.pickup_end_at)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-gray-500">Status & Stock</dt>
                <dd className="font-semibold text-[#166534] tabular-nums">
                  {getListingStatusLabel(listing.effective_status)} ({listing.quantity_available} left)
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-gray-500">Payment Method</dt>
                <dd className="font-medium text-[#1F2937]">Pay at Pickup</dd>
              </div>
            </dl>

            <div className="mt-5 flex items-center gap-3">
              <div className="flex items-center rounded-lg border border-gray-300 bg-white">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={!isAvailable || qty <= 1}
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40"
                >
                  -
                </button>
                <span className="w-10 text-center text-sm font-semibold tabular-nums">{qty}</span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  disabled={!isAvailable || qty >= listing.quantity_available}
                  onClick={() => setQty((q) => Math.min(listing.quantity_available, q + 1))}
                  className="px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                disabled={!isAvailable}
                onClick={() => onAddToCart(listing, qty)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#166534] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 transition-colors"
              >
                <ShoppingBag className="h-4 w-4" />
                {isAvailable ? `Add to Cart · ${formatRM(listing.discounted_price * qty)}` : getListingStatusLabel(listing.effective_status)}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Vendor Reviews */}
      <section className="mt-10 border-t border-[#E5EBE3] pt-8">
        <h2 className="text-lg font-bold text-[#1F2937]">
          Student Feedback for {listing.vendor_name}
        </h2>
        {reviews.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            No student reviews submitted for this vendor yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {reviews.map((rev) => (
              <div key={rev.id} className="rounded-xl border border-[#E5EBE3] bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#1F2937]">
                    {rev.student_name ?? 'Campus Student'}
                  </p>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#166534] tabular-nums">
                    <Star className="h-3.5 w-3.5 fill-[#FACC15] text-[#FACC15]" />
                    {rev.rating}/5
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#4B5563]">{rev.comment}</p>
                <p className="mt-2 text-xs text-gray-400">{formatDateTime(rev.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
